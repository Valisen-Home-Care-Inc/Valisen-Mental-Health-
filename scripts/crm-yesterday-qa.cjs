// Authenticated browser checks against disposable PostgreSQL; no production data or mail.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const http = require('node:http'), cp = require('node:child_process'), assert = require('node:assert/strict');
const { createHmac, randomBytes, pbkdf2Sync } = require('node:crypto');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..'), origin = 'http://127.0.0.1:3319';
const pkg = process.env.VMH_PGLITE_PATH || path.join(root, 'artifacts/pooled-calendar-test/node_modules/@electric-sql/pglite');
const { PGlite } = require(pkg), { btree_gist } = require(path.join(pkg, 'dist/contrib/btree_gist.cjs')), { pgcrypto } = require(path.join(pkg, 'dist/contrib/pgcrypto.cjs'));
const secret = 'local-crm-yesterday-qa-secret-never-production-123456789';
const calls = [], errors = [], logs = [];
let db, server, app, browser;
(async () => {
  db = new PGlite({ extensions: { btree_gist, pgcrypto } });
  await db.exec('create role anon; create role authenticated; create role service_role;');
  const dir = path.join(root, 'supabase/migrations');
  for (const file of fs.readdirSync(dir).filter(file => file.endsWith('.sql')).sort()) await db.exec(fs.readFileSync(path.join(dir, file), 'utf8').replace(/\r\n/g, '\n'));
  const expected = (await db.query("select (((now() at time zone 'America/Toronto')::date - 1)::timestamp at time zone 'America/Toronto') as from_day, (((now() at time zone 'America/Toronto')::date)::timestamp at time zone 'America/Toronto') as to_day")).rows[0];
  const expectedFrom = new Date(expected.from_day).toISOString(), expectedTo = new Date(expected.to_day).toISOString();
  server = http.createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    try {
      const name = req.url.split('/').pop(), body = JSON.parse(raw || '{}'), keys = Object.keys(body);
      if (!/^[a-z][a-z0-9_]+$/.test(name) || keys.some(key => !/^p_[a-z_]+$/.test(key))) throw Error('Invalid QA RPC');
      calls.push({ name, body });
      const result = (await db.query(`select public.${name}(${keys.map((key, index) => `${key} => $${index + 1}`).join(',')}) as data`, keys.map(key => body[key]))).rows[0].data;
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(result));
    } catch (error) { logs.push('QA RPC: ' + error.message.slice(0, 180)); res.writeHead(503, { 'Content-Type': 'application/json' }); res.end('{}'); }
  });
  await new Promise(resolve => server.listen(3919, '127.0.0.1', resolve));
  const salt = Buffer.alloc(16, 1), passwordHash = `pbkdf2_sha256$210000$${salt.toString('base64url')}$${pbkdf2Sync('qa-only', salt, 210000, 32, 'sha256').toString('base64url')}`;
  const env = { ...process.env, SUPABASE_URL: 'http://127.0.0.1:3919', SUPABASE_SECRET_KEY: 'sb_secret_local_qa', CHECKPOINT_ADMIN_SESSION_SECRET: secret, CHECKPOINT_ADMIN_PASSWORD_HASH: passwordHash, GMAIL_USER: 'qa@example.invalid', GMAIL_APP_PASSWORD: 'no-live-mail' };
  app = cp.spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'dev', '--webpack', '-H', '127.0.0.1', '-p', '3319'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  app.stdout.on('data', data => logs.push(data.toString())); app.stderr.on('data', data => logs.push(data.toString()));
  for (let n = 0; n < 120; n++) {
    if (app.exitCode !== null) throw Error('QA app exited');
    try { if ((await fetch(origin + '/api/consultation-slots')).ok) break; } catch {}
    if (n === 119) throw Error('QA startup timeout');
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  browser = await puppeteer.launch({ headless: true });
  const issued = Math.floor(Date.now() / 1000);
  const unsigned = 'v1.' + Buffer.from(JSON.stringify({ sub: 'checkpoint-admin', iat: issued, exp: issued + 8 * 3600, nonce: randomBytes(16).toString('base64url') })).toString('base64url');
  const token = unsigned + '.' + createHmac('sha256', secret).update(unsigned).digest('base64url');
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'valisen-crm-yesterday-'));
  for (const width of [390, 1440]) {
    const page = await browser.newPage(); await page.setViewport({ width, height: 900 });
    page.on('pageerror', error => errors.push(error.message));
    await page.setExtraHTTPHeaders({ Cookie: '__Host-vmh_checkpoint_admin=' + token });
    for (const route of ['/admin/checkpoints/google-ads', '/admin/checkpoints/quiz', '/admin/checkpoints', '/admin/checkpoints/VMH-25', '/admin/checkpoints/consultations']) {
      await page.goto(origin + route, { waitUntil: 'networkidle2', timeout: 120000 });
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent.trim() === 'Today' && Object.keys(button).some(key => key.startsWith('__reactProps$'))));
      assert.equal(await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent.trim() === 'Today')?.nextElementSibling?.textContent.trim()), 'Yesterday');
      const before = calls.length;
      const pending = page.waitForResponse(response => {
        if (!response.url().includes('/api/admin/')) return false;
        if (new URL(response.url()).searchParams.get('range') === 'yesterday') return true;
        try { return response.request().method() === 'POST' && JSON.parse(response.request().postData()).range === 'yesterday'; } catch { return false; }
      }, { timeout: 30000 });
      await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent.trim() === 'Yesterday').click());
      const response = await pending; assert.equal(response.status(), 200, route);
      const body = await response.json();
      assert.equal(new Date(body.data.range.from).toISOString(), expectedFrom, route);
      assert.equal(new Date(body.data.range.to).toISOString(), expectedTo, route);
      const queries = calls.slice(before).filter(call => call.body.p_from && call.body.p_to);
      assert(queries.some(query => new Date(query.body.p_from).toISOString() === expectedFrom && new Date(query.body.p_to).toISOString() === expectedTo), 'Yesterday was fetched from PostgreSQL for ' + route);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'No horizontal overflow on ' + route);
      console.log(`PASS ${width}px ${route}: Yesterday beside Today, authenticated report, correct Toronto boundaries.`);
    }
    await page.screenshot({ path: path.join(output, `crm-yesterday-${width}.png`), fullPage: true }); await page.close();
  }
  assert.deepEqual(errors, []);
  // Reuse the website checks against the same isolated app.
  await new Promise((resolve, reject) => {
    const child = cp.spawn(process.execPath, [path.join(root, 'scripts/website-consultation-qa.mjs')], { cwd: root, env: { ...env, SITE_URL: origin }, stdio: 'inherit', windowsHide: true });
    child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(Error('Website checks failed')));
  });
  console.log('PASS CRM Yesterday and website flexible-calendar checks. Screenshots: ' + output);
})().catch(error => { console.error(error.stack || error.message); console.error(logs.join('').slice(-2500)); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  if (app && app.exitCode === null) {
    if (process.platform === 'win32') cp.spawnSync('taskkill', ['/pid', String(app.pid), '/T', '/F'], { windowsHide: true });
    else app.kill();
  }
  if (server) await new Promise(resolve => server.close(resolve));
  if (db) await db.close();
});

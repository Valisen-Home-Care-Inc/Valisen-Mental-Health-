// Real PostgreSQL, synthetic data only; never connects to a live database.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const pkg = process.env.VMH_PGLITE_PATH || path.join(root, 'artifacts/pooled-calendar-test/node_modules/@electric-sql/pglite');
const { PGlite } = require(pkg);
const { btree_gist } = require(path.join(pkg, 'dist/contrib/btree_gist.cjs'));
const { pgcrypto } = require(path.join(pkg, 'dist/contrib/pgcrypto.cjs'));
(async () => {
  const db = new PGlite({ extensions: { btree_gist, pgcrypto } });
  try {
    await db.exec('create role anon; create role authenticated; create role service_role;');
    const dir = path.join(root, 'supabase/migrations');
    for (const file of fs.readdirSync(dir).filter(file => file.endsWith('.sql') && file < '20261019000000').sort()) await db.exec(fs.readFileSync(path.join(dir, file), 'utf8').replace(/\r\n/g, '\n'));
    const sql = fs.readFileSync(path.join(root, 'artifacts/quiz/LAUNCH_QUIZ_CONTACT_TRACKING.sql'), 'utf8');
    await db.exec(sql); await db.exec(sql);
    const result = async (sql, args = []) => (await db.query(sql, args)).rows[0].data;
    const lead = Array(58).fill(''); lead[4] = 'QA Alex';
    for (const [ref, test] of [['VQ-CONTACTQA', false], ['VQ-CONTACTTEST', true]]) {
      await db.query('insert into public.quiz_result_submissions (client_submission_id, reference_id, payload_hash, first_name, lead_record, is_test) values ($1,$2,$3,$4,$5::jsonb,$6)', [randomUUID(), ref, 'a'.repeat(64), 'QA Alex', JSON.stringify(lead), test]);
      const snapshot = { viewId: randomUUID(), sequence: 1, elapsedSeconds: 5, activeSeconds: 3, scrollDepth: 80, sections: ['save_contact'], lastSection: 'save_contact', actions: { save_contact_clicked: 1, exit_prompt_saved: 1 } };
      for (let retry = 0; retry < 2; retry++) await result('select public.record_quiz_result_engagement($1,$2::jsonb) as data', [ref, JSON.stringify(snapshot)]);
    }
    const report = await result("select public.get_quiz_result_engagement(now()-interval '1 day',now()+interval '1 minute') as data");
    assert.equal(report.visitors, 1); assert.equal(report.records[0].firstName, 'QA Alex');
    assert.deepEqual(report.actionTotals.save_contact_clicked, { count: 1, results: 1 });
    for (const signature of ['public.get_quiz_result_engagement(timestamptz,timestamptz)', 'public.record_quiz_result_engagement(text,jsonb)']) {
      assert.equal(await result("select has_function_privilege('anon',$1,'EXECUTE') as data", [signature]), false);
      assert.equal(await result("select has_function_privilege('service_role',$1,'EXECUTE') as data", [signature]), true);
    }
    console.log('PASS: launch SQL reruns, contact taps accepted, named CRM association, retries deduplicated, test leads excluded, service-role-only reports.');
  } finally { await db.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });

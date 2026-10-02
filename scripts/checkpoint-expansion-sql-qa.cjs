// Usage: node scripts/checkpoint-expansion-sql-qa.cjs <path-to-@electric-sql/pglite>
// Runs the real migration chain in isolated PostgreSQL; never connects to Supabase.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const pglitePath = process.argv[2];
const { PGlite } = require(pglitePath);
const { btree_gist } = require(path.join(pglitePath, 'dist/contrib/btree_gist.cjs'));
const { pgcrypto } = require(path.join(pglitePath, 'dist/contrib/pgcrypto.cjs'));
const migrationName = '20261001000000_expand_mental_battery_checkpoints.sql';
const migrationDirectory = path.join(__dirname, '../supabase/migrations');
const readMigration = (name) => fs.readFileSync(path.join(migrationDirectory, name), 'utf8').replace(/\r\n/g, '\n');
const functionNames = ['move_checkpoint', 'get_checkpoint_detail', 'ingest_checkpoint_event',
  'record_checkpoint_consultation', 'get_checkpoint_action_metrics', 'upsert_consultation_lead'];

(async () => {
  const db = new PGlite({ extensions: { btree_gist, pgcrypto } });
  try {
    await db.exec('create role anon; create role authenticated; create role service_role;');
    for (const name of fs.readdirSync(migrationDirectory).filter((name) => name.endsWith('.sql') && name < migrationName).sort()) {
      await db.exec(readMigration(name));
    }

    const query = async (sql, parameters = []) => (await db.query(sql, parameters)).rows;
    const value = async (sql, parameters = []) => (await query(sql, parameters))[0].data;
    const event = (code, session, name, step = null, eventId = randomUUID()) => value(
      'select public.ingest_checkpoint_event($1,$2::uuid,$3::uuid,$4,$5::smallint) as data',
      [code, session, eventId, name, step]);
    const move = (code, name) => value('select public.move_checkpoint($1,$2,$2) as data', [code, name]);
    const record = (code, session, reference) => value(
      'select public.record_checkpoint_consultation($1,$2::uuid,$3) as data', [code, session, reference]);
    const upsert = (code, session, reference, placementId, source = 'mental_battery_checkpoint') => value(`
      select public.upsert_consultation_lead(
        $1,null,null,'Checkpoint','QA',$2,'6135550100',null,null,null,null,null,
        'I consent to being contacted.','checkpoint-qa',now(),$3,null,$4,$5::uuid,$6,
        null,null,null,null,null,null,'pending',now()
      ) as data`, [reference, `${reference.toLowerCase()}@example.invalid`, source, code, placementId, session]);
    const snapshots = () => query(`select
      (select jsonb_agg(to_jsonb(c) order by c.code) from public.checkpoints c where c.code <= 'VMH-10') as checkpoints,
      (select jsonb_agg(to_jsonb(p) order by p.id) from public.checkpoint_placements p join public.checkpoints c on c.id=p.checkpoint_id where c.code <= 'VMH-10') as placements,
      (select jsonb_agg(to_jsonb(s) order by s.id) from public.funnel_sessions s join public.checkpoints c on c.id=s.checkpoint_id where c.code <= 'VMH-10') as sessions,
      (select jsonb_agg(to_jsonb(e) order by e.id) from public.funnel_events e join public.checkpoints c on c.id=e.checkpoint_id where c.code <= 'VMH-10') as events,
      (select jsonb_agg(to_jsonb(a) order by a.id) from public.consultation_attributions a join public.checkpoints c on c.id=a.checkpoint_id where c.code <= 'VMH-10') as attributions`);
    const functions = () => query(`select p.proname, pg_get_functiondef(p.oid) as definition,
      p.prosecdef, p.proconfig, p.proacl::text as grants, p.proowner
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname=any($1::text[]) order by p.proname`, [functionNames]);

    // Preserve an original checkpoint with both traffic and a placement move.
    const oldSession = randomUUID();
    await event('VMH-01', oldSession, 'landing_view');
    await record('VMH-01', oldSession, 'VC-ORIGINAL01');
    await move('VMH-01', 'Original assigned location');
    const oldSnapshot = await snapshots();
    const oldFunctions = await functions();
    assert.equal(oldFunctions.length, 6);
    const migration = readMigration(migrationName);
    await db.exec(migration);
    await db.exec(migration);
    assert.deepEqual(await snapshots(), oldSnapshot, 'Existing checkpoint records and histories are unchanged');
    assert.deepEqual(await functions(), oldFunctions.map((entry) => ({ ...entry,
      definition: entry.definition.replaceAll('^VMH-(0[1-9]|10)$', '^VMH-(0[1-9]|1[0-9]|2[0-5])$'),
    })), 'RPC bodies change only their code range; permissions and security settings remain identical');
    const codes = Array.from({ length: 25 }, (_, index) => `VMH-${String(index + 1).padStart(2, '0')}`);
    assert.deepEqual((await query('select code from public.checkpoints order by code')).map((row) => row.code), codes);
    const placements = await query(`select c.code, p.partner_name, p.location_name, p.status
      from public.checkpoints c join public.checkpoint_placements p on p.checkpoint_id=c.id
      where c.code >= 'VMH-11' order by c.code`);
    assert.equal(placements.length, 15);
    assert(placements.every((row) => row.partner_name === 'Unassigned' && row.location_name === 'Unassigned' && row.status === 'unassigned'));

    // Every added checkpoint accepts the complete existing funnel and durable CRM attribution.
    for (const code of codes.slice(10)) {
      const session = randomUUID();
      const eventId = randomUUID();
      const landing = await event(code, session, 'landing_view', null, eventId);
      await event(code, session, 'landing_view', null, eventId);
      await event(code, session, 'checkin_started');
      for (let step = 1; step <= 4; step += 1) await event(code, session, 'checkin_step_completed', step);
      for (const name of ['checkin_completed', 'result_viewed', 'intent_talk_soon_selected', 'consultation_cta_clicked', 'consultation_started']) {
        await event(code, session, name);
      }
      const reference = `VC-CHECKPOINT${code.slice(-2)}`;
      const attribution = await record(code, session, reference);
      assert.equal(attribution.placementId, landing.placementId);
      await record(code, session, reference);
      await upsert(code, session, reference, landing.placementId);
      await upsert(code, session, reference, landing.placementId);
      const detail = await value('select public.get_checkpoint_detail($1) as data', [code]);
      assert.equal(detail.checkpoint.code, code);
      const actions = await value("select public.get_checkpoint_action_metrics(now()-interval '1 day',now(),$1) as data", [code]);
      assert(actions);
      const counts = await query(`select count(*)::integer as events from public.funnel_events e
        join public.funnel_sessions s on s.id=e.session_id where s.anonymous_session_id=$1::uuid`, [session]);
      assert.equal(counts[0].events, 12, `${code}: event and consultation retries do not inflate counts`);
    }
    assert.equal((await query("select count(*)::integer as count from public.consultation_leads where checkpoint_code >= 'VMH-11'"))[0].count, 15);
    assert.equal((await query("select count(*)::integer as count from public.consultation_requests where checkpoint_code >= 'VMH-11'"))[0].count, 15);
    const dashboard = await value('select public.get_checkpoint_dashboard() as data');
    assert.deepEqual(dashboard.checkpoints.map((checkpoint) => checkpoint.code), codes);
    assert(dashboard.checkpoints.filter((checkpoint) => checkpoint.code >= 'VMH-11').every((checkpoint) =>
      checkpoint.sessions === 1 && checkpoint.checkinsCompleted === 1 && checkpoint.consultationsSubmitted === 1));

    // Moving a new checkpoint must preserve old sessions' original placement.
    const firstPlacement = (await query("select placement_id from public.funnel_sessions s join public.checkpoints c on c.id=s.checkpoint_id where c.code='VMH-25'"))[0].placement_id;
    const moved = await move('VMH-25', 'New partner location');
    assert.equal(moved.previousPlacementId, firstPlacement);
    const nextLanding = await event('VMH-25', randomUUID(), 'landing_view');
    assert.equal(nextLanding.placementId, moved.placementId);
    assert.notEqual(nextLanding.placementId, firstPlacement);
    const placementsBeforeRerun = await query('select * from public.checkpoint_placements order by id');
    await db.exec(migration);
    assert.deepEqual(await query('select * from public.checkpoint_placements order by id'), placementsBeforeRerun);
    assert.deepEqual(await snapshots(), oldSnapshot);

    for (const code of ['VMH-00', 'VMH-26', 'VMH-99', 'VMH-1', 'vmh-11']) {
      await assert.rejects(db.query('insert into public.checkpoints(code) values($1)', [code]), { code: '23514' });
      await assert.rejects(event(code, randomUUID(), 'landing_view'), { code: '22023' });
      await assert.rejects(move(code, 'Invalid'), { code: '22023' });
      await assert.rejects(record(code, randomUUID(), 'VC-INVALID01'), { code: '22023' });
      await assert.rejects(value('select public.get_checkpoint_detail($1) as data', [code]), { code: '22023' });
      await assert.rejects(value("select public.get_checkpoint_action_metrics(now()-interval '1 day',now(),$1) as data", [code]), { code: '22023' });
      await assert.rejects(upsert(code, randomUUID(), 'VC-INVALID01', null), { code: '22023' });
    }
    await assert.rejects(db.query("update public.consultation_leads set checkpoint_code='VMH-26' where checkpoint_code='VMH-11'"), { code: '23514' });
    // The later Google Ads addition to the shared consultation RPC survives.
    await upsert(null, null, 'VC-GOOGLEADSPRESERVED', null, 'google_ads');
    const permissions = await query(`select p.proname,
      has_function_privilege('anon',p.oid,'EXECUTE') as anon,
      has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated,
      has_function_privilege('service_role',p.oid,'EXECUTE') as service
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname=any($1::text[])`, [functionNames]);
    assert(permissions.every((row) => !row.anon && !row.authenticated && row.service));
    console.log('PASS PostgreSQL: complete migration chain, reruns, VMH-01..25, all 15 funnels, event/CRM retries, dashboard visibility, placement history, invalid codes, Google Ads compatibility, and RPC security.');
  } finally {
    await db.close();
  }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });

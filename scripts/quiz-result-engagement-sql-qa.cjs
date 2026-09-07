// Usage: node scripts/quiz-result-engagement-sql-qa.cjs <path-to-@electric-sql/pglite>
// Uses an isolated, in-memory PostgreSQL instance. Never connects to Supabase.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { PGlite } = require(process.argv[2]);
(async () => {
 const db = new PGlite();
 try {
  await db.exec("create role anon; create role authenticated; create role service_role; create table public.quiz_result_submissions(reference_id text primary key, lead_record jsonb, is_test boolean not null default false);");
  const migration = fs.readFileSync('supabase/migrations/20260907000000_quiz_result_engagement.sql', 'utf8');
  await db.exec(migration);
  await db.exec(migration);
  await db.exec("insert into public.quiz_result_submissions values ('VQ-REAL1','[]',false),('VQ-REAL2','[]',false),('VQ-TEST1','[]',true);");
  const first = { viewId: '12345678-1234-4234-9234-123456789abc', sequence: 1, elapsedSeconds: 45, activeSeconds: 30, scrollDepth: 80, sections: ['summary','booking'], lastSection: 'booking', actions: { booking_clicked: 1 } };
  const record = (ref, snapshot) => db.query('select public.record_quiz_result_engagement($1,$2::jsonb)', [ref, JSON.stringify(snapshot)]);
  await record('VQ-REAL1', first);
  await record('VQ-REAL1', { ...first, sequence: 2, elapsedSeconds: 120, activeSeconds: 90, scrollDepth: 100, actions: { booking_clicked: 1, booking_completed: 1 } });
  await record('VQ-REAL1', first);
  await record('VQ-REAL1', { ...first, viewId: '22345678-1234-4234-9234-123456789abc', elapsedSeconds: 15, activeSeconds: 15, scrollDepth: 25, actions: {} });
  await record('VQ-TEST1', { ...first, viewId: '32345678-1234-4234-9234-123456789abc' });
  await assert.rejects(record('VQ-REAL2', first));
  await assert.rejects(record('VQ-REAL1', { ...first, email: 'private@example.invalid' }));
  await assert.rejects(record('VQ-REAL1', { ...first, sections: ['safety'] }));
  const { rows } = await db.query("select public.get_quiz_result_engagement(now() - interval '1 day', now() + interval '1 day') as report");
  const report = rows[0].report;
  assert.equal(report.views, 2); assert.equal(report.visitors, 1); assert.equal(report.averageActiveSeconds, 53);
  assert.equal(report.records[0].activeSeconds, 105); assert.equal(report.records[0].elapsedSeconds, 135);
  assert.equal(report.records[0].actions.booking_clicked, 1); assert.equal(report.records[0].actions.booking_completed, 1);
  assert.equal(report.records[0].scrollDepth, 100); assert(report.records[0].sections.includes('booking'));
  const permissions = await db.query("select has_table_privilege('anon','public.quiz_result_engagement','SELECT') as readable, has_function_privilege('authenticated','public.get_quiz_result_engagement(timestamptz,timestamptz)','EXECUTE') as callable");
  assert.equal(permissions.rows[0].readable, false); assert.equal(permissions.rows[0].callable, false);
  console.log('PASS migration rerun, SQL validation, deduplication, out-of-order protection, visitor aggregation, test exclusions and access controls');
 } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

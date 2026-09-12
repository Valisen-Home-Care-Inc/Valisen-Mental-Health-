// Usage: node scripts/quiz-flow-report-sql-qa.cjs <path-to-@electric-sql/pglite>
// Isolated PostgreSQL only. No production data or connection is used.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { PGlite } = require(process.argv[2]);
(async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema extensions;
      create function extensions.gen_random_uuid() returns uuid language sql as 'select gen_random_uuid()';`);
    const base = fs.readFileSync('supabase/migrations/20260810000000_unified_growth_crm.sql', 'utf8');
    await db.exec(base.slice(base.indexOf('create table public.growth_funnel_sessions'), base.indexOf('create table public.quiz_result_submissions')));
    await db.exec(`alter table public.growth_funnel_sessions add is_test boolean not null default false;
      alter table public.quiz_lead_links add is_test boolean not null default false;
      create function public.get_growth_dashboard(p_from timestamptz, p_to timestamptz) returns jsonb
      language plpgsql stable security definer as $$
      declare v_from timestamptz := p_from; v_to timestamptz := p_to; v_result jsonb := '{"kpis":{"quizVisitors":42}}';
      begin return v_result; end; $$;`);
    await db.exec(base.slice(base.indexOf('create or replace function public.ingest_growth_funnel_events('), base.indexOf('create or replace function public.record_quiz_lead_link(')));
    const migration = fs.readFileSync('supabase/migrations/20260912000000_quiz_flow_reporting.sql', 'utf8');
    await db.exec(migration);
    await db.exec(migration);
    const timestamp = new Date(Date.now() - 3600_000).toISOString();
    let identifier = 0;
    async function attempt(version, events, test = false, existingSession) {
      const suffix = String(++identifier).padStart(16, '0');
      const session = existingSession || `fs-${suffix}`;
      const key = `qa-${suffix}`;
      const previous = await db.query('select coalesce(max(sequence),0) as sequence from public.growth_funnel_events where session_id = (select id from public.growth_funnel_sessions where session_key=$1)', [session]);
      const batch = events.map((item, index) => {
        const [event, step] = typeof item === 'string' ? [item, undefined] : item;
        return { eventId: `fe-${suffix}-${index}`, sequence: previous.rows[0].sequence + index + 1,
          occurredAt: timestamp, event, path: '/quiz', page: 'quiz', quizAttemptId: key,
          quizVersion: version, quizStep: step, elapsedMs: 100,
        };
      });
      const input = [session, timestamp, JSON.stringify(batch)];
      const ingest = 'select public.ingest_growth_funnel_events($1,$2,$3::jsonb)';
      await db.query(ingest, input);
      await db.query(ingest, input); // Network retry must not inflate counts.
      if (test) await db.query('update public.growth_funnel_sessions set is_test=true where session_key=$1', [session]);
      return { session, key, version };
    }
    const complete = [['quiz_question_answered', 11], 'quiz_completed', 'quiz_access_form_viewed', 'quiz_access_form_started', 'quiz_access_form_submit_attempted', 'quiz_access_form_submit_failed', 'quiz_access_form_submit_attempted', 'results_viewed'];
    const saved = await attempt('6.0.0', complete);
    // Durable save, twice for the same attempt: still one saved attempt.
    for (const ref of ['VQ-REAL001', 'VQ-REAL002']) await db.query(`insert into public.quiz_lead_links
      (reference_id, funnel_session_key, quiz_attempt_key, quiz_version, scoring_version, consented_at)
      values ($1,$2,$3,'6.0.0','1.0.0',$4)`, [ref, saved.session, saved.key, timestamp]);
    await attempt('6.0.0', [['quiz_question_answered', 11], 'quiz_completed', 'quiz_access_form_viewed', 'quiz_access_form_started', 'quiz_access_form_validation_failed', 'quiz_access_form_verification_failed']);
    await attempt('6.0.0', [['quiz_question_viewed', 4], ['quiz_question_answered', 2]]); // Backtrack exit Q3, after answer.
    await attempt('6.0.0', [['quiz_question_viewed', 11]]); // Exit Q12, before answer.
    await attempt('6.0.0', complete, true);
    await attempt('5.1.0', [['quiz_question_viewed', 17]], false, saved.session); // Versions can share a session.
    await attempt('5.0.0', [['quiz_question_answered', 18]]);
    await attempt(undefined, [['quiz_question_viewed', 3]]);
    const bounds = [new Date(Date.now() - 7200_000).toISOString(), new Date().toISOString()];
    const { rows } = await db.query('select public.get_growth_dashboard($1,$2) as data', bounds);
    const data = rows[0].data;
    assert.equal(data.kpis.quizVisitors, 42, 'Existing report metrics stay intact');
    const current = data.quizFlow.find((v) => v.quizVersion === '6.0.0');
    assert.equal(current.questions.length, 12);
    assert.equal(current.attempts, 4);
    assert.equal(current.questions[0].reached, 4);
    assert.equal(current.questions[2].exitsAfterAnswer, 1);
    assert.equal(current.questions[4].exits, 0);
    assert.equal(current.questions[11].reached, 3);
    assert.equal(current.questions[11].exitsBeforeAnswer, 1);
    assert.deepEqual(current.access, { viewed: 2, started: 2, submitAttempted: 1, validationFailed: 1,
      verificationFailed: 1, submitFailed: 1, saved: 1, resultsViewed: 1, exitedWithoutSubmitting: 1 });
    assert.equal(data.quizFlow.find((v) => v.quizVersion === '5.1.0').questions.length, 18);
    assert.equal(data.quizFlow.find((v) => v.quizVersion === '5.0.0').questions.length, 19);
    assert.equal(data.quizFlow.find((v) => v.quizVersion === 'unknown').questions.length, 4);
    const empty = await db.query("select public.get_quiz_flow_report(now() - interval '1 minute',now()) as data");
    assert.equal(empty.rows[0].data.length, 1);
    assert.equal(empty.rows[0].data[0].questions.length, 12);
    assert.equal(empty.rows[0].data[0].attempts, 0);
    const permissions = await db.query("select has_function_privilege('anon','public.get_quiz_flow_report(timestamptz,timestamptz)','EXECUTE') as anon, has_function_privilege('service_role','public.get_quiz_flow_report(timestamptz,timestamptz)','EXECUTE') as service");
    assert.deepEqual(permissions.rows[0], { anon: false, service: true });
    await assert.rejects(db.query('select public.get_quiz_flow_report(now(), now())'));
    console.log('PASS PostgreSQL: migration rerun, v6/v5/unknown separation, shared-session versions, retries, durable saves, form exits, backtracking, test exclusion, empty range, permissions');
  } finally { await db.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });

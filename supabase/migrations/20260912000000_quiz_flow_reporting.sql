-- Keep the established all-version CRM totals, and report questionnaire and
-- results-access friction separately for each immutable quiz attempt/version.
begin;

do $$
declare v_check text;
begin
  select pg_get_expr(conbin, conrelid) into v_check from pg_constraint
  where conrelid = 'public.growth_funnel_events'::regclass
    and conname = 'growth_funnel_events_name_allowed';
  if v_check is null then raise exception 'Missing growth event allow-list'; end if;
  if position('quiz_access_form_submit_attempted' in v_check) = 0 then
    alter table public.growth_funnel_events drop constraint growth_funnel_events_name_allowed;
    execute 'alter table public.growth_funnel_events add constraint growth_funnel_events_name_allowed check (('
      || v_check
      || ') or event_name in (''quiz_access_form_submit_attempted'', ''quiz_access_form_submit_failed'', ''quiz_access_form_verification_failed''))';
  end if;
end;
$$;

create or replace function public.get_quiz_flow_report(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql stable security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_from timestamptz := coalesce(p_from, '2020-01-01'::timestamptz);
  v_to timestamptz := coalesce(p_to, statement_timestamp());
  v_result jsonb;
begin
  if v_from >= v_to or v_to > statement_timestamp() + interval '10 minutes'
     or v_to - v_from > interval '10 years' then
    raise exception using errcode = '22023', message = 'Invalid quiz reporting range.';
  end if;
  with attempts as (
    select a.*, coalesce(a.quiz_version, 'unknown') as version
    from public.growth_quiz_attempts a
    join public.growth_funnel_sessions s on s.id = a.session_id
    where s.started_at >= v_from and s.started_at < v_to and not s.is_test
  ), versions as (
    select '6.0.0'::text as version, 12 as total_questions
    union
    select version, case version when '6.0.0' then 12 when '5.1.0' then 18
      when '5.0.0' then 19 else greatest(1, max(max_quiz_question)) end
    from attempts group by version
  ), activity as (
    select e.quiz_attempt_key, e.quiz_question,
      bool_or(e.event_name = 'quiz_question_answered') as answered
    from public.growth_funnel_events e
    join attempts a on a.attempt_key = e.quiz_attempt_key and a.session_id = e.session_id
    where e.event_name in ('quiz_question_viewed', 'quiz_question_answered')
    group by e.quiz_attempt_key, e.quiz_question
  ), question_rows as (
    select v.version, q.number,
      count(a.attempt_key)::integer as reached,
      count(a.attempt_key) filter (where coalesce(act.answered, false))::integer as answered,
      count(a.attempt_key) filter (where ex.exited and not coalesce(act.answered, false))::integer as before_answer,
      count(a.attempt_key) filter (where ex.exited and coalesce(act.answered, false))::integer as after_answer
    from versions v cross join lateral generate_series(1, v.total_questions) q(number)
    left join attempts a on a.version = v.version
      and greatest(a.max_quiz_question, a.last_quiz_question) >= q.number
    left join activity act on act.quiz_attempt_key = a.attempt_key and act.quiz_question = q.number
    cross join lateral (select
      coalesce(nullif(a.last_quiz_question, 0), a.max_quiz_question) = q.number
      and not a.quiz_completed
      and (a.explicit_exit or a.last_seen_at < statement_timestamp() - interval '30 minutes') as exited
    ) ex
    group by v.version, q.number
  ), flags as (
    select a.attempt_key,
      bool_or(e.event_name = 'quiz_access_form_viewed') as viewed,
      bool_or(e.event_name = 'quiz_access_form_started') as started,
      bool_or(e.event_name = 'quiz_access_form_submit_attempted') as submit_attempted,
      bool_or(e.event_name = 'quiz_access_form_validation_failed') as validation_failed,
      bool_or(e.event_name = 'quiz_access_form_verification_failed') as verification_failed,
      bool_or(e.event_name = 'quiz_access_form_submit_failed') as submit_failed,
      bool_or(e.event_name = 'results_viewed') as results_viewed
    from attempts a left join public.growth_funnel_events e
      on e.quiz_attempt_key = a.attempt_key and e.session_id = a.session_id
    group by a.attempt_key
  ), saved as (
    -- A client success event cannot establish a saved lead. Count only the
    -- durable first-party reference, once per attempt, including retry saves.
    select distinct a.attempt_key from attempts a
    join public.quiz_lead_links l on l.quiz_attempt_key = a.attempt_key
    where not l.is_test
  ), access_rows as (
    select v.version, v.total_questions, count(a.attempt_key)::integer as attempts,
      count(*) filter (where f.viewed)::integer as viewed,
      count(*) filter (where f.started)::integer as started,
      count(*) filter (where f.submit_attempted)::integer as submit_attempted,
      count(*) filter (where f.validation_failed)::integer as validation_failed,
      count(*) filter (where f.verification_failed)::integer as verification_failed,
      count(*) filter (where f.submit_failed)::integer as submit_failed,
      count(saved.attempt_key)::integer as saved,
      count(*) filter (where f.results_viewed)::integer as results_viewed,
      count(*) filter (where f.viewed and saved.attempt_key is null
        and (a.explicit_exit or a.last_seen_at < statement_timestamp() - interval '30 minutes'))::integer as exited
    from versions v left join attempts a on a.version = v.version
    left join flags f on f.attempt_key = a.attempt_key
    left join saved on saved.attempt_key = a.attempt_key
    group by v.version, v.total_questions
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'quizVersion', r.version, 'totalQuestions', r.total_questions, 'attempts', r.attempts,
    'questions', (select jsonb_agg(jsonb_build_object(
      'questionNumber', q.number, 'reached', q.reached, 'answered', q.answered,
      'exits', q.before_answer + q.after_answer,
      'exitsBeforeAnswer', q.before_answer, 'exitsAfterAnswer', q.after_answer,
      'reachRate', case when r.attempts = 0 then 0 else round(q.reached * 100.0 / r.attempts, 2) end,
      'answerRate', case when q.reached = 0 then 0 else round(q.answered * 100.0 / q.reached, 2) end,
      'exitRate', case when q.reached = 0 then 0 else round((q.before_answer + q.after_answer) * 100.0 / q.reached, 2) end
    ) order by q.number) from question_rows q where q.version = r.version),
    'access', jsonb_build_object(
      'viewed', r.viewed, 'started', r.started, 'submitAttempted', r.submit_attempted,
      'validationFailed', r.validation_failed, 'verificationFailed', r.verification_failed,
      'submitFailed', r.submit_failed, 'saved', r.saved, 'resultsViewed', r.results_viewed,
      'exitedWithoutSubmitting', r.exited
    )
  ) order by (r.version = '6.0.0') desc, r.version desc), '[]'::jsonb)
  into v_result from access_rows r;
  return v_result;
end;
$$;

revoke all on function public.get_quiz_flow_report(timestamptz,timestamptz) from public, anon, authenticated;
grant execute on function public.get_quiz_flow_report(timestamptz,timestamptz) to service_role;

-- Extend the existing report without replacing its mature cohort, consultation,
-- duplicate, test-exclusion or reporting-period logic. Reruns are safe.
do $$
declare
  v_definition text;
  v_before jsonb;
  v_after jsonb;
  v_from timestamptz := statement_timestamp() - interval '30 days';
  v_to timestamptz := statement_timestamp();
begin
  v_before := public.get_growth_dashboard(v_from, v_to);
  select pg_get_functiondef('public.get_growth_dashboard(timestamptz,timestamptz)'::regprocedure)
    into v_definition;
  if position('get_quiz_flow_report' in v_definition) = 0 then
    if position('return v_result;' in v_definition) = 0 then
      raise exception 'Could not extend growth dashboard';
    end if;
    v_definition := replace(v_definition, 'return v_result;',
      'return v_result || jsonb_build_object(''quizFlow'', public.get_quiz_flow_report(v_from, v_to));');
    v_definition := replace(v_definition, '''19 questions completed''', '''Questions finished''');
    execute v_definition;
  end if;
  v_after := public.get_growth_dashboard(v_from, v_to);
  if (v_before - 'quizFlow' - 'quizFunnel') is distinct from
     (v_after - 'quizFlow' - 'quizFunnel') then
    raise exception 'Quiz reporting update changed existing CRM metrics';
  end if;
  if jsonb_typeof(v_after -> 'quizFlow') is distinct from 'array' then
    raise exception 'Quiz version report was not attached';
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;

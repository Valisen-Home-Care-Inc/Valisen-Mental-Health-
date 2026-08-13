-- Internal tester classification for quiz/CRM data.
--
-- Test records remain protected and auditable, but are excluded from growth
-- and consultation statistics. A protected normalized-email registry lets
-- future submissions from a known tester classify themselves automatically.

begin;

set local search_path = pg_catalog, public, extensions;

create table public.growth_test_identities (
  normalized_email text primary key,
  label text not null default 'Internal tester',
  created_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp(),
  constraint growth_test_identities_email_valid check (
    char_length(normalized_email) between 3 and 254 and
    normalized_email = lower(btrim(normalized_email)) and
    normalized_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  constraint growth_test_identities_label_valid check (
    char_length(label) between 1 and 80
  )
);

alter table public.growth_funnel_sessions
  add column is_test boolean not null default false,
  add column test_marked_at timestamptz;

alter table public.quiz_lead_links
  add column is_test boolean not null default false,
  add column test_marked_at timestamptz;

alter table public.quiz_result_submissions
  add column is_test boolean not null default false,
  add column test_marked_at timestamptz;

alter table public.consultation_leads
  add column is_test boolean not null default false,
  add column test_marked_at timestamptz;

alter table public.consultation_requests
  add column is_test boolean not null default false,
  add column test_marked_at timestamptz;

create index growth_funnel_sessions_test_idx
  on public.growth_funnel_sessions (is_test, started_at desc);
create index quiz_lead_links_test_idx
  on public.quiz_lead_links (is_test, created_at desc);
create index quiz_result_submissions_test_idx
  on public.quiz_result_submissions (is_test, created_at desc);
create index consultation_leads_test_idx
  on public.consultation_leads (is_test, submitted_at desc);
create index consultation_requests_test_idx
  on public.consultation_requests (is_test, submitted_at desc);

create or replace function public.apply_growth_test_identity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
begin
  if new.email is not null and exists (
    select 1
    from public.growth_test_identities as identity
    where identity.normalized_email = lower(btrim(new.email))
  ) then
    new.is_test := true;
    new.test_marked_at := coalesce(new.test_marked_at, transaction_timestamp());
  end if;
  return new;
end;
$$;

create trigger quiz_result_submission_test_identity
before insert or update of email on public.quiz_result_submissions
for each row execute function public.apply_growth_test_identity();

create trigger consultation_lead_test_identity
before insert or update of email on public.consultation_leads
for each row execute function public.apply_growth_test_identity();

create trigger consultation_request_test_identity
before insert or update of email on public.consultation_requests
for each row execute function public.apply_growth_test_identity();

create or replace function public.apply_quiz_link_test_flag()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_session_id uuid;
begin
  select attempt.session_id into v_session_id
  from public.growth_quiz_attempts as attempt
  where attempt.attempt_key = new.quiz_attempt_key;

  if exists (
    select 1 from public.quiz_result_submissions as submission
    where submission.reference_id = new.reference_id and submission.is_test
  ) or exists (
    select 1 from public.growth_funnel_sessions as session
    where session.is_test and (
      session.session_key = new.funnel_session_key or session.id = v_session_id
    )
  ) then
    new.is_test := true;
    new.test_marked_at := coalesce(new.test_marked_at, transaction_timestamp());
  end if;
  return new;
end;
$$;

create trigger quiz_lead_link_test_flag
before insert or update of reference_id, funnel_session_key, quiz_attempt_key
on public.quiz_lead_links
for each row execute function public.apply_quiz_link_test_flag();

create or replace function public.propagate_quiz_link_test_flag()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
begin
  if new.is_test then
    update public.growth_funnel_sessions as session
    set is_test = true,
        test_marked_at = coalesce(session.test_marked_at, transaction_timestamp())
    where session.session_key = new.funnel_session_key
       or session.id = (
         select attempt.session_id
         from public.growth_quiz_attempts as attempt
         where attempt.attempt_key = new.quiz_attempt_key
       );
  end if;
  return null;
end;
$$;

create trigger quiz_lead_link_test_propagation
after insert or update of is_test on public.quiz_lead_links
for each row execute function public.propagate_quiz_link_test_flag();

create or replace function public.set_quiz_test_flag(
  p_session_key text,
  p_reference_id text,
  p_is_test boolean,
  p_label text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_email text;
  v_label text := coalesce(nullif(btrim(p_label), ''), 'Internal tester');
  v_session_count integer := 0;
  v_submission_count integer := 0;
  v_consultation_count integer := 0;
begin
  if p_is_test is null or
     (p_session_key is null and p_reference_id is null) or
     (p_session_key is not null and p_session_key !~ '^fs-[A-Za-z0-9-]{16,90}$') or
     (p_reference_id is not null and p_reference_id !~ '^VQ-[A-Za-z0-9_-]{4,80}$') or
     char_length(v_label) not between 1 and 80 then
    raise exception using errcode = '22023', message = 'Invalid quiz test flag request.';
  end if;

  select lower(btrim(submission.email)) into v_email
  from public.quiz_result_submissions as submission
  where submission.reference_id = p_reference_id
     or submission.reference_id in (
       select link.reference_id
       from public.quiz_lead_links as link
       where link.funnel_session_key = p_session_key
          or link.quiz_attempt_key in (
            select attempt.attempt_key
            from public.growth_quiz_attempts as attempt
            join public.growth_funnel_sessions as session on session.id = attempt.session_id
            where session.session_key = p_session_key
          )
     )
  order by submission.created_at desc
  limit 1;

  if p_is_test and v_email is not null then
    insert into public.growth_test_identities (normalized_email, label)
    values (v_email, v_label)
    on conflict (normalized_email) do update
    set label = excluded.label, updated_at = transaction_timestamp();
  elsif not p_is_test and v_email is not null then
    delete from public.growth_test_identities as identity
    where identity.normalized_email = v_email;
  end if;

  update public.quiz_result_submissions as submission
  set is_test = p_is_test,
      test_marked_at = case when p_is_test then transaction_timestamp() else null end
  where submission.reference_id = p_reference_id
     or (v_email is not null and lower(btrim(submission.email)) = v_email);
  get diagnostics v_submission_count = row_count;

  update public.quiz_lead_links as link
  set is_test = p_is_test,
      test_marked_at = case when p_is_test then transaction_timestamp() else null end
  where link.reference_id = p_reference_id
     or link.reference_id in (
       select submission.reference_id
       from public.quiz_result_submissions as submission
       where v_email is not null and lower(btrim(submission.email)) = v_email
     )
     or link.funnel_session_key = p_session_key
     or link.quiz_attempt_key in (
       select attempt.attempt_key
       from public.growth_quiz_attempts as attempt
       join public.growth_funnel_sessions as session on session.id = attempt.session_id
       where session.session_key = p_session_key
     );

  update public.growth_funnel_sessions as session
  set is_test = p_is_test,
      test_marked_at = case when p_is_test then transaction_timestamp() else null end
  where session.session_key = p_session_key
     or session.session_key in (
       select coalesce(attempt_session.session_key, link.funnel_session_key)
       from public.quiz_lead_links as link
       left join public.growth_quiz_attempts as attempt
         on attempt.attempt_key = link.quiz_attempt_key
       left join public.growth_funnel_sessions as attempt_session
         on attempt_session.id = attempt.session_id
       where link.reference_id = p_reference_id
          or link.reference_id in (
            select submission.reference_id
            from public.quiz_result_submissions as submission
            where v_email is not null and lower(btrim(submission.email)) = v_email
          )
     );
  get diagnostics v_session_count = row_count;

  update public.consultation_requests as request
  set is_test = p_is_test,
      test_marked_at = case when p_is_test then transaction_timestamp() else null end
  where (v_email is not null and lower(btrim(request.email)) = v_email)
     or request.quiz_reference_id = p_reference_id
     or request.funnel_session_key = p_session_key
     or request.quiz_reference_id in (
       select submission.reference_id
       from public.quiz_result_submissions as submission
       where v_email is not null and lower(btrim(submission.email)) = v_email
     );
  get diagnostics v_consultation_count = row_count;

  update public.consultation_leads as lead
  set is_test = p_is_test,
      test_marked_at = case when p_is_test then transaction_timestamp() else null end,
      row_version = lead.row_version + 1,
      updated_at = transaction_timestamp()
  where (v_email is not null and lower(btrim(lead.email)) = v_email)
     or lead.quiz_reference_id = p_reference_id
     or lead.funnel_session_key = p_session_key
     or lead.quiz_reference_id in (
       select submission.reference_id
       from public.quiz_result_submissions as submission
       where v_email is not null and lower(btrim(submission.email)) = v_email
     );

  if v_email is null and v_session_count = 0 and v_submission_count = 0 then
    raise exception using errcode = 'P0002', message = 'Quiz record was not found.';
  end if;

  return jsonb_build_object(
    'accepted', true,
    'isTest', p_is_test,
    'scope', case when v_email is null then 'journey' else 'tester_identity' end,
    'sessionsUpdated', v_session_count,
    'submissionsUpdated', v_submission_count,
    'consultationsUpdated', v_consultation_count
  );
end;
$$;

create or replace function public.get_quiz_test_candidates(p_limit integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 250), 1), 500);
  v_result jsonb;
begin
  with submitted as (
    select
      submission.reference_id as record_key,
      'lead'::text as record_kind,
      submission.reference_id,
      coalesce(attempt_session.session_key, link.funnel_session_key) as session_key,
      submission.first_name,
      submission.email,
      coalesce(attempt_session.started_at, session.started_at, submission.created_at) as started_at,
      coalesce(attempt_session.last_seen_at, session.last_seen_at, submission.updated_at) as last_seen_at,
      coalesce(attempt_session.max_quiz_question, session.max_quiz_question, 0) as max_quiz_question,
      coalesce(attempt_session.quiz_completed, session.quiz_completed, false) as quiz_completed,
      coalesce(attempt_count.value, 0) as attempt_count,
      (submission.is_test or coalesce(link.is_test, false) or coalesce(session.is_test, false) or coalesce(attempt_session.is_test, false)) as is_test,
      coalesce(submission.test_marked_at, link.test_marked_at, session.test_marked_at, attempt_session.test_marked_at) as test_marked_at,
      identity.label as test_label
    from public.quiz_result_submissions as submission
    left join public.quiz_lead_links as link on link.reference_id = submission.reference_id
    left join public.growth_funnel_sessions as session on session.session_key = link.funnel_session_key
    left join public.growth_quiz_attempts as attempt on attempt.attempt_key = link.quiz_attempt_key
    left join public.growth_funnel_sessions as attempt_session on attempt_session.id = attempt.session_id
    left join public.growth_test_identities as identity
      on identity.normalized_email = lower(btrim(submission.email))
    left join lateral (
      select count(*)::integer as value
      from public.growth_quiz_attempts as item
      where item.session_id = coalesce(attempt_session.id, session.id)
    ) as attempt_count on true
  ),
  anonymous as (
    select
      session.session_key as record_key,
      'attempt'::text as record_kind,
      null::text as reference_id,
      session.session_key,
      null::text as first_name,
      null::text as email,
      session.started_at,
      session.last_seen_at,
      session.max_quiz_question,
      session.quiz_completed,
      count(attempt.attempt_key)::integer as attempt_count,
      session.is_test,
      session.test_marked_at,
      null::text as test_label
    from public.growth_funnel_sessions as session
    left join public.growth_quiz_attempts as attempt on attempt.session_id = session.id
    where (session.max_quiz_question > 0 or session.quiz_started)
      and not exists (
        select 1 from public.quiz_lead_links as link
        where link.funnel_session_key = session.session_key
           or link.quiz_attempt_key in (
             select child.attempt_key from public.growth_quiz_attempts as child
             where child.session_id = session.id
           )
      )
    group by session.id
  ),
  candidates as (
    select * from submitted
    union all
    select * from anonymous
  ),
  selected as (
    select * from candidates
    order by is_test desc, last_seen_at desc, record_key
    limit v_limit
  )
  select jsonb_build_object(
    'generatedAt', statement_timestamp(),
    'flaggedCount', (select count(*)::integer from candidates where is_test),
    'testerIdentityCount', (select count(*)::integer from public.growth_test_identities),
    'records', coalesce((
      select jsonb_agg(jsonb_build_object(
        'recordKey', record.record_key,
        'recordKind', record.record_kind,
        'referenceId', record.reference_id,
        'sessionId', record.session_key,
        'firstName', record.first_name,
        'email', record.email,
        'startedAt', record.started_at,
        'lastSeenAt', record.last_seen_at,
        'maxQuizQuestion', record.max_quiz_question,
        'quizCompleted', record.quiz_completed,
        'attemptCount', record.attempt_count,
        'isTest', record.is_test,
        'testMarkedAt', record.test_marked_at,
        'testLabel', record.test_label
      ) order by record.is_test desc, record.last_seen_at desc, record.record_key)
      from selected as record
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- Keep the existing dashboard contracts intact while excluding test records
-- at their cohort roots. Abort loudly if a future migration changes those
-- known definitions instead of silently leaving test traffic in statistics.
do $$
declare
  v_definition text;
  v_original text;
begin
  select pg_get_functiondef(
    'public.get_growth_dashboard(timestamptz,timestamptz)'::regprocedure
  ) into v_definition;
  v_original := v_definition;
  v_definition := replace(
    v_definition,
    'where session.started_at >= v_from and session.started_at < v_to',
    'where session.started_at >= v_from and session.started_at < v_to' || E'\n      and not session.is_test'
  );
  if v_definition = v_original then
    raise exception 'Could not install quiz test-data exclusion in get_growth_dashboard.';
  end if;
  execute v_definition;

  select pg_get_functiondef(
    'public.get_consultation_manager(timestamptz,timestamptz,text,text,text,text,integer,integer)'::regprocedure
  ) into v_definition;
  v_original := v_definition;
  v_definition := replace(
    v_definition,
    'where request.submitted_at >= v_from and request.submitted_at < v_to',
    'where request.submitted_at >= v_from and request.submitted_at < v_to' || E'\n      and not request.is_test'
  );
  v_definition := replace(
    v_definition,
    'where lead.submitted_at >= v_from and lead.submitted_at < v_to',
    'where lead.submitted_at >= v_from and lead.submitted_at < v_to' || E'\n      and not lead.is_test'
  );
  v_definition := replace(
    v_definition,
    'where (p_workflow_status is null or lead.workflow_status = p_workflow_status)',
    'where not lead.is_test' || E'\n      and (p_workflow_status is null or lead.workflow_status = p_workflow_status)'
  );
  if v_definition = v_original then
    raise exception 'Could not install test-data exclusion in get_consultation_manager.';
  end if;
  execute v_definition;
end;
$$;

alter table public.growth_test_identities enable row level security;
revoke all on table public.growth_test_identities from public, anon, authenticated, service_role;

revoke all on function public.apply_growth_test_identity() from public, anon, authenticated;
revoke all on function public.apply_quiz_link_test_flag() from public, anon, authenticated;
revoke all on function public.propagate_quiz_link_test_flag() from public, anon, authenticated;
revoke all on function public.set_quiz_test_flag(text, text, boolean, text) from public, anon, authenticated;
revoke all on function public.get_quiz_test_candidates(integer) from public, anon, authenticated;

grant execute on function public.set_quiz_test_flag(text, text, boolean, text) to service_role;
grant execute on function public.get_quiz_test_candidates(integer) to service_role;

commit;

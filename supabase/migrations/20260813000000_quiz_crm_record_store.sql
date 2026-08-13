-- Follow-up for installations that applied the recovery migration before the
-- quiz payload store was moved fully into the CRM. Safe after the complete
-- 20260812000000 migration as well.

alter table public.quiz_result_submissions
  add column if not exists submission_token_hash text,
  add column if not exists lead_record jsonb;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'quiz_result_submissions_lead_record_valid'
      and conrelid = 'public.quiz_result_submissions'::regclass
  ) then
    alter table public.quiz_result_submissions
      add constraint quiz_result_submissions_lead_record_valid check (
        (submission_token_hash is null or submission_token_hash ~ '^[a-f0-9]{64}$') and
        (lead_record is null or (
          jsonb_typeof(lead_record) = 'array' and
          jsonb_array_length(lead_record) = 58
        ))
      );
  end if;
end;
$$;

create unique index if not exists quiz_result_submissions_token_hash_idx
  on public.quiz_result_submissions (submission_token_hash)
  where submission_token_hash is not null;

create or replace function public.save_quiz_lead_record(
  p_client_submission_id text,
  p_reference_id text,
  p_submission_token_hash text,
  p_lead_record jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_submission public.quiz_result_submissions%rowtype;
  v_answers jsonb;
begin
  if p_client_submission_id is null or
     p_client_submission_id !~ '^[A-Za-z0-9-]{8,64}$' or
     p_reference_id is null or p_reference_id !~ '^VQ-[A-Za-z0-9_-]{4,80}$' or
     p_submission_token_hash is null or p_submission_token_hash !~ '^[a-f0-9]{64}$' or
     p_lead_record is null or jsonb_typeof(p_lead_record) <> 'array' or
     jsonb_array_length(p_lead_record) <> 58 or
     p_lead_record->>0 is distinct from p_reference_id or
     p_lead_record->>1 is distinct from p_submission_token_hash or
     p_lead_record->>2 is distinct from p_client_submission_id or
     jsonb_typeof(p_lead_record->12) <> 'string' then
    raise exception using errcode = '22023', message = 'Invalid quiz CRM record.';
  end if;

  begin
    v_answers := (p_lead_record->>12)::jsonb;
  exception when others then
    raise exception using errcode = '22023', message = 'Invalid quiz answer record.';
  end;
  if jsonb_typeof(v_answers) <> 'object' or v_answers ? 'safety' then
    raise exception using errcode = '22023', message = 'Invalid quiz answer record.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'quiz-result-submission:' || p_client_submission_id,
      0
    )
  );
  select submission.* into v_submission
  from public.quiz_result_submissions as submission
  where submission.client_submission_id = p_client_submission_id
  for update;
  if not found or v_submission.reference_id <> p_reference_id or
     v_submission.snapshot_captured_at is null then
    raise exception using errcode = 'P0002', message = 'Quiz CRM identity not found.';
  end if;
  if v_submission.lead_record is not null and
     v_submission.lead_record is distinct from p_lead_record then
    raise exception using errcode = '23505', message = 'Quiz CRM record already differs.';
  end if;

  update public.quiz_result_submissions as submission
  set submission_token_hash = p_submission_token_hash,
      lead_record = coalesce(submission.lead_record, p_lead_record),
      updated_at = transaction_timestamp()
  where submission.id = v_submission.id
  returning * into v_submission;

  return jsonb_build_object('leadRecord', v_submission.lead_record);
end;
$$;

create or replace function public.get_quiz_lead_record(
  p_client_submission_id text,
  p_submission_token_hash text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_submission public.quiz_result_submissions%rowtype;
begin
  if pg_catalog.num_nonnulls(
       nullif(btrim(p_client_submission_id), ''),
       nullif(btrim(p_submission_token_hash), '')
     ) <> 1 or
     (p_client_submission_id is not null and
       p_client_submission_id !~ '^[A-Za-z0-9-]{8,64}$') or
     (p_submission_token_hash is not null and
       p_submission_token_hash !~ '^[a-f0-9]{64}$') then
    raise exception using errcode = '22023', message = 'Invalid quiz CRM lookup.';
  end if;

  select submission.* into v_submission
  from public.quiz_result_submissions as submission
  where (
    p_client_submission_id is not null and
    submission.client_submission_id = p_client_submission_id
  ) or (
    p_submission_token_hash is not null and
    submission.submission_token_hash = p_submission_token_hash
  );
  if not found or v_submission.lead_record is null then return null; end if;
  return jsonb_build_object('leadRecord', v_submission.lead_record);
end;
$$;

create or replace function public.patch_quiz_lead_record(
  p_reference_id text,
  p_updates jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_submission public.quiz_result_submissions%rowtype;
  v_record jsonb;
  v_key text;
  v_value jsonb;
begin
  if p_reference_id is null or p_reference_id !~ '^VQ-[A-Za-z0-9_-]{4,80}$' or
     p_updates is null or jsonb_typeof(p_updates) <> 'object' or
     (select count(*) from jsonb_object_keys(p_updates)) > 30 or
     exists (
       select 1
       from jsonb_object_keys(p_updates) as key(value)
       where case
         when key.value ~ '^[0-9]{1,2}$' then key.value::integer not in (
             1, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28,
             29, 30, 31, 32, 33, 34, 37, 38, 39, 40, 41, 42,
             43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54,
             55, 56, 57
           )
         else true
       end
     ) then
    raise exception using errcode = '22023', message = 'Invalid quiz CRM patch.';
  end if;
  if p_updates ? '1' and p_updates->>'1' !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'Invalid quiz token hash.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('quiz-lead-record:' || p_reference_id, 0)
  );
  select submission.* into v_submission
  from public.quiz_result_submissions as submission
  where submission.reference_id = p_reference_id
  for update;
  if not found or v_submission.lead_record is null then
    raise exception using errcode = 'P0002', message = 'Quiz CRM record not found.';
  end if;

  v_record := v_submission.lead_record;
  for v_key, v_value in select key, value from jsonb_each(p_updates)
  loop
    v_record := jsonb_set(v_record, array[v_key], v_value, false);
  end loop;

  update public.quiz_result_submissions as submission
  set lead_record = v_record,
      submission_token_hash = case
        when p_updates ? '1' then p_updates->>'1'
        else submission.submission_token_hash
      end,
      updated_at = transaction_timestamp()
  where submission.id = v_submission.id
  returning * into v_submission;

  return jsonb_build_object('leadRecord', v_submission.lead_record);
end;
$$;

revoke all on function public.save_quiz_lead_record(text, text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.get_quiz_lead_record(text, text)
  from public, anon, authenticated;
revoke all on function public.patch_quiz_lead_record(text, jsonb)
  from public, anon, authenticated;

grant execute on function public.save_quiz_lead_record(text, text, text, jsonb)
  to service_role;
grant execute on function public.get_quiz_lead_record(text, text)
  to service_role;
grant execute on function public.patch_quiz_lead_record(text, jsonb)
  to service_role;

-- Durable quiz-submission recovery records and operator alerts.
--
-- A valid, consented submission is snapshotted in the CRM in the same
-- transaction that assigns its stable VQ reference. The complete operational
-- lead record also lives here; email is notification only.

alter table public.quiz_result_submissions
  add column first_name text,
  add column email text,
  add column phone text,
  add column consented_at timestamptz,
  add column privacy_text text,
  add column privacy_text_version text,
  add column quiz_version text,
  add column scoring_version text,
  add column answers jsonb,
  add column outcome jsonb,
  add column result_category text,
  add column score_band text,
  add column match_data jsonb,
  add column recommended_therapist_slug text,
  add column recommended_therapist_name text,
  add column intent text,
  add column attribution jsonb,
  add column submission_token_hash text,
  add column lead_record jsonb,
  add column snapshot_captured_at timestamptz,
  add column last_failure_stage text,
  add column last_failure_code text,
  add column last_failure_at timestamptz,
  add column failure_alert_status text not null default 'not_needed',
  add column failure_alert_attempt_count integer not null default 0,
  add column failure_alert_sent_at timestamptz,
  add constraint quiz_result_submissions_snapshot_valid check (
    (first_name is null or char_length(first_name) between 1 and 80) and
    (email is null or char_length(email) <= 254) and
    (phone is null or char_length(phone) <= 30) and
    (privacy_text is null or char_length(privacy_text) <= 5000) and
    (privacy_text_version is null or char_length(privacy_text_version) <= 80) and
    (quiz_version is null or char_length(quiz_version) <= 40) and
    (scoring_version is null or char_length(scoring_version) <= 40) and
    (result_category is null or char_length(result_category) <= 160) and
    (score_band is null or char_length(score_band) <= 160) and
    (recommended_therapist_slug is null or recommended_therapist_slug ~ '^[a-z0-9-]{2,80}$') and
    (recommended_therapist_name is null or char_length(recommended_therapist_name) <= 160) and
    (intent is null or intent in (
      'exploring', 'see_recommended_therapist', 'brief_consultation',
      'ready_to_speak'
    )) and
    (answers is null or jsonb_typeof(answers) = 'object') and
    (outcome is null or jsonb_typeof(outcome) = 'object') and
    (match_data is null or jsonb_typeof(match_data) = 'object') and
    (attribution is null or jsonb_typeof(attribution) = 'object')
  ),
  add constraint quiz_result_submissions_lead_record_valid check (
    (submission_token_hash is null or submission_token_hash ~ '^[a-f0-9]{64}$') and
    (lead_record is null or (
      jsonb_typeof(lead_record) = 'array' and
      jsonb_array_length(lead_record) = 58
    ))
  ),
  add constraint quiz_result_submissions_failure_valid check (
    (last_failure_stage is null or last_failure_stage ~ '^[a-z0-9_]{3,80}$') and
    (last_failure_code is null or last_failure_code ~ '^[a-z0-9_]{3,80}$') and
    failure_alert_status in ('not_needed', 'sending', 'sent', 'failed') and
    failure_alert_attempt_count >= 0 and
    (
      (failure_alert_status = 'sent' and failure_alert_sent_at is not null) or
      (failure_alert_status <> 'sent')
    )
  );

create index quiz_result_submissions_recovery_queue_idx
  on public.quiz_result_submissions (sheet_status, updated_at desc)
  where sheet_status <> 'ready';

create unique index quiz_result_submissions_token_hash_idx
  on public.quiz_result_submissions (submission_token_hash)
  where submission_token_hash is not null;

comment on column public.quiz_result_submissions.answers is
  'Protected consented recovery copy. The raw safety-check answer is prohibited and removed before this RPC is called.';
comment on column public.quiz_result_submissions.failure_alert_status is
  'Operator email status for a CRM lead-finalization failure. The protected recovery snapshot remains authoritative even if SMTP also fails.';

create or replace function public.claim_quiz_result_submission_v2(
  p_client_submission_id text,
  p_payload_hash text,
  p_existing_reference_id text,
  p_lease_seconds integer,
  p_first_name text,
  p_email text,
  p_phone text,
  p_consented_at timestamptz,
  p_privacy_text text,
  p_privacy_text_version text,
  p_quiz_version text,
  p_scoring_version text,
  p_answers jsonb,
  p_outcome jsonb,
  p_result_category text,
  p_score_band text,
  p_match jsonb,
  p_recommended_therapist_slug text,
  p_recommended_therapist_name text,
  p_intent text,
  p_attribution jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_claim jsonb;
  v_submission public.quiz_result_submissions%rowtype;
begin
  if p_first_name is null or char_length(btrim(p_first_name)) not between 1 and 80 or
     p_email is null or char_length(btrim(p_email)) > 254 or
     lower(btrim(p_email)) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or
     p_phone is null or char_length(btrim(p_phone)) not between 7 and 30 or
     p_consented_at is null or
     p_consented_at > statement_timestamp() + interval '10 minutes' or
     p_privacy_text is null or char_length(p_privacy_text) not between 1 and 5000 or
     p_privacy_text_version is null or char_length(btrim(p_privacy_text_version)) not between 1 and 80 or
     p_quiz_version is null or char_length(btrim(p_quiz_version)) not between 1 and 40 or
     p_scoring_version is null or char_length(btrim(p_scoring_version)) not between 1 and 40 or
     p_answers is null or jsonb_typeof(p_answers) <> 'object' or p_answers ? 'safety' or
     octet_length(p_answers::text) > 60000 or
     p_outcome is null or jsonb_typeof(p_outcome) <> 'object' or octet_length(p_outcome::text) > 30000 or
     p_match is null or jsonb_typeof(p_match) <> 'object' or octet_length(p_match::text) > 30000 or
     p_result_category is null or char_length(btrim(p_result_category)) not between 1 and 160 or
     p_score_band is null or char_length(btrim(p_score_band)) not between 1 and 160 or
     (p_recommended_therapist_slug is not null and
       p_recommended_therapist_slug !~ '^[a-z0-9-]{2,80}$') or
     (p_recommended_therapist_name is not null and
       char_length(btrim(p_recommended_therapist_name)) not between 1 and 160) or
     p_intent is null or p_intent not in (
       'exploring', 'see_recommended_therapist', 'brief_consultation',
       'ready_to_speak'
     ) or
     p_attribution is null or jsonb_typeof(p_attribution) <> 'object' or
     octet_length(p_attribution::text) > 3000 then
    raise exception using errcode = '22023', message = 'Invalid quiz recovery snapshot.';
  end if;

  -- The original function provides the fenced, idempotent storage claim. This
  -- call and the snapshot update share one database transaction, so a valid
  -- reference can never be committed without its recovery fields.
  v_claim := public.claim_quiz_result_submission(
    p_client_submission_id,
    p_payload_hash,
    p_existing_reference_id,
    p_lease_seconds
  );

  update public.quiz_result_submissions as submission
  set first_name = coalesce(submission.first_name, btrim(p_first_name)),
      email = coalesce(submission.email, lower(btrim(p_email))),
      phone = coalesce(submission.phone, btrim(p_phone)),
      consented_at = coalesce(submission.consented_at, p_consented_at),
      privacy_text = coalesce(submission.privacy_text, p_privacy_text),
      privacy_text_version = coalesce(submission.privacy_text_version, btrim(p_privacy_text_version)),
      quiz_version = coalesce(submission.quiz_version, btrim(p_quiz_version)),
      scoring_version = coalesce(submission.scoring_version, btrim(p_scoring_version)),
      answers = coalesce(submission.answers, p_answers),
      outcome = coalesce(submission.outcome, p_outcome),
      result_category = coalesce(submission.result_category, btrim(p_result_category)),
      score_band = coalesce(submission.score_band, btrim(p_score_band)),
      match_data = coalesce(submission.match_data, p_match),
      recommended_therapist_slug = coalesce(
        submission.recommended_therapist_slug,
        p_recommended_therapist_slug
      ),
      recommended_therapist_name = coalesce(
        submission.recommended_therapist_name,
        nullif(btrim(p_recommended_therapist_name), '')
      ),
      intent = coalesce(submission.intent, p_intent),
      attribution = coalesce(submission.attribution, p_attribution),
      snapshot_captured_at = coalesce(
        submission.snapshot_captured_at,
        transaction_timestamp()
      ),
      updated_at = transaction_timestamp()
  where submission.client_submission_id = p_client_submission_id
    and submission.payload_hash = p_payload_hash
  returning * into v_submission;

  if not found then
    raise exception using errcode = 'P0002', message = 'Quiz recovery registry row not found.';
  end if;

  return v_claim || jsonb_build_object(
    'snapshotCaptured', true,
    'snapshotConsentedAt', v_submission.consented_at
  );
end;
$$;

create or replace function public.record_quiz_result_submission_failure(
  p_client_submission_id text,
  p_claim_token uuid,
  p_failure_stage text,
  p_failure_code text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_submission public.quiz_result_submissions%rowtype;
  v_alert_required boolean := false;
begin
  if p_client_submission_id is null or
     p_client_submission_id !~ '^[A-Za-z0-9-]{8,64}$' or
     p_claim_token is null or
     p_failure_stage is null or p_failure_stage !~ '^[a-z0-9_]{3,80}$' or
     p_failure_code is null or p_failure_code !~ '^[a-z0-9_]{3,80}$' then
    raise exception using errcode = '22023', message = 'Invalid quiz storage failure.';
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
  if not found then
    raise exception using errcode = 'P0002', message = 'Quiz result submission not found.';
  end if;

  if v_submission.storage_claim_token is distinct from p_claim_token then
    return jsonb_build_object(
      'accepted', false,
      'staleClaim', true,
      'clientSubmissionId', v_submission.client_submission_id,
      'referenceId', v_submission.reference_id,
      'storageStatus', v_submission.sheet_status,
      'attemptCount', v_submission.storage_attempt_count,
      'alertRequired', false,
      'alertAttemptCount', v_submission.failure_alert_attempt_count
    );
  end if;

  v_alert_required := v_submission.failure_alert_status <> 'sent';
  update public.quiz_result_submissions as submission
  set sheet_status = 'failed',
      sheet_row_number = null,
      storage_claim_token = null,
      storage_claimed_at = null,
      storage_claim_expires_at = null,
      last_failure_stage = p_failure_stage,
      last_failure_code = p_failure_code,
      last_failure_at = transaction_timestamp(),
      failure_alert_status = case
        when v_alert_required then 'sending'
        else submission.failure_alert_status
      end,
      failure_alert_attempt_count = case
        when v_alert_required and submission.failure_alert_attempt_count < 2147483647
          then submission.failure_alert_attempt_count + 1
        else submission.failure_alert_attempt_count
      end,
      updated_at = transaction_timestamp()
  where submission.id = v_submission.id
  returning * into v_submission;

  return jsonb_build_object(
    'accepted', true,
    'staleClaim', false,
    'clientSubmissionId', v_submission.client_submission_id,
    'referenceId', v_submission.reference_id,
    'storageStatus', v_submission.sheet_status,
    'attemptCount', v_submission.storage_attempt_count,
    'alertRequired', v_alert_required,
    'alertAttemptCount', v_submission.failure_alert_attempt_count
  );
end;
$$;

create or replace function public.complete_quiz_result_failure_alert(
  p_client_submission_id text,
  p_alert_status text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_submission public.quiz_result_submissions%rowtype;
begin
  if p_client_submission_id is null or
     p_client_submission_id !~ '^[A-Za-z0-9-]{8,64}$' or
     p_alert_status not in ('sent', 'failed') then
    raise exception using errcode = '22023', message = 'Invalid quiz failure alert completion.';
  end if;

  update public.quiz_result_submissions as submission
  set failure_alert_status = case
        when submission.failure_alert_status = 'sent' then 'sent'
        else p_alert_status
      end,
      failure_alert_sent_at = case
        when submission.failure_alert_status = 'sent' then submission.failure_alert_sent_at
        when p_alert_status = 'sent' then transaction_timestamp()
        else null
      end,
      updated_at = transaction_timestamp()
  where submission.client_submission_id = p_client_submission_id
  returning * into v_submission;

  if not found then
    raise exception using errcode = 'P0002', message = 'Quiz result submission not found.';
  end if;

  return jsonb_build_object(
    'accepted', true,
    'clientSubmissionId', v_submission.client_submission_id,
    'referenceId', v_submission.reference_id,
    'alertStatus', v_submission.failure_alert_status,
    'alertAttemptCount', v_submission.failure_alert_attempt_count,
    'alertSentAt', v_submission.failure_alert_sent_at
  );
end;
$$;

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

create or replace function public.get_quiz_submission_recovery_queue(
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 250);
begin
  return (
    with unresolved as (
      select submission.*
      from public.quiz_result_submissions as submission
      where submission.sheet_status <> 'ready'
      order by submission.updated_at desc
      limit v_limit
    )
    select jsonb_build_object(
      'generatedAt', transaction_timestamp(),
      'pendingCount', (
        select count(*)::integer
        from public.quiz_result_submissions
        where sheet_status = 'pending'
      ),
      'failedCount', (
        select count(*)::integer
        from public.quiz_result_submissions
        where sheet_status = 'failed'
      ),
      'alertFailureCount', (
        select count(*)::integer
        from public.quiz_result_submissions
        where sheet_status = 'failed' and failure_alert_status = 'failed'
      ),
      'submissions', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'referenceId', row.reference_id,
            'clientSubmissionId', row.client_submission_id,
            'storageStatus', row.sheet_status,
            'sheetRowNumber', row.sheet_row_number,
            'storageAttemptCount', row.storage_attempt_count,
            'createdAt', row.created_at,
            'updatedAt', row.updated_at,
            'firstName', row.first_name,
            'email', row.email,
            'phone', row.phone,
            'consentedAt', row.consented_at,
            'privacyText', row.privacy_text,
            'privacyTextVersion', row.privacy_text_version,
            'quizVersion', row.quiz_version,
            'scoringVersion', row.scoring_version,
            'answers', row.answers,
            'outcome', row.outcome,
            'resultCategory', row.result_category,
            'scoreBand', row.score_band,
            'match', row.match_data,
            'recommendedTherapistSlug', row.recommended_therapist_slug,
            'recommendedTherapistName', row.recommended_therapist_name,
            'intent', row.intent,
            'attribution', row.attribution,
            'lastFailureStage', row.last_failure_stage,
            'lastFailureCode', row.last_failure_code,
            'lastFailureAt', row.last_failure_at,
            'failureAlertStatus', row.failure_alert_status,
            'failureAlertAttempts', row.failure_alert_attempt_count,
            'failureAlertSentAt', row.failure_alert_sent_at
          )
          order by row.updated_at desc
        )
        from unresolved as row
      ), '[]'::jsonb)
    )
  );
end;
$$;

-- Funnel events are delivered from a browser outbox and can arrive just after
-- the lead submission. Keep the privacy-safe keys immediately and let joins
-- become complete once the idempotent event batch lands, instead of rejecting
-- an otherwise saved lead and showing the visitor a false storage failure.
create or replace function public.record_quiz_lead_link(
  p_reference_id text,
  p_funnel_session_key text,
  p_quiz_attempt_key text,
  p_quiz_version text,
  p_scoring_version text,
  p_intent text,
  p_recommended_therapist text,
  p_consented_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_link public.quiz_lead_links%rowtype;
  v_existing_link public.quiz_lead_links%rowtype;
begin
  if p_reference_id is null or p_reference_id !~ '^VQ-[A-Za-z0-9_-]{4,80}$' or
     (p_funnel_session_key is not null and p_funnel_session_key !~ '^fs-[A-Za-z0-9-]{16,90}$') or
     (p_quiz_attempt_key is not null and p_quiz_attempt_key !~ '^qa-[A-Za-z0-9-]{16,90}$') or
     p_quiz_version is null or char_length(btrim(p_quiz_version)) not between 1 and 40 or
     p_scoring_version is null or char_length(btrim(p_scoring_version)) not between 1 and 40 or
     (p_intent is not null and p_intent not in (
       'exploring', 'see_recommended_therapist', 'brief_consultation',
       'ready_to_speak'
     )) or
     (p_recommended_therapist is not null and p_recommended_therapist !~ '^[a-z0-9-]{2,80}$') or
     p_consented_at is null or p_consented_at > statement_timestamp() + interval '10 minutes' then
    raise exception using errcode = '22023', message = 'Invalid quiz lead attribution.';
  end if;
  if p_quiz_attempt_key is not null and p_funnel_session_key is null then
    raise exception using errcode = '22023', message = 'A quiz attempt requires its funnel session.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('quiz-lead-link:' || p_reference_id, 0)
  );
  select link.* into v_existing_link
  from public.quiz_lead_links as link
  where link.reference_id = p_reference_id
  for update;
  if found and (
    (v_existing_link.funnel_session_key is not null and p_funnel_session_key is not null and
      v_existing_link.funnel_session_key <> p_funnel_session_key) or
    (v_existing_link.quiz_attempt_key is not null and p_quiz_attempt_key is not null and
      v_existing_link.quiz_attempt_key <> p_quiz_attempt_key) or
    v_existing_link.quiz_version <> btrim(p_quiz_version) or
    v_existing_link.scoring_version <> btrim(p_scoring_version) or
    (v_existing_link.intent is not null and p_intent is not null and
      v_existing_link.intent <> p_intent) or
    (v_existing_link.recommended_therapist is not null and p_recommended_therapist is not null and
      v_existing_link.recommended_therapist <> p_recommended_therapist)
  ) then
    raise exception using errcode = '23505', message = 'Quiz lead attribution is already linked differently.';
  end if;

  insert into public.quiz_lead_links (
    reference_id, funnel_session_key, quiz_attempt_key, quiz_version,
    scoring_version, intent, recommended_therapist, consented_at
  ) values (
    p_reference_id, p_funnel_session_key, p_quiz_attempt_key,
    btrim(p_quiz_version), btrim(p_scoring_version), p_intent,
    p_recommended_therapist, p_consented_at
  )
  on conflict (reference_id) do update
  set funnel_session_key = coalesce(public.quiz_lead_links.funnel_session_key, excluded.funnel_session_key),
      quiz_attempt_key = coalesce(public.quiz_lead_links.quiz_attempt_key, excluded.quiz_attempt_key),
      intent = coalesce(public.quiz_lead_links.intent, excluded.intent),
      recommended_therapist = coalesce(public.quiz_lead_links.recommended_therapist, excluded.recommended_therapist),
      updated_at = transaction_timestamp()
  returning * into v_link;

  return jsonb_build_object(
    'accepted', true,
    'referenceId', v_link.reference_id,
    'sessionKey', v_link.funnel_session_key
  );
end;
$$;

revoke all on function public.claim_quiz_result_submission_v2(
  text, text, text, integer, text, text, text, timestamptz, text, text,
  text, text, jsonb, jsonb, text, text, jsonb, text, text, text, jsonb
) from public, anon, authenticated;
revoke all on function public.record_quiz_result_submission_failure(text, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.complete_quiz_result_failure_alert(text, text)
  from public, anon, authenticated;
revoke all on function public.save_quiz_lead_record(text, text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.get_quiz_lead_record(text, text)
  from public, anon, authenticated;
revoke all on function public.patch_quiz_lead_record(text, jsonb)
  from public, anon, authenticated;
revoke all on function public.get_quiz_submission_recovery_queue(integer)
  from public, anon, authenticated;

grant execute on function public.claim_quiz_result_submission_v2(
  text, text, text, integer, text, text, text, timestamptz, text, text,
  text, text, jsonb, jsonb, text, text, jsonb, text, text, text, jsonb
) to service_role;
grant execute on function public.record_quiz_result_submission_failure(text, uuid, text, text)
  to service_role;
grant execute on function public.complete_quiz_result_failure_alert(text, text)
  to service_role;
grant execute on function public.save_quiz_lead_record(text, text, text, jsonb)
  to service_role;
grant execute on function public.get_quiz_lead_record(text, text)
  to service_role;
grant execute on function public.patch_quiz_lead_record(text, jsonb)
  to service_role;
grant execute on function public.get_quiz_submission_recovery_queue(integer)
  to service_role;

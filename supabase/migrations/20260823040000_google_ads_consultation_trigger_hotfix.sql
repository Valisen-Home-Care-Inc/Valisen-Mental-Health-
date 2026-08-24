-- Keep manual Google Ads QA consultations isolated without resolving a
-- table-specific NEW field while the shared trigger is handling the other
-- consultation table.

begin;

set local search_path = pg_catalog, public, extensions;

create or replace function public.classify_manual_google_ads_consultation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_manual_test boolean;
begin
  if tg_table_schema <> 'public' or tg_table_name not in (
    'consultation_leads', 'consultation_requests'
  ) then
    raise exception 'Unexpected manual Google Ads consultation trigger source.';
  end if;

  v_manual_test := coalesce(
    new.source_kind = 'google_ads' and new.utm_campaign = 'manual_test',
    false
  );

  -- A deduplicated lead can retain older attribution while an immutable
  -- manual_test request points to it. Keep that lead protected even without a
  -- successful google_ads_consultations link.
  if not v_manual_test and tg_table_name = 'consultation_leads' then
    select exists (
      select 1
      from public.consultation_requests as request
      where request.lead_id = new.id
        and request.source_kind = 'google_ads'
        and request.utm_campaign = 'manual_test'
    ) into v_manual_test;
  end if;

  if v_manual_test then
    new.is_test := true;
    new.test_marked_at := coalesce(
      new.test_marked_at,
      transaction_timestamp()
    );

    -- NEW is a polymorphic trigger record. Resolve request-only fields only
    -- after the table branch is known; combining this with AND makes Postgres
    -- resolve NEW.lead_id for consultation_leads and abort the insert.
    if tg_table_name = 'consultation_requests' then
      if new.lead_id is not null then
        update public.consultation_leads as lead
        set is_test = true,
            test_marked_at = coalesce(
              lead.test_marked_at,
              transaction_timestamp()
            )
        where lead.id = new.lead_id
          and (not lead.is_test or lead.test_marked_at is null);
      end if;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.classify_manual_google_ads_consultation()
  from public, anon, authenticated, service_role;

-- Exercise the exact production RPC and both trigger row types. The deliberate
-- ZX001 exception rolls every diagnostic write back inside its subtransaction;
-- any genuine persistence failure escapes and aborts this migration.
do $verify_google_ads_consultation_persistence$
declare
  v_result jsonb;
begin
  begin
    select public.upsert_consultation_lead(
      p_consultation_reference_id => 'VC-MIGRATIONQA20260823040000',
      p_quiz_reference_id => null,
      p_client_submission_id => 'migration-qa-20260823040000',
      p_first_name => 'Migration',
      p_last_name => 'QA',
      p_email => 'migration-qa@valisenmentalhealth.com',
      p_phone => '613-555-0100',
      p_therapy_type => 'other',
      p_preferred_therapist => null,
      p_preferred_days => 'Monday to Sunday',
      p_preferred_time => '9AM-12PM',
      p_coordination_details => null,
      p_consent_text => 'Migration-only persistence verification.',
      p_consent_version => 'migration-qa-v1',
      p_consented_at => transaction_timestamp(),
      p_source_kind => 'google_ads',
      p_source_detail => 'google_ads',
      p_checkpoint_code => null,
      p_checkpoint_placement_id => null,
      p_checkpoint_session_key => null,
      p_funnel_session_key => null,
      p_utm_source => 'google',
      p_utm_medium => 'cpc',
      p_utm_campaign => 'manual_test',
      p_utm_content => 'migration_qa',
      p_referrer_host => 'valisenmentalhealth.com',
      p_notification_status => 'pending',
      p_submitted_at => transaction_timestamp()
    ) into v_result;

    if not coalesce((v_result ->> 'accepted')::boolean, false) then
      raise exception 'Google Ads consultation persistence self-test was rejected.';
    end if;

    raise exception using
      errcode = 'ZX001',
      message = 'Rollback successful Google Ads consultation self-test.';
  exception
    when sqlstate 'ZX001' then
      null;
  end;
end;
$verify_google_ads_consultation_persistence$;

commit;

-- Protected QA visibility for same-domain Google Ads test journeys.
--
-- Exact `utm_campaign=manual_test` traffic is classified before its first
-- session transaction commits, remains excluded from live CRM reporting, and
-- is exposed only through service-role RPCs with the existing JSON contracts.

begin;

set local search_path = pg_catalog, public, extensions;

create index if not exists google_ads_sessions_test_started_idx
  on public.google_ads_sessions (is_test, started_at desc);

-- Patch the deployed writers instead of copying their full definitions. This
-- preserves all validation/hardening already installed in production and
-- aborts the migration if an expected definition has drifted.
do $patch_google_ads_ingest_test_classification$
declare
  v_definition text;
  v_patched text;
  v_anchor text := $anchor$
  insert into public.google_ads_sessions (
    session_key, started_at, last_seen_at, landing_path, last_path
  ) values (
    p_session_key, p_session_started_at, p_session_started_at,
    p_landing_path, p_landing_path
  )
$anchor$;
  v_replacement text := $replacement$
  insert into public.google_ads_sessions (
    session_key, started_at, last_seen_at, landing_path, last_path,
    is_test, test_marked_at
  ) values (
    p_session_key, p_session_started_at, p_session_started_at,
    p_landing_path, p_landing_path,
    coalesce(
      nullif(btrim(p_events -> 0 ->> 'utmCampaign'), '') = 'manual_test',
      false
    ),
    case
      when nullif(btrim(p_events -> 0 ->> 'utmCampaign'), '') = 'manual_test'
        then transaction_timestamp()
      else null
    end
  )
$replacement$;
  v_match_count integer;
begin
  select pg_get_functiondef(
    'public.ingest_google_ads_events(text,timestamptz,text,jsonb)'::regprocedure
  ) into strict v_definition;

  v_match_count := (
    length(v_definition) - length(replace(v_definition, v_anchor, ''))
  ) / length(v_anchor);
  if v_match_count <> 1 then
    raise exception
      'Expected one Google Ads session insert in ingest_google_ads_events; found %.',
      v_match_count;
  end if;

  v_patched := replace(v_definition, v_anchor, v_replacement);
  if v_patched = v_definition or
     v_patched not like '%utmCampaign%' or
     v_patched not like '%manual_test%' then
    raise exception 'Could not install first-write test classification in ingest_google_ads_events.';
  end if;
  execute v_patched;
end;
$patch_google_ads_ingest_test_classification$;

do $patch_google_ads_ensure_test_classification$
declare
  v_definition text;
  v_patched text;
  v_anchor text := $anchor$
  insert into public.google_ads_sessions (
    session_key, started_at, last_seen_at, landing_path, last_path,
    utm_source, utm_medium, utm_campaign, utm_content,
    google_click_id_present
  ) values (
    p_session_key, p_session_started_at, p_session_started_at,
    p_landing_path, p_landing_path, p_utm_source, p_utm_medium,
    p_utm_campaign, p_utm_content, p_google_click_id_present
  )
$anchor$;
  v_replacement text := $replacement$
  insert into public.google_ads_sessions (
    session_key, started_at, last_seen_at, landing_path, last_path,
    utm_source, utm_medium, utm_campaign, utm_content,
    google_click_id_present, is_test, test_marked_at
  ) values (
    p_session_key, p_session_started_at, p_session_started_at,
    p_landing_path, p_landing_path, p_utm_source, p_utm_medium,
    p_utm_campaign, p_utm_content, p_google_click_id_present,
    coalesce(p_utm_campaign = 'manual_test', false),
    case when p_utm_campaign = 'manual_test'
      then transaction_timestamp() else null end
  )
$replacement$;
  v_match_count integer;
begin
  select pg_get_functiondef(
    'public.ensure_google_ads_session(text,timestamptz,text,text,text,text,text,boolean)'::regprocedure
  ) into strict v_definition;

  v_match_count := (
    length(v_definition) - length(replace(v_definition, v_anchor, ''))
  ) / length(v_anchor);
  if v_match_count <> 1 then
    raise exception
      'Expected one Google Ads session insert in ensure_google_ads_session; found %.',
      v_match_count;
  end if;

  v_patched := replace(v_definition, v_anchor, v_replacement);
  if v_patched = v_definition or v_patched not like '%manual_test%' then
    raise exception 'Could not install first-write test classification in ensure_google_ads_session.';
  end if;
  execute v_patched;
end;
$patch_google_ads_ensure_test_classification$;

-- Consultation persistence happens before the verified session link and must
-- classify independently. Otherwise a notification/link failure could leave a
-- fresh-email manual QA submission visible in the live consultation manager.
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

    -- upsert_consultation_lead may preserve older lead attribution while the
    -- new immutable request carries manual_test. Classify that owning lead now
    -- so it cannot remain in the live queue if the later Ads link RPC fails.
    if tg_table_name = 'consultation_requests' and new.lead_id is not null then
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
  return new;
end;
$$;

drop trigger if exists consultation_lead_google_ads_manual_test
  on public.consultation_leads;
create trigger consultation_lead_google_ads_manual_test
before insert or update on public.consultation_leads
for each row execute function public.classify_manual_google_ads_consultation();

drop trigger if exists consultation_request_google_ads_manual_test
  on public.consultation_requests;
create trigger consultation_request_google_ads_manual_test
before insert or update on public.consultation_requests
for each row execute function public.classify_manual_google_ads_consultation();

-- The session flag is derived, not sticky: exact manual_test attribution is
-- always test, otherwise the linked lead/request flags are authoritative. This
-- preserves the existing "Include as real" operation for non-manual records.
create or replace function public.reconcile_google_ads_session_test_classification(
  p_session_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_manual_test boolean;
  v_is_test boolean;
begin
  select session.utm_campaign = 'manual_test'
  into v_manual_test
  from public.google_ads_sessions as session
  where session.id = p_session_id;

  if not found then
    return;
  end if;
  v_manual_test := coalesce(v_manual_test, false);

  -- A manual campaign is an immutable QA origin. Its durable consultation
  -- records must stay in the protected manager even if a generic unflag action
  -- is attempted elsewhere.
  if v_manual_test then
    update public.consultation_leads as lead
    set is_test = true,
        test_marked_at = coalesce(lead.test_marked_at, transaction_timestamp())
    where (not lead.is_test or lead.test_marked_at is null) and exists (
      select 1
      from public.google_ads_consultations as link
      where link.session_id = p_session_id and link.lead_id = lead.id
    );

    update public.consultation_requests as request
    set is_test = true,
        test_marked_at = coalesce(request.test_marked_at, transaction_timestamp())
    where (not request.is_test or request.test_marked_at is null) and exists (
      select 1
      from public.google_ads_consultations as link
      where link.session_id = p_session_id
        and link.consultation_reference_id = request.request_reference
    );
  end if;

  -- Do not copy a non-manual sibling flag back onto lead/request here.
  -- set_quiz_test_flag(false) clears requests first and leads second; the
  -- intermediate true session is recomputed to false by the final lead update.
  select v_manual_test or exists (
    select 1
    from public.google_ads_consultations as link
    join public.consultation_leads as lead on lead.id = link.lead_id
    join public.consultation_requests as request
      on request.request_reference = link.consultation_reference_id
    where link.session_id = p_session_id
      and (lead.is_test or request.is_test)
  ) into v_is_test;

  update public.google_ads_sessions as session
  set is_test = v_is_test,
      test_marked_at = case
        when v_is_test
          then coalesce(session.test_marked_at, transaction_timestamp())
        else null
      end,
      updated_at = transaction_timestamp()
  where session.id = p_session_id
    and (
      session.is_test is distinct from v_is_test or
      (v_is_test and session.test_marked_at is null) or
      (not v_is_test and session.test_marked_at is not null)
    );
end;
$$;

create or replace function public.apply_google_ads_test_classification()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_session record;
begin
  if tg_table_schema <> 'public' or tg_table_name not in (
    'google_ads_consultations', 'google_ads_sessions',
    'consultation_leads', 'consultation_requests'
  ) then
    raise exception 'Unexpected Google Ads test-classification trigger source.';
  end if;

  if tg_table_name = 'google_ads_consultations' then
    perform public.reconcile_google_ads_session_test_classification(new.session_id);
  elsif tg_table_name = 'google_ads_sessions' then
    perform public.reconcile_google_ads_session_test_classification(new.id);
  elsif tg_table_name = 'consultation_leads' then
    for v_session in
      select distinct link.session_id
      from public.google_ads_consultations as link
      where link.lead_id = new.id
    loop
      perform public.reconcile_google_ads_session_test_classification(
        v_session.session_id
      );
    end loop;
  elsif tg_table_name = 'consultation_requests' then
    for v_session in
      select distinct link.session_id
      from public.google_ads_consultations as link
      where link.consultation_reference_id = new.request_reference
    loop
      perform public.reconcile_google_ads_session_test_classification(
        v_session.session_id
      );
    end loop;
  end if;

  return null;
end;
$$;

drop trigger if exists google_ads_link_test_classification
  on public.google_ads_consultations;
create trigger google_ads_link_test_classification
after insert on public.google_ads_consultations
for each row execute function public.apply_google_ads_test_classification();

drop trigger if exists google_ads_session_test_classification_update
  on public.google_ads_sessions;
create trigger google_ads_session_test_classification_update
after update of is_test, utm_campaign on public.google_ads_sessions
for each row execute function public.apply_google_ads_test_classification();

drop trigger if exists google_ads_lead_test_classification
  on public.consultation_leads;
create trigger google_ads_lead_test_classification
after update of is_test on public.consultation_leads
for each row execute function public.apply_google_ads_test_classification();

drop trigger if exists google_ads_request_test_classification
  on public.consultation_requests;
create trigger google_ads_request_test_classification
after update of is_test on public.consultation_requests
for each row execute function public.apply_google_ads_test_classification();

-- Backfill exact QA campaigns, then recompute every existing linked session
-- from its authoritative campaign/lead/request inputs.
update public.consultation_leads as lead
set is_test = true,
    test_marked_at = coalesce(lead.test_marked_at, transaction_timestamp())
where (
    (lead.source_kind = 'google_ads' and lead.utm_campaign = 'manual_test') or
    exists (
      select 1
      from public.consultation_requests as request
      where request.lead_id = lead.id
        and request.source_kind = 'google_ads'
        and request.utm_campaign = 'manual_test'
    )
  )
  and (not lead.is_test or lead.test_marked_at is null);

update public.consultation_requests as request
set is_test = true,
    test_marked_at = coalesce(request.test_marked_at, transaction_timestamp())
where request.source_kind = 'google_ads'
  and request.utm_campaign = 'manual_test'
  and (not request.is_test or request.test_marked_at is null);

update public.google_ads_sessions as session
set is_test = true,
    test_marked_at = coalesce(session.test_marked_at, transaction_timestamp()),
    updated_at = transaction_timestamp()
where session.utm_campaign = 'manual_test'
  and (not session.is_test or session.test_marked_at is null);

do $reconcile_existing_google_ads_test_classification$
declare
  v_session record;
begin
  for v_session in
    select distinct link.session_id
    from public.google_ads_consultations as link
  loop
    perform public.reconcile_google_ads_session_test_classification(
      v_session.session_id
    );
  end loop;
end;
$reconcile_existing_google_ads_test_classification$;

-- Replace the deployed live cohort's indirect linked-lead exclusion with the
-- authoritative session flag, then clone that exact deployed contract for QA.
do $install_google_ads_test_dashboard$
declare
  v_live_definition text;
  v_test_definition text;
  v_live_anchor text := $anchor$      and not exists (
        select 1
        from public.google_ads_consultations as test_link
        join public.consultation_leads as test_lead
          on test_lead.id = test_link.lead_id
        where test_link.session_id = ads_session.id
          and test_lead.is_test
      )$anchor$;
  v_name_anchor text := 'FUNCTION public.get_google_ads_dashboard(';
  v_match_count integer;
begin
  select pg_get_functiondef(
    'public.get_google_ads_dashboard(timestamptz,timestamptz)'::regprocedure
  ) into strict v_live_definition;

  v_match_count := (
    length(v_live_definition) -
    length(replace(v_live_definition, v_live_anchor, ''))
  ) / length(v_live_anchor);
  if v_match_count <> 1 then
    raise exception
      'Expected one deployed linked-lead exclusion in get_google_ads_dashboard; found %.',
      v_match_count;
  end if;
  if v_live_definition like '%not ads_session.is_test%' then
    raise exception 'Deployed Google Ads session exclusion was already modified.';
  end if;
  v_match_count := (
    length(v_live_definition) -
    length(replace(v_live_definition, 'where not lead.is_test', ''))
  ) / length('where not lead.is_test');
  if v_match_count <> 1 then
    raise exception
      'Expected one deployed Google Ads verified-lead exclusion; found %.',
      v_match_count;
  end if;

  v_live_definition := replace(
    v_live_definition,
    v_live_anchor,
    '      and not ads_session.is_test'
  );
  if v_live_definition not like '%and not ads_session.is_test%' then
    raise exception 'Could not install live Google Ads test-session exclusion.';
  end if;
  execute v_live_definition;

  v_match_count := (
    length(v_live_definition) -
    length(replace(v_live_definition, v_name_anchor, ''))
  ) / length(v_name_anchor);
  if v_match_count <> 1 then
    raise exception
      'Expected one get_google_ads_dashboard declaration; found %.',
      v_match_count;
  end if;

  v_test_definition := replace(
    v_live_definition,
    v_name_anchor,
    'FUNCTION public.get_google_ads_test_dashboard('
  );
  v_test_definition := replace(
    v_test_definition,
    'and not ads_session.is_test',
    'and ads_session.is_test'
  );
  v_test_definition := replace(
    v_test_definition,
    'where not lead.is_test',
    'where lead.is_test'
  );

  if v_test_definition = v_live_definition or
     v_test_definition not like '%and ads_session.is_test%' or
     v_test_definition not like '%where lead.is_test%' or
     v_test_definition like '%not ads_session.is_test%' then
    raise exception 'Could not safely clone get_google_ads_test_dashboard.';
  end if;
  execute v_test_definition;
end;
$install_google_ads_test_dashboard$;

-- Clone the deployed consultation manager so Google Ads source support and all
-- future-compatible JSON fields remain byte-for-byte aligned. The known live
-- test exclusions must all be present before they are inverted for protected QA.
do $install_consultation_test_manager$
declare
  v_live_definition text;
  v_test_definition text;
  v_name_anchor text := 'FUNCTION public.get_consultation_manager(';
  v_request_activity_anchor text := $anchor$    from public.consultation_requests as request
    group by request.lead_id$anchor$;
  v_match_count integer;
begin
  select pg_get_functiondef(
    'public.get_consultation_manager(timestamptz,timestamptz,text,text,text,text,integer,integer)'::regprocedure
  ) into strict v_live_definition;

  v_match_count := (
    length(v_live_definition) -
    length(replace(v_live_definition, v_name_anchor, ''))
  ) / length(v_name_anchor);
  if v_match_count <> 1 then
    raise exception
      'Expected one get_consultation_manager declaration; found %.',
      v_match_count;
  end if;
  if (
    length(v_live_definition) -
    length(replace(v_live_definition, 'and not request.is_test', ''))
  ) / length('and not request.is_test') <> 1 then
    raise exception 'Deployed consultation request test exclusion has drifted.';
  end if;
  if (
    length(v_live_definition) -
    length(replace(v_live_definition, 'and not lead.is_test', ''))
  ) / length('and not lead.is_test') <> 2 then
    raise exception 'Deployed consultation lead period exclusions have drifted.';
  end if;
  if (
    length(v_live_definition) -
    length(replace(v_live_definition, 'where not lead.is_test', ''))
  ) / length('where not lead.is_test') <> 1 then
    raise exception 'Deployed consultation queue test exclusion has drifted.';
  end if;
  if (
    length(v_live_definition) -
    length(replace(v_live_definition, v_request_activity_anchor, ''))
  ) / length(v_request_activity_anchor) <> 1 then
    raise exception 'Deployed consultation request-activity cohort has drifted.';
  end if;

  v_test_definition := replace(
    v_live_definition,
    v_name_anchor,
    'FUNCTION public.get_consultation_test_manager('
  );
  v_test_definition := replace(
    v_test_definition,
    'and not request.is_test',
    'and request.is_test'
  );
  v_test_definition := replace(
    v_test_definition,
    'and not lead.is_test',
    'and lead.is_test'
  );
  v_test_definition := replace(
    v_test_definition,
    'where not lead.is_test',
    'where lead.is_test'
  );
  v_test_definition := replace(
    v_test_definition,
    v_request_activity_anchor,
    $replacement$    from public.consultation_requests as request
    where request.is_test
    group by request.lead_id$replacement$
  );

  if v_test_definition = v_live_definition or
     v_test_definition not like '%and request.is_test%' or
     v_test_definition not like '%where request.is_test%' or
     v_test_definition not like '%and lead.is_test%' or
     v_test_definition not like '%where lead.is_test%' or
     v_test_definition like '%not request.is_test%' or
     v_test_definition like '%not lead.is_test%' then
    raise exception 'Could not safely clone get_consultation_test_manager.';
  end if;
  execute v_test_definition;
end;
$install_consultation_test_manager$;

revoke all on function public.classify_manual_google_ads_consultation()
  from public, anon, authenticated, service_role;
revoke all on function public.reconcile_google_ads_session_test_classification(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.apply_google_ads_test_classification()
  from public, anon, authenticated, service_role;
revoke all on function public.get_google_ads_test_dashboard(timestamptz, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.get_consultation_test_manager(
  timestamptz, timestamptz, text, text, text, text, integer, integer
) from public, anon, authenticated, service_role;

grant execute on function public.get_google_ads_test_dashboard(timestamptz, timestamptz)
  to service_role;
grant execute on function public.get_consultation_test_manager(
  timestamptz, timestamptz, text, text, text, text, integer, integer
) to service_role;

commit;

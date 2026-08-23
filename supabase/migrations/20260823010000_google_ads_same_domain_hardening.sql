-- Forward-only hardening for the same-domain, signed Google Ads journey.
-- The prior migration may already be installed; do not edit or rerun it.

begin;

set local search_path = pg_catalog, public, extensions;

comment on table public.google_ads_sessions is
  'Anonymous, signed-entry Google Ads journey summaries, isolated from ordinary and other paid traffic; contains no contact or intake values.';
comment on table public.google_ads_events is
  'Closed-taxonomy, first-party Google Ads journey events. Paths, targets and properties are allowlisted; raw URLs, click IDs and free text are not retained.';

-- Browser tabs may clone sessionStorage. The globally random client event ID
-- remains the idempotency key; sequence is ordering metadata within one tab,
-- not a cross-tab uniqueness boundary.
alter table public.google_ads_events
  drop constraint google_ads_events_session_sequence_unique;

do $patch_google_ads_event_idempotency$
declare
  v_definition text;
  v_patched text;
begin
  select pg_get_functiondef(
    'public.ingest_google_ads_events(text,timestamptz,text,jsonb)'::regprocedure
  ) into v_definition;
  v_patched := regexp_replace(
    v_definition,
    'where event\.client_event_id = v_event_id[[:space:]]+or \(event\.session_id = v_session\.id and event\.sequence = v_sequence\)',
    'where event.client_event_id = v_event_id'
  );
  if v_patched = v_definition then
    raise exception 'Could not update Google Ads event idempotency lookup.';
  end if;
  execute v_patched;
end;
$patch_google_ads_event_idempotency$;

-- A verified intake can ensure its session even when an ad blocker or network
-- failure prevented the best-effort event endpoint from running first.
create or replace function public.ensure_google_ads_session(
  p_session_key text,
  p_session_started_at timestamptz,
  p_landing_path text,
  p_utm_source text,
  p_utm_medium text,
  p_utm_campaign text,
  p_utm_content text,
  p_google_click_id_present boolean
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_session public.google_ads_sessions%rowtype;
begin
  if p_session_key is null or
     p_session_key !~ '^gas-[A-Za-z0-9-]{16,90}$' or
     p_session_started_at is null or
     p_session_started_at < statement_timestamp() - interval '13 hours' or
     p_session_started_at > statement_timestamp() + interval '10 minutes' or
     not coalesce(public.is_google_ads_tracked_path(p_landing_path), false) or
     not public.is_google_ads_campaign_dimension(p_utm_source) or
     not public.is_google_ads_campaign_dimension(p_utm_medium) or
     not public.is_google_ads_campaign_dimension(p_utm_campaign) or
     not public.is_google_ads_campaign_dimension(p_utm_content) or
     p_google_click_id_present is null then
    raise exception using errcode = '22023', message = 'Invalid Google Ads session seed.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('google-ads-session:' || p_session_key, 0)
  );

  insert into public.google_ads_sessions (
    session_key, started_at, last_seen_at, landing_path, last_path,
    utm_source, utm_medium, utm_campaign, utm_content,
    google_click_id_present
  ) values (
    p_session_key, p_session_started_at, p_session_started_at,
    p_landing_path, p_landing_path, p_utm_source, p_utm_medium,
    p_utm_campaign, p_utm_content, p_google_click_id_present
  )
  on conflict (session_key) do nothing;

  select session.* into v_session
  from public.google_ads_sessions as session
  where session.session_key = p_session_key
  for update;

  if not found or
     v_session.started_at is distinct from p_session_started_at or
     v_session.landing_path is distinct from p_landing_path or
     v_session.utm_source is distinct from p_utm_source or
     v_session.utm_medium is distinct from p_utm_medium or
     v_session.utm_campaign is distinct from p_utm_campaign or
     v_session.utm_content is distinct from p_utm_content or
     v_session.google_click_id_present is distinct from p_google_click_id_present then
    raise exception using errcode = '22023', message = 'Google Ads session seed collision.';
  end if;

  return jsonb_build_object('accepted', true, 'sessionId', p_session_key);
end;
$$;

-- Bind a conversion claim to the nonce of its signed browser receipt. A retry
-- after a committed-but-lost HTTP response receives the same success, while a
-- different receipt cannot claim the already-counted conversion.
alter table public.google_ads_consultations
  add column conversion_claim_nonce_hash text;

update public.google_ads_consultations as link
set conversion_claim_nonce_hash = encode(
  extensions.digest(
    pg_catalog.convert_to('legacy-google-ads-claim:' || link.id::text, 'UTF8'),
    'sha256'
  ),
  'hex'
)
where link.conversion_claimed_at is not null;

alter table public.google_ads_consultations
  add constraint google_ads_consultations_claim_nonce_valid check (
    (conversion_claimed_at is null and conversion_claim_nonce_hash is null) or
    (conversion_claimed_at is not null and
      conversion_claim_nonce_hash ~ '^[a-f0-9]{64}$')
  );

create or replace function public.consume_google_ads_conversion(
  p_session_key text,
  p_reference_id text,
  p_nonce_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_link public.google_ads_consultations%rowtype;
begin
  if p_session_key is null or
     p_session_key !~ '^gas-[A-Za-z0-9-]{16,90}$' or
     p_reference_id is null or
     p_reference_id !~ '^VC-[A-Za-z0-9_-]{6,36}$' or
     p_nonce_hash is null or
     p_nonce_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'Invalid Google Ads conversion claim.';
  end if;

  select link.* into v_link
  from public.google_ads_consultations as link
  join public.google_ads_sessions as session on session.id = link.session_id
  where session.session_key = p_session_key
    and link.consultation_reference_id = p_reference_id
  for update of link;

  if not found then
    return jsonb_build_object('accepted', false, 'replayed', false);
  end if;

  if v_link.conversion_claimed_at is null then
    update public.google_ads_consultations as link
    set conversion_claimed_at = transaction_timestamp(),
        conversion_claim_nonce_hash = p_nonce_hash
    where link.id = v_link.id;
    return jsonb_build_object('accepted', true, 'replayed', false);
  end if;

  return jsonb_build_object(
    'accepted', v_link.conversion_claim_nonce_hash = p_nonce_hash,
    'replayed', v_link.conversion_claim_nonce_hash = p_nonce_hash
  );
end;
$$;

-- Retain detailed anonymous behavior only as long as it is useful: 90 days
-- for unconverted journeys and 13 months for all detail. Unconverted session
-- summaries also expire after 13 months; linked CRM records keep their summary.
create or replace function public.prune_google_ads_analytics()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_events integer := 0;
  v_sessions integer := 0;
begin
  if not pg_catalog.pg_try_advisory_xact_lock(
    pg_catalog.hashtextextended('google-ads-retention-prune', 0)
  ) then
    return jsonb_build_object('accepted', true, 'skipped', true);
  end if;

  delete from public.google_ads_events as event
  using public.google_ads_sessions as session
  where event.session_id = session.id
    and (
      event.occurred_at < statement_timestamp() - interval '13 months' or
      (
        event.occurred_at < statement_timestamp() - interval '90 days' and
        not exists (
          select 1 from public.google_ads_consultations as link
          where link.session_id = session.id
        )
      )
    );
  get diagnostics v_events = row_count;

  delete from public.google_ads_sessions as session
  where session.started_at < statement_timestamp() - interval '13 months'
    and not exists (
      select 1 from public.google_ads_consultations as link
      where link.session_id = session.id
    );
  get diagnostics v_sessions = row_count;

  return jsonb_build_object(
    'accepted', true,
    'deletedEvents', v_events,
    'deletedSessions', v_sessions
  );
end;
$$;

revoke all on function public.ensure_google_ads_session(
  text, timestamptz, text, text, text, text, text, boolean
) from public, anon, authenticated;
revoke all on function public.consume_google_ads_conversion(text, text, text)
  from public, anon, authenticated;
revoke all on function public.prune_google_ads_analytics()
  from public, anon, authenticated;

grant execute on function public.ensure_google_ads_session(
  text, timestamptz, text, text, text, text, text, boolean
) to service_role;
grant execute on function public.consume_google_ads_conversion(text, text, text)
  to service_role;
grant execute on function public.prune_google_ads_analytics()
  to service_role;

commit;

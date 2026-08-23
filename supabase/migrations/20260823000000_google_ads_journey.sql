-- Isolated Google Ads journey analytics and confirmed-consultation attribution.
--
-- Anonymous ad behaviour intentionally lives outside growth_funnel_* so the
-- ordinary site cohort cannot be mixed with the dedicated ads hostname. This
-- schema has no contact, intake-answer, quiz-answer, search-term, raw click-ID,
-- or arbitrary URL columns. Campaign identifiers are the only deliberately
-- bounded, visitor-supplied labels; interaction dimensions use closed values.

begin;

set local search_path = pg_catalog, public, extensions;

-- Forward fixes for paid-search work that shipped after the original growth
-- schema. Paid landing pages still canonicalize to /sitewide, but their closed
-- page classification must be accepted by the existing table constraint.
alter table public.growth_funnel_events
  drop constraint growth_funnel_events_page_valid;
alter table public.growth_funnel_events
  add constraint growth_funnel_events_page_valid check (page is null or page in (
    'homepage', 'therapist_directory', 'therapist_profile',
    'paid_search_landing', 'paid_search_anxiety',
    'paid_search_depression', 'paid_search_couples',
    'quiz', 'consultation', 'sitewide'
  ));

-- A Google Ads consultation remains a normal consented CRM request, but its
-- source is explicit and server-owned rather than inferred from a UTM value.
alter table public.consultation_leads
  drop constraint consultation_leads_source_allowed;
alter table public.consultation_leads
  add constraint consultation_leads_source_allowed check (source_kind in (
    'mental_battery_checkpoint', 'quiz', 'direct', 'therapist',
    'possibility_builder', 'google_ads', 'website', 'other'
  ));

alter table public.consultation_requests
  drop constraint consultation_requests_source_valid;
alter table public.consultation_requests
  add constraint consultation_requests_source_valid check (source_kind in (
    'mental_battery_checkpoint', 'quiz', 'direct', 'therapist',
    'possibility_builder', 'google_ads', 'website', 'other'
  ));

-- Preserve the mature CRM RPC signatures and retry semantics while extending
-- their closed source allowlists. The earlier test-data migration establishes
-- this guarded pg_get_functiondef pattern for forward-compatible amendments.
do $google_ads_source_upgrade$
declare
  v_definition text;
  v_original text;
  v_previous text;
begin
  select pg_get_functiondef(
    'public.upsert_consultation_lead(text,text,text,text,text,text,text,text,text,text,text,text,text,text,timestamptz,text,text,text,uuid,text,text,text,text,text,text,text,text,timestamptz)'::regprocedure
  ) into v_definition;
  v_original := v_definition;
  v_definition := replace(
    v_definition,
    '''possibility_builder'', ''website'', ''other''',
    '''possibility_builder'', ''google_ads'', ''website'', ''other'''
  );
  if v_definition = v_original then
    raise exception 'Could not add google_ads to upsert_consultation_lead.';
  end if;

  v_previous := v_definition;
  v_definition := replace(
    v_definition,
    'when lead.source_kind = ''quiz'' or p_source_kind = ''quiz'' then ''quiz''' || E'\n        else p_source_kind',
    'when lead.source_kind = ''google_ads'' or p_source_kind = ''google_ads'' then ''google_ads''' || E'\n        when lead.source_kind = ''quiz'' or p_source_kind = ''quiz'' then ''quiz''' || E'\n        else p_source_kind'
  );
  if v_definition = v_previous then
    raise exception 'Could not install google_ads CRM source precedence.';
  end if;

  v_previous := v_definition;
  v_definition := replace(
    v_definition,
    'when p_source_kind = ''mental_battery_checkpoint''' || E'\n          then coalesce(v_source_detail, lead.source_detail)',
    'when p_source_kind = ''mental_battery_checkpoint''' || E'\n          then coalesce(v_source_detail, lead.source_detail)' || E'\n        when lead.source_kind = ''mental_battery_checkpoint''' || E'\n          then coalesce(lead.source_detail, v_source_detail)' || E'\n        when p_source_kind = ''google_ads''' || E'\n          then coalesce(v_source_detail, lead.source_detail)'
  );
  if v_definition = v_previous then
    raise exception 'Could not install google_ads CRM source-detail precedence.';
  end if;
  execute v_definition;

  select pg_get_functiondef(
    'public.get_consultation_manager(timestamptz,timestamptz,text,text,text,text,integer,integer)'::regprocedure
  ) into v_definition;
  v_original := v_definition;
  v_definition := replace(
    v_definition,
    '''possibility_builder'', ''website'', ''other''',
    '''possibility_builder'', ''google_ads'', ''website'', ''other'''
  );
  if v_definition = v_original then
    raise exception 'Could not add google_ads to get_consultation_manager.';
  end if;
  execute v_definition;
end;
$google_ads_source_upgrade$;

create or replace function public.is_google_ads_tracked_path(p_path text)
returns boolean
language sql
immutable
set search_path = pg_catalog, public
as $$
  select p_path in (
    '/', '/about', '/anxiety-therapy-ottawa', '/book-consultation',
    '/consultation', '/depression-therapy-ottawa', '/faq',
    '/faq/am-i-burnt-out', '/faq/am-i-depressed',
    '/faq/does-insurance-cover-therapy', '/faq/dont-know-what-i-need',
    '/faq/do-i-have-anxiety', '/faq/first-therapy-session',
    '/faq/how-long-therapy', '/faq/how-often-therapy', '/faq/how-to-book',
    '/faq/how-to-find-therapist', '/faq/is-my-grief-normal',
    '/faq/languages-offered', '/faq/rp-vs-rsw',
    '/faq/stress-vs-anxiety', '/faq/tax-deductible-therapy',
    '/faq/therapy-approaches', '/faq/therapy-cost-ottawa',
    '/faq/therapist-credentials', '/faq/trauma-signs',
    '/faq/what-is-valisen', '/faq/which-plans-cover-rps', '/get-matched',
    '/grief-counselling-ottawa', '/insurance', '/intake',
    '/life-transitions-therapy-ottawa', '/privacy-policy', '/quiz',
    '/relationship-counselling-ottawa', '/resources',
    '/resources/five-signs-of-perfectionism',
    '/self-esteem-therapy-ottawa', '/services', '/sitewide',
    '/stress-therapy-ottawa', '/terms', '/therapists',
    '/therapists/dayong-quan', '/therapists/meryem-ibrahim',
    '/therapists/ryann-simpson', '/therapists/tim-kahtava',
    '/therapists/wilfred-bengnwi', '/therapists/profile',
    '/trauma-therapy-ottawa', '/lp/anxiety-therapy',
    '/lp/depression-therapy', '/lp/couples-therapy', '/thank-you'
  );
$$;

create or replace function public.is_google_ads_event_name(p_name text)
returns boolean
language sql
immutable
set search_path = pg_catalog, public
as $$
  select p_name in (
    'journey_started', 'page_viewed', 'page_exited', 'section_viewed',
    'engagement_ping', 'scroll_depth_reached', 'internal_link_clicked',
    'control_clicked', 'consultation_cta_clicked', 'phone_clicked',
    'email_clicked', 'therapist_profile_clicked', 'quiz_clicked',
    'external_link_clicked', 'form_started', 'form_field_focused',
    'consultation_step_viewed', 'consultation_validation_failed',
    'consultation_submitted', 'thank_you_viewed'
  );
$$;

create or replace function public.is_google_ads_campaign_dimension(p_value text)
returns boolean
language sql
immutable
set search_path = pg_catalog, public
as $$
  select p_value is null or (
    char_length(p_value) between 1 and 120 and
    p_value = btrim(p_value) and
    p_value !~ '[[:cntrl:]@/?#&=]' and
    position(chr(92) in p_value) = 0
  );
$$;

create table public.google_ads_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  session_key text not null unique,
  started_at timestamptz not null,
  last_seen_at timestamptz not null,
  landing_path text not null,
  last_path text not null,
  last_event_name text not null default 'journey_started',
  device_category text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  google_click_id_present boolean,
  referrer_host text,
  attribution_set boolean not null default false,
  engaged_ms bigint not null default 0,
  max_scroll_depth smallint not null default 0,
  event_count integer not null default 0,
  last_sequence integer not null default 0,
  consultation_cta_clicked boolean not null default false,
  form_started boolean not null default false,
  consultation_submission_event boolean not null default false,
  thank_you_viewed boolean not null default false,
  unverified_submission_reference text,
  is_test boolean not null default false,
  test_marked_at timestamptz,
  created_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp(),
  constraint google_ads_sessions_key_valid
    check (session_key ~ '^gas-[A-Za-z0-9-]{16,90}$'),
  constraint google_ads_sessions_time_valid
    check (last_seen_at >= started_at - interval '5 minutes'),
  constraint google_ads_sessions_path_valid check (
    public.is_google_ads_tracked_path(landing_path) and
    public.is_google_ads_tracked_path(last_path)
  ),
  constraint google_ads_sessions_event_valid
    check (public.is_google_ads_event_name(last_event_name)),
  constraint google_ads_sessions_device_valid check (
    device_category is null or device_category in ('mobile', 'tablet', 'desktop')
  ),
  constraint google_ads_sessions_campaign_valid check (
    public.is_google_ads_campaign_dimension(utm_source) and
    public.is_google_ads_campaign_dimension(utm_medium) and
    public.is_google_ads_campaign_dimension(utm_campaign) and
    public.is_google_ads_campaign_dimension(utm_content)
  ),
  constraint google_ads_sessions_referrer_valid check (
    referrer_host is null or (
      char_length(referrer_host) between 1 and 120 and
      referrer_host ~ '^(?:[a-z0-9](?:[a-z0-9-]{0,62})\.)*[a-z0-9](?:[a-z0-9-]{0,62})$'
    )
  ),
  constraint google_ads_sessions_counts_valid check (
    engaged_ms between 0 and 604800000 and
    max_scroll_depth in (0, 25, 50, 75, 100) and
    event_count >= 0 and last_sequence >= 0
  ),
  constraint google_ads_sessions_reference_valid check (
    unverified_submission_reference is null or
    unverified_submission_reference ~ '^VC-[A-Za-z0-9_-]{6,36}$'
  ),
  constraint google_ads_sessions_attribution_shape check (
    not attribution_set or (
      device_category is not null and google_click_id_present is not null
    )
  )
);

create index google_ads_sessions_started_idx
  on public.google_ads_sessions (started_at desc);
create index google_ads_sessions_campaign_idx
  on public.google_ads_sessions (
    utm_source, utm_medium, utm_campaign, started_at desc
  );
create index google_ads_sessions_conversion_idx
  on public.google_ads_sessions (
    consultation_cta_clicked, form_started, started_at desc
  );

create table public.google_ads_events (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid not null references public.google_ads_sessions(id) on delete cascade,
  client_event_id text not null unique,
  sequence integer not null,
  occurred_at timestamptz not null,
  event_name text not null,
  path text not null,
  section_id text,
  target_type text,
  target_path text,
  target_id text,
  cta_placement text,
  therapist_id text,
  engaged_ms integer,
  scroll_depth smallint,
  form_step smallint,
  submission_reference text,
  elapsed_ms integer not null,
  created_at timestamptz not null default transaction_timestamp(),
  constraint google_ads_events_session_sequence_unique unique (session_id, sequence),
  constraint google_ads_events_client_id_valid
    check (client_event_id ~ '^gae-[A-Za-z0-9-]{16,90}$'),
  constraint google_ads_events_sequence_valid
    check (sequence between 1 and 1000000),
  constraint google_ads_events_name_valid
    check (public.is_google_ads_event_name(event_name)),
  constraint google_ads_events_path_valid check (
    public.is_google_ads_tracked_path(path) and
    (target_path is null or public.is_google_ads_tracked_path(target_path))
  ),
  constraint google_ads_events_section_valid check (
    section_id is null or section_id ~ '^section-(0[1-9]|[1-9][0-9]{1,2})$'
  ),
  constraint google_ads_events_target_valid check (
    target_type is null or target_type in (
      'navigation', 'consultation', 'phone', 'email', 'therapist',
      'quiz', 'external', 'button', 'form_field'
    )
  ),
  constraint google_ads_events_target_id_valid check (
    target_id is null or target_id in (
      'first-name', 'last-name', 'email', 'phone', 'therapy-type',
      'preferred-therapist', 'additional-info', 'availability',
      'consent', 'button', 'submit'
    )
  ),
  constraint google_ads_events_cta_valid check (
    cta_placement is null or
    cta_placement in ('navigation', 'footer', 'form', 'main')
  ),
  constraint google_ads_events_therapist_valid check (
    (
      event_name = 'therapist_profile_clicked' and
      therapist_id is not null and
      target_path = '/therapists/' || therapist_id
    ) or (
      event_name <> 'therapist_profile_clicked' and therapist_id is null
    )
  ),
  constraint google_ads_events_engagement_shape check (
    (event_name = 'engagement_ping' and engaged_ms is not null and
      engaged_ms between 1 and 60000) or
    (event_name <> 'engagement_ping' and engaged_ms is null)
  ),
  constraint google_ads_events_scroll_shape check (
    (event_name = 'scroll_depth_reached' and scroll_depth is not null and
      scroll_depth in (25, 50, 75, 100)) or
    (event_name <> 'scroll_depth_reached' and scroll_depth is null)
  ),
  constraint google_ads_events_section_shape check (
    event_name <> 'section_viewed' or section_id is not null
  ),
  constraint google_ads_events_step_shape check (
    (form_step is null or (
      event_name in (
        'form_started', 'consultation_step_viewed',
        'consultation_validation_failed', 'consultation_submitted'
      ) and form_step in (1, 2)
    )) and
    (event_name <> 'consultation_step_viewed' or form_step is not null)
  ),
  constraint google_ads_events_reference_shape check (
    (submission_reference is null) or (
      event_name = 'consultation_submitted' and
      submission_reference ~ '^VC-[A-Za-z0-9_-]{6,36}$'
    )
  ),
  constraint google_ads_events_elapsed_valid
    check (elapsed_ms between 0 and 604800000)
);

create index google_ads_events_session_occurred_idx
  on public.google_ads_events (session_id, occurred_at, sequence);
create index google_ads_events_name_occurred_idx
  on public.google_ads_events (event_name, occurred_at desc);
create index google_ads_events_page_idx
  on public.google_ads_events (path, event_name, occurred_at desc);
create index google_ads_events_section_idx
  on public.google_ads_events (path, section_id, event_name, occurred_at desc)
  where section_id is not null;

create table public.google_ads_consultations (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid not null unique references public.google_ads_sessions(id) on delete restrict,
  consultation_reference_id text not null unique
    references public.consultation_requests(request_reference) on delete restrict,
  lead_id uuid not null references public.consultation_leads(id) on delete restrict,
  submitted_at timestamptz not null,
  conversion_claimed_at timestamptz,
  created_at timestamptz not null default transaction_timestamp(),
  constraint google_ads_consultations_reference_valid check (
    consultation_reference_id ~ '^VC-[A-Za-z0-9_-]{6,36}$'
  ),
  constraint google_ads_consultations_claim_time_valid check (
    conversion_claimed_at is null or conversion_claimed_at >= submitted_at
  )
);

create index google_ads_consultations_submitted_idx
  on public.google_ads_consultations (submitted_at desc);
create index google_ads_consultations_lead_idx
  on public.google_ads_consultations (lead_id);

comment on table public.google_ads_sessions is
  'Anonymous, ads-host-only journey summaries; separate from ordinary growth traffic and contains no contact or intake values.';
comment on table public.google_ads_events is
  'Closed-taxonomy Google Ads mirror events. Paths, targets and properties are allowlisted; raw URLs and free text are not retained.';
comment on table public.google_ads_consultations is
  'Immutable server-verified links between one ads session and one durable google_ads consultation request.';

create or replace function public.ingest_google_ads_events(
  p_session_key text,
  p_session_started_at timestamptz,
  p_landing_path text,
  p_events jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_session public.google_ads_sessions%rowtype;
  v_event jsonb;
  v_existing public.google_ads_events%rowtype;
  v_inserted_id uuid;
  v_event_id text;
  v_sequence integer;
  v_occurred_at timestamptz;
  v_event_name text;
  v_path text;
  v_section_id text;
  v_target_type text;
  v_target_path text;
  v_target_id text;
  v_cta_placement text;
  v_therapist_id text;
  v_engaged_ms integer;
  v_scroll_depth smallint;
  v_form_step smallint;
  v_submission_reference text;
  v_elapsed_ms integer;
  v_device_category text;
  v_utm_source text;
  v_utm_medium text;
  v_utm_campaign text;
  v_utm_content text;
  v_google_click_id_present boolean;
  v_referrer_host text;
  v_has_target boolean;
  v_accepted integer := 0;
begin
  if p_session_key is null or
     p_session_key !~ '^gas-[A-Za-z0-9-]{16,90}$' then
    raise exception using errcode = '22023', message = 'Invalid Google Ads session identifier.';
  end if;
  if p_session_started_at is null or
     p_session_started_at < statement_timestamp() - interval '7 days' or
     p_session_started_at > statement_timestamp() + interval '10 minutes' then
    raise exception using errcode = '22023', message = 'Invalid Google Ads session timestamp.';
  end if;
  if not public.is_google_ads_tracked_path(p_landing_path) then
    raise exception using errcode = '22023', message = 'Invalid Google Ads landing path.';
  end if;
  if p_events is null or jsonb_typeof(p_events) <> 'array' or
     jsonb_array_length(p_events) not between 1 and 20 then
    raise exception using errcode = '22023', message = 'Invalid Google Ads event batch.';
  end if;

  insert into public.google_ads_sessions (
    session_key, started_at, last_seen_at, landing_path, last_path
  ) values (
    p_session_key, p_session_started_at, p_session_started_at,
    p_landing_path, p_landing_path
  )
  on conflict (session_key) do update
  set updated_at = transaction_timestamp()
  returning * into v_session;

  if v_session.started_at is distinct from p_session_started_at or
     v_session.landing_path is distinct from p_landing_path then
    raise exception using errcode = '22023', message = 'Google Ads session identifier collision.';
  end if;

  for v_event in
    select item.value from jsonb_array_elements(p_events) as item(value)
  loop
    if jsonb_typeof(v_event) <> 'object' or
       (v_event - array[
         'eventId', 'sequence', 'occurredAt', 'event', 'path',
         'sectionId', 'targetType', 'targetPath', 'targetId',
         'ctaPlacement', 'therapistId', 'engagedMs', 'scrollDepth',
         'formStep', 'submissionReference', 'elapsedMs',
         'deviceCategory', 'utmSource', 'utmMedium', 'utmCampaign',
         'utmContent', 'googleClickIdPresent', 'referrerHost'
       ]::text[]) <> '{}'::jsonb then
      raise exception using errcode = '22023', message = 'Unexpected Google Ads event property.';
    end if;

    v_event_id := nullif(btrim(v_event ->> 'eventId'), '');
    v_sequence := (v_event ->> 'sequence')::integer;
    v_occurred_at := (v_event ->> 'occurredAt')::timestamptz;
    v_event_name := nullif(btrim(v_event ->> 'event'), '');
    v_path := nullif(btrim(v_event ->> 'path'), '');
    v_section_id := nullif(btrim(v_event ->> 'sectionId'), '');
    v_target_type := nullif(btrim(v_event ->> 'targetType'), '');
    v_target_path := nullif(btrim(v_event ->> 'targetPath'), '');
    v_target_id := nullif(btrim(v_event ->> 'targetId'), '');
    v_cta_placement := nullif(btrim(v_event ->> 'ctaPlacement'), '');
    v_therapist_id := nullif(btrim(v_event ->> 'therapistId'), '');
    v_engaged_ms := case when v_event ? 'engagedMs'
      then (v_event ->> 'engagedMs')::integer else null end;
    v_scroll_depth := case when v_event ? 'scrollDepth'
      then (v_event ->> 'scrollDepth')::smallint else null end;
    v_form_step := case when v_event ? 'formStep'
      then (v_event ->> 'formStep')::smallint else null end;
    v_submission_reference := nullif(btrim(v_event ->> 'submissionReference'), '');
    v_elapsed_ms := (v_event ->> 'elapsedMs')::integer;
    v_device_category := nullif(btrim(v_event ->> 'deviceCategory'), '');
    v_utm_source := nullif(btrim(v_event ->> 'utmSource'), '');
    v_utm_medium := nullif(btrim(v_event ->> 'utmMedium'), '');
    v_utm_campaign := nullif(btrim(v_event ->> 'utmCampaign'), '');
    v_utm_content := nullif(btrim(v_event ->> 'utmContent'), '');
    v_google_click_id_present := (v_event ->> 'googleClickIdPresent')::boolean;
    v_referrer_host := nullif(lower(btrim(v_event ->> 'referrerHost')), '');
    v_has_target := v_target_type is not null or
      v_target_path is not null or v_target_id is not null;

    if v_event_id is null or v_event_id !~ '^gae-[A-Za-z0-9-]{16,90}$' or
       v_sequence not between 1 and 1000000 or
       v_occurred_at < p_session_started_at - interval '5 minutes' or
       v_occurred_at > statement_timestamp() + interval '10 minutes' or
       not coalesce(public.is_google_ads_event_name(v_event_name), false) or
       not coalesce(public.is_google_ads_tracked_path(v_path), false) or
       (v_section_id is not null and
         v_section_id !~ '^section-(0[1-9]|[1-9][0-9]{1,2})$') or
       (v_target_type is not null and v_target_type not in (
         'navigation', 'consultation', 'phone', 'email', 'therapist',
         'quiz', 'external', 'button', 'form_field'
       )) or
       (v_target_path is not null and
         not public.is_google_ads_tracked_path(v_target_path)) or
       (v_target_id is not null and v_target_id not in (
         'first-name', 'last-name', 'email', 'phone', 'therapy-type',
         'preferred-therapist', 'additional-info', 'availability',
         'consent', 'button', 'submit'
       )) or
       (v_cta_placement is not null and v_cta_placement not in (
         'navigation', 'footer', 'form', 'main'
       )) or
       (v_therapist_id is not null and (
         char_length(v_therapist_id) > 80 or
         v_therapist_id !~ '^[a-z0-9-]+$'
       )) or
       (v_event_name = 'engagement_ping' and
         coalesce(v_engaged_ms not between 1 and 60000, true)) or
       (v_event_name <> 'engagement_ping' and v_engaged_ms is not null) or
       (v_event_name = 'scroll_depth_reached' and
         coalesce(v_scroll_depth not in (25, 50, 75, 100), true)) or
       (v_event_name <> 'scroll_depth_reached' and v_scroll_depth is not null) or
       (v_form_step is not null and (
         v_event_name not in (
           'form_started', 'consultation_step_viewed',
           'consultation_validation_failed', 'consultation_submitted'
         ) or v_form_step not in (1, 2)
       )) or
       (v_event_name = 'consultation_step_viewed' and v_form_step is null) or
       (v_submission_reference is not null and (
         v_event_name <> 'consultation_submitted' or
         v_submission_reference !~ '^VC-[A-Za-z0-9_-]{6,36}$'
       )) or
       v_elapsed_ms not between 0 and 604800000 or
       v_device_category is null or
       v_device_category not in ('mobile', 'tablet', 'desktop') or
       v_google_click_id_present is null or
       not public.is_google_ads_campaign_dimension(v_utm_source) or
       not public.is_google_ads_campaign_dimension(v_utm_medium) or
       not public.is_google_ads_campaign_dimension(v_utm_campaign) or
       not public.is_google_ads_campaign_dimension(v_utm_content) or
       (v_referrer_host is not null and (
         char_length(v_referrer_host) > 120 or
         v_referrer_host !~ '^(?:[a-z0-9](?:[a-z0-9-]{0,62})\.)*[a-z0-9](?:[a-z0-9-]{0,62})$'
       )) then
      raise exception using errcode = '22023', message = 'Invalid Google Ads event.';
    end if;

    if v_event_name = 'section_viewed' and v_section_id is null then
      raise exception using errcode = '22023', message = 'Section events require a section identifier.';
    end if;
    if v_event_name in (
      'form_started', 'form_field_focused', 'consultation_step_viewed',
      'consultation_validation_failed', 'consultation_submitted'
    ) and v_path <> '/consultation' then
      raise exception using errcode = '22023', message = 'Consultation event path mismatch.';
    end if;
    if v_event_name = 'thank_you_viewed' and v_path <> '/thank-you' then
      raise exception using errcode = '22023', message = 'Thank-you event path mismatch.';
    end if;
    if v_cta_placement is not null and v_event_name not in (
      'internal_link_clicked', 'control_clicked',
      'consultation_cta_clicked', 'phone_clicked', 'email_clicked',
      'therapist_profile_clicked', 'quiz_clicked', 'external_link_clicked'
    ) then
      raise exception using errcode = '22023', message = 'CTA placement event mismatch.';
    end if;
    if v_therapist_id is not null and
       v_event_name <> 'therapist_profile_clicked' then
      raise exception using errcode = '22023', message = 'Therapist event mismatch.';
    end if;

    if v_event_name = 'internal_link_clicked' and not coalesce((
      v_target_type = 'navigation' and v_target_path is not null and
      v_target_id is null
    ), false) then
      raise exception using errcode = '22023', message = 'Invalid internal-link target.';
    elsif v_event_name = 'control_clicked' and not coalesce((
      v_target_type = 'button' and v_target_id in ('button', 'submit') and
      v_target_path is null
    ), false) then
      raise exception using errcode = '22023', message = 'Invalid control target.';
    elsif v_event_name = 'consultation_cta_clicked' and not coalesce((
      v_target_type = 'consultation' and v_target_path in (
        '/consultation', '/book-consultation', '/get-matched', '/intake'
      ) and v_target_id is null
    ), false) then
      raise exception using errcode = '22023', message = 'Invalid consultation target.';
    elsif v_event_name = 'phone_clicked' and not coalesce((
      v_target_type = 'phone' and v_target_path is null and v_target_id is null
    ), false) then
      raise exception using errcode = '22023', message = 'Invalid phone target.';
    elsif v_event_name = 'email_clicked' and not coalesce((
      v_target_type = 'email' and v_target_path is null and v_target_id is null
    ), false) then
      raise exception using errcode = '22023', message = 'Invalid email target.';
    elsif v_event_name = 'therapist_profile_clicked' and not coalesce((
      v_target_type = 'therapist' and
      v_target_path like '/therapists/%' and v_target_id is null and
      v_therapist_id = substring(v_target_path from 13)
    ), false) then
      raise exception using errcode = '22023', message = 'Invalid therapist target.';
    elsif v_event_name = 'quiz_clicked' and not coalesce((
      v_target_type = 'quiz' and v_target_path = '/quiz' and v_target_id is null
    ), false) then
      raise exception using errcode = '22023', message = 'Invalid quiz target.';
    elsif v_event_name = 'external_link_clicked' and not coalesce((
      v_target_type = 'external' and v_target_path is null and v_target_id is null
    ), false) then
      raise exception using errcode = '22023', message = 'Invalid external target.';
    elsif v_event_name = 'form_field_focused' and not coalesce((
      v_target_type = 'form_field' and v_target_id in (
        'first-name', 'last-name', 'email', 'phone', 'therapy-type',
        'preferred-therapist', 'additional-info', 'availability', 'consent'
      ) and v_target_path is null
    ), false) then
      raise exception using errcode = '22023', message = 'Invalid form-field target.';
    elsif v_event_name = 'consultation_validation_failed' and not coalesce((
      not v_has_target or (
        v_target_type = 'form_field' and v_target_id in (
          'first-name', 'last-name', 'email', 'phone', 'therapy-type',
          'preferred-therapist', 'additional-info', 'availability', 'consent'
        ) and v_target_path is null
      )
    ), false) then
      raise exception using errcode = '22023', message = 'Invalid validation target.';
    elsif v_event_name not in (
      'internal_link_clicked', 'control_clicked',
      'consultation_cta_clicked', 'phone_clicked', 'email_clicked',
      'therapist_profile_clicked', 'quiz_clicked', 'external_link_clicked',
      'form_field_focused', 'consultation_validation_failed'
    ) and v_has_target then
      raise exception using errcode = '22023', message = 'Unexpected Google Ads event target.';
    end if;

    if v_session.attribution_set then
      if v_session.device_category is distinct from v_device_category or
         v_session.utm_source is distinct from v_utm_source or
         v_session.utm_medium is distinct from v_utm_medium or
         v_session.utm_campaign is distinct from v_utm_campaign or
         v_session.utm_content is distinct from v_utm_content or
         v_session.google_click_id_present is distinct from v_google_click_id_present or
         v_session.referrer_host is distinct from v_referrer_host then
        raise exception using errcode = '22023', message = 'Google Ads session attribution collision.';
      end if;
    else
      update public.google_ads_sessions as session
      set device_category = v_device_category,
          utm_source = v_utm_source,
          utm_medium = v_utm_medium,
          utm_campaign = v_utm_campaign,
          utm_content = v_utm_content,
          google_click_id_present = v_google_click_id_present,
          referrer_host = v_referrer_host,
          attribution_set = true,
          updated_at = transaction_timestamp()
      where session.id = v_session.id
      returning * into v_session;
    end if;

    v_inserted_id := null;
    insert into public.google_ads_events (
      session_id, client_event_id, sequence, occurred_at, event_name, path,
      section_id, target_type, target_path, target_id, cta_placement,
      therapist_id, engaged_ms, scroll_depth, form_step,
      submission_reference, elapsed_ms
    ) values (
      v_session.id, v_event_id, v_sequence, v_occurred_at, v_event_name,
      v_path, v_section_id, v_target_type, v_target_path, v_target_id,
      v_cta_placement, v_therapist_id, v_engaged_ms, v_scroll_depth,
      v_form_step, v_submission_reference, v_elapsed_ms
    )
    on conflict do nothing
    returning id into v_inserted_id;

    if v_inserted_id is null then
      select event.* into v_existing
      from public.google_ads_events as event
      where event.client_event_id = v_event_id
         or (event.session_id = v_session.id and event.sequence = v_sequence)
      limit 1;
      if not found or
         v_existing.session_id is distinct from v_session.id or
         v_existing.client_event_id is distinct from v_event_id or
         v_existing.sequence is distinct from v_sequence or
         v_existing.occurred_at is distinct from v_occurred_at or
         v_existing.event_name is distinct from v_event_name or
         v_existing.path is distinct from v_path or
         v_existing.section_id is distinct from v_section_id or
         v_existing.target_type is distinct from v_target_type or
         v_existing.target_path is distinct from v_target_path or
         v_existing.target_id is distinct from v_target_id or
         v_existing.cta_placement is distinct from v_cta_placement or
         v_existing.therapist_id is distinct from v_therapist_id or
         v_existing.engaged_ms is distinct from v_engaged_ms or
         v_existing.scroll_depth is distinct from v_scroll_depth or
         v_existing.form_step is distinct from v_form_step or
         v_existing.submission_reference is distinct from v_submission_reference or
         v_existing.elapsed_ms is distinct from v_elapsed_ms then
        raise exception using errcode = '22023', message = 'Google Ads event identifier collision.';
      end if;
      continue;
    end if;

    v_accepted := v_accepted + 1;
    update public.google_ads_sessions as session
    set last_seen_at = greatest(session.last_seen_at, v_occurred_at),
        last_event_name = case when v_sequence > session.last_sequence
          then v_event_name else session.last_event_name end,
        last_path = case when v_sequence > session.last_sequence
          then v_path else session.last_path end,
        engaged_ms = session.engaged_ms + coalesce(v_engaged_ms, 0),
        max_scroll_depth = greatest(
          session.max_scroll_depth, coalesce(v_scroll_depth, 0)
        ),
        event_count = session.event_count + 1,
        last_sequence = greatest(session.last_sequence, v_sequence),
        consultation_cta_clicked = session.consultation_cta_clicked or
          v_event_name = 'consultation_cta_clicked',
        form_started = session.form_started or v_event_name = 'form_started',
        consultation_submission_event =
          session.consultation_submission_event or
          v_event_name = 'consultation_submitted',
        thank_you_viewed = session.thank_you_viewed or
          v_event_name = 'thank_you_viewed',
        unverified_submission_reference = coalesce(
          session.unverified_submission_reference, v_submission_reference
        ),
        updated_at = transaction_timestamp()
    where session.id = v_session.id
    returning * into v_session;
  end loop;

  return jsonb_build_object(
    'accepted', true,
    'acceptedEvents', v_accepted
  );
end;
$$;

create or replace function public.link_google_ads_consultation(
  p_session_key text,
  p_reference_id text,
  p_submitted_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_session public.google_ads_sessions%rowtype;
  v_request public.consultation_requests%rowtype;
  v_lead public.consultation_leads%rowtype;
  v_link public.google_ads_consultations%rowtype;
  v_inserted_id uuid;
begin
  if p_session_key is null or
     p_session_key !~ '^gas-[A-Za-z0-9-]{16,90}$' or
     p_reference_id is null or
     p_reference_id !~ '^VC-[A-Za-z0-9_-]{6,36}$' or
     (p_submitted_at is not null and
       p_submitted_at > statement_timestamp() + interval '10 minutes') then
    raise exception using errcode = '22023', message = 'Invalid Google Ads consultation link.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('google-ads-session:' || p_session_key, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('google-ads-consultation:' || p_reference_id, 0)
  );

  select session.* into v_session
  from public.google_ads_sessions as session
  where session.session_key = p_session_key
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Google Ads session was not found.';
  end if;

  select request.* into v_request
  from public.consultation_requests as request
  where request.request_reference = p_reference_id
  for update;
  if not found or v_request.source_kind <> 'google_ads' or
     v_request.request_kind <> 'consultation_form' then
    raise exception using errcode = '22023', message = 'Consultation is not a verified Google Ads request.';
  end if;

  select lead.* into v_lead
  from public.consultation_leads as lead
  where lead.id = v_request.lead_id
  for update;
  if not found then
    raise exception using errcode = '22023', message = 'Consultation lead was not found.';
  end if;

  if v_request.submitted_at < v_session.started_at - interval '5 minutes' or
     v_request.submitted_at > v_session.started_at + interval '7 days' or
     v_request.submitted_at > statement_timestamp() + interval '10 minutes' or
     (p_submitted_at is not null and
       pg_catalog.abs(extract(epoch from (p_submitted_at - v_request.submitted_at))) > 300) then
    raise exception using errcode = '22023', message = 'Google Ads consultation timestamp mismatch.';
  end if;

  v_inserted_id := null;
  insert into public.google_ads_consultations (
    session_id, consultation_reference_id, lead_id, submitted_at
  ) values (
    v_session.id, p_reference_id, v_lead.id, v_request.submitted_at
  )
  on conflict do nothing
  returning id into v_inserted_id;

  if v_inserted_id is null then
    select link.* into v_link
    from public.google_ads_consultations as link
    where link.session_id = v_session.id
       or link.consultation_reference_id = p_reference_id
    limit 1;
    if not found or
       v_link.session_id is distinct from v_session.id or
       v_link.consultation_reference_id is distinct from p_reference_id or
       v_link.lead_id is distinct from v_lead.id then
      raise exception using errcode = '23505', message = 'Google Ads consultation link is immutable.';
    end if;
  end if;

  update public.google_ads_sessions as session
  set last_seen_at = greatest(session.last_seen_at, v_request.submitted_at),
      is_test = session.is_test or v_lead.is_test,
      test_marked_at = case
        when session.is_test or v_lead.is_test
          then coalesce(session.test_marked_at, v_lead.test_marked_at, transaction_timestamp())
        else null
      end,
      updated_at = transaction_timestamp()
  where session.id = v_session.id;

  return jsonb_build_object(
    'accepted', true,
    'linked', v_inserted_id is not null,
    'sessionId', p_session_key,
    'referenceId', p_reference_id
  );
end;
$$;

-- A signed browser receipt proves eligibility, while this row update makes
-- its redemption atomic. Exactly one request can claim a linked consultation,
-- including when two tabs submit the same cookie concurrently.
create or replace function public.consume_google_ads_conversion(
  p_session_key text,
  p_reference_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_claimed_at timestamptz;
begin
  if p_session_key is null or
     p_session_key !~ '^gas-[A-Za-z0-9-]{16,90}$' or
     p_reference_id is null or
     p_reference_id !~ '^VC-[A-Za-z0-9_-]{6,36}$' then
    raise exception using errcode = '22023', message = 'Invalid Google Ads conversion claim.';
  end if;

  update public.google_ads_consultations as link
  set conversion_claimed_at = transaction_timestamp()
  from public.google_ads_sessions as session
  where link.session_id = session.id
    and session.session_key = p_session_key
    and link.consultation_reference_id = p_reference_id
    and link.conversion_claimed_at is null
  returning link.conversion_claimed_at into v_claimed_at;

  return jsonb_build_object(
    'accepted', v_claimed_at is not null
  );
end;
$$;

create or replace function public.get_google_ads_dashboard(
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_from timestamptz := coalesce(p_from, '2020-01-01T00:00:00Z'::timestamptz);
  v_to timestamptz := coalesce(p_to, statement_timestamp());
  v_result jsonb;
begin
  if v_from >= v_to or
     v_to > statement_timestamp() + interval '10 minutes' or
     v_to - v_from > interval '10 years' then
    raise exception using errcode = '22023', message = 'Invalid Google Ads dashboard range.';
  end if;

  with range_sessions as (
    select ads_session.*
    from public.google_ads_sessions as ads_session
    where ads_session.started_at >= v_from
      and ads_session.started_at < v_to
      and not exists (
        select 1
        from public.google_ads_consultations as test_link
        join public.consultation_leads as test_lead
          on test_lead.id = test_link.lead_id
        where test_link.session_id = ads_session.id
          and test_lead.is_test
      )
  ),
  verified_links as (
    select
      link.session_id,
      link.consultation_reference_id,
      link.lead_id,
      lead.workflow_status,
      lead.conversion_stage,
      lead.booked_at,
      lead.paid_therapy_at
    from public.google_ads_consultations as link
    join range_sessions as ads_session on ads_session.id = link.session_id
    join public.consultation_leads as lead on lead.id = link.lead_id
    where not lead.is_test
  ),
  event_flags as (
    select
      event.session_id,
      bool_or(event.event_name = 'page_viewed' and event.path = '/consultation')
        as consultation_page_viewed,
      bool_or(event.event_name = 'consultation_step_viewed' and event.form_step = 1)
        as consultation_step_1,
      bool_or(event.event_name = 'consultation_step_viewed' and event.form_step = 2)
        as consultation_step_2
    from public.google_ads_events as event
    join range_sessions as ads_session on ads_session.id = event.session_id
    group by event.session_id
  ),
  session_metrics as (
    select
      ads_session.*,
      link.consultation_reference_id,
      link.lead_id as linked_lead_id,
      (link.consultation_reference_id is not null)::integer as request_count,
      (
        link.lead_id is not null and link.workflow_status <> 'duplicate'
      ) as is_opportunity,
      (
        link.lead_id is not null and link.workflow_status <> 'duplicate' and
        link.booked_at is not null
      ) as booked,
      (
        link.lead_id is not null and link.workflow_status <> 'duplicate' and
        link.paid_therapy_at is not null
      ) as paid_therapy,
      coalesce(flags.consultation_page_viewed, false) as consultation_page_viewed,
      coalesce(flags.consultation_step_1, false) as consultation_step_1,
      coalesce(flags.consultation_step_2, false) as consultation_step_2
    from range_sessions as ads_session
    left join verified_links as link on link.session_id = ads_session.id
    left join event_flags as flags on flags.session_id = ads_session.id
  ),
  totals as (
    select
      count(*)::integer as sessions,
      count(*) filter (where metric.engaged_ms > 0)::integer as engaged_sessions,
      coalesce(sum(metric.engaged_ms), 0)::bigint as total_engaged_ms,
      count(*) filter (where metric.consultation_cta_clicked)::integer
        as consultation_cta_sessions,
      count(*) filter (where metric.form_started)::integer as form_starts,
      coalesce(sum(metric.request_count), 0)::integer as consultation_requests,
      count(distinct metric.linked_lead_id) filter (
        where metric.is_opportunity
      )::integer as consultation_opportunities,
      count(distinct metric.linked_lead_id) filter (
        where metric.booked
      )::integer as booked_consultations,
      count(distinct metric.linked_lead_id) filter (
        where metric.paid_therapy
      )::integer as paid_therapy_conversions,
      count(*) filter (where metric.consultation_page_viewed)::integer
        as consultation_page_views,
      count(*) filter (where metric.consultation_step_1)::integer
        as consultation_step_1,
      count(*) filter (where metric.consultation_step_2)::integer
        as consultation_step_2
    from session_metrics as metric
  ),
  page_views as (
    select
      event.path,
      count(*)::integer as views,
      count(distinct event.session_id)::integer as sessions
    from public.google_ads_events as event
    join range_sessions as ads_session on ads_session.id = event.session_id
    where event.event_name = 'page_viewed'
    group by event.path
  ),
  page_engagement as (
    select
      event.path,
      coalesce(sum(event.engaged_ms), 0)::bigint as engaged_ms
    from public.google_ads_events as event
    join range_sessions as ads_session on ads_session.id = event.session_id
    where event.event_name = 'engagement_ping'
    group by event.path
  ),
  page_exits as (
    select event.path, count(*)::integer as exits
    from public.google_ads_events as event
    join range_sessions as ads_session on ads_session.id = event.session_id
    where event.event_name = 'page_exited'
    group by event.path
  ),
  page_ctas as (
    select
      event.path,
      count(distinct event.session_id)::integer as consultation_cta_sessions
    from public.google_ads_events as event
    join range_sessions as ads_session on ads_session.id = event.session_id
    where event.event_name = 'consultation_cta_clicked'
    group by event.path
  ),
  landing_requests as (
    select
      metric.landing_path as path,
      coalesce(sum(metric.request_count), 0)::integer as consultation_requests
    from session_metrics as metric
    group by metric.landing_path
  ),
  page_rows as (
    select
      page.path,
      page.views,
      page.sessions,
      coalesce(engagement.engaged_ms, 0)::bigint as engaged_ms,
      case when page.sessions = 0 then 0 else
        round(coalesce(engagement.engaged_ms, 0)::numeric / page.sessions)
      end::bigint as average_engaged_ms,
      coalesce(exit_event.exits, 0)::integer as exits,
      coalesce(cta.consultation_cta_sessions, 0)::integer
        as consultation_cta_sessions,
      coalesce(requests.consultation_requests, 0)::integer
        as consultation_requests
    from page_views as page
    left join page_engagement as engagement on engagement.path = page.path
    left join page_exits as exit_event on exit_event.path = page.path
    left join page_ctas as cta on cta.path = page.path
    left join landing_requests as requests on requests.path = page.path
  ),
  section_views as (
    select
      event.path,
      event.section_id,
      count(*)::integer as views,
      count(distinct event.session_id)::integer as sessions
    from public.google_ads_events as event
    join range_sessions as ads_session on ads_session.id = event.session_id
    where event.event_name = 'section_viewed'
      and event.section_id is not null
    group by event.path, event.section_id
  ),
  section_engagement as (
    select
      event.path,
      event.section_id,
      coalesce(sum(event.engaged_ms), 0)::bigint as engaged_ms
    from public.google_ads_events as event
    join range_sessions as ads_session on ads_session.id = event.session_id
    where event.event_name = 'engagement_ping'
      and event.section_id is not null
    group by event.path, event.section_id
  ),
  section_rows as (
    select
      section.path,
      section.section_id,
      section.views,
      section.sessions,
      coalesce(engagement.engaged_ms, 0)::bigint as engaged_ms
    from section_views as section
    left join section_engagement as engagement
      on engagement.path = section.path
     and engagement.section_id = section.section_id
  ),
  campaign_rows as (
    select
      coalesce(metric.utm_source, 'Not set') as source,
      coalesce(metric.utm_medium, 'Not set') as medium,
      coalesce(metric.utm_campaign, 'Not set') as campaign,
      metric.utm_content as content,
      coalesce(metric.google_click_id_present, false) as google_click_id_present,
      count(*)::integer as sessions,
      count(*) filter (where metric.engaged_ms > 0)::integer as engaged_sessions,
      count(*) filter (where metric.consultation_cta_clicked)::integer
        as consultation_cta_sessions,
      count(*) filter (where metric.form_started)::integer as form_starts,
      coalesce(sum(metric.request_count), 0)::integer as consultation_requests,
      count(distinct metric.linked_lead_id) filter (
        where metric.booked
      )::integer as booked_consultations,
      count(distinct metric.linked_lead_id) filter (
        where metric.paid_therapy
      )::integer as paid_therapy_conversions
    from session_metrics as metric
    group by
      coalesce(metric.utm_source, 'Not set'),
      coalesce(metric.utm_medium, 'Not set'),
      coalesce(metric.utm_campaign, 'Not set'),
      metric.utm_content,
      coalesce(metric.google_click_id_present, false)
  ),
  action_rows as (
    select
      event.event_name,
      count(*)::integer as events,
      count(distinct event.session_id)::integer as sessions
    from public.google_ads_events as event
    join range_sessions as ads_session on ads_session.id = event.session_id
    group by event.event_name
  ),
  recent_selected as (
    select metric.*
    from session_metrics as metric
    order by metric.last_seen_at desc, metric.started_at desc
    limit 50
  ),
  recent_rows as (
    select
      recent.last_seen_at,
      jsonb_build_object(
        'sessionId', recent.session_key,
        'startedAt', recent.started_at,
        'lastSeenAt', recent.last_seen_at,
        'landingPath', recent.landing_path,
        'lastPath', recent.last_path,
        'engagedMs', recent.engaged_ms,
        'eventCount', recent.event_count,
        'device', recent.device_category,
        'consultationCtaClicked', recent.consultation_cta_clicked,
        'formStarted', recent.form_started,
        'consultationSubmitted', recent.request_count > 0,
        'consultationReferenceId', recent.consultation_reference_id,
        'booked', recent.booked,
        'paidTherapy', recent.paid_therapy,
        'attribution', jsonb_build_object(
          'source', recent.utm_source,
          'medium', recent.utm_medium,
          'campaign', recent.utm_campaign,
          'content', recent.utm_content,
          'googleClickIdPresent', coalesce(recent.google_click_id_present, false)
        ),
        'events', coalesce((
          select jsonb_agg(timeline.item order by timeline.sequence)
          from (
            select
              event.sequence,
              jsonb_build_object(
                'id', event.client_event_id,
                'sequence', event.sequence,
                'name', event.event_name,
                'occurredAt', event.occurred_at,
                'path', event.path,
                'section', event.section_id,
                'targetType', event.target_type,
                'targetPath', event.target_path,
                'targetId', event.target_id,
                'ctaPlacement', event.cta_placement,
                'therapistId', event.therapist_id,
                'engagedMs', event.engaged_ms,
                'scrollDepth', event.scroll_depth,
                'formStep', event.form_step,
                'consultationReferenceId', case
                  when event.submission_reference = recent.consultation_reference_id
                    then event.submission_reference
                  else null
                end
              ) as item
            from public.google_ads_events as event
            where event.session_id = recent.id
            order by event.sequence desc
            limit 200
          ) as timeline
        ), '[]'::jsonb)
      ) as item
    from recent_selected as recent
  )
  select jsonb_build_object(
    'generatedAt', statement_timestamp(),
    'range', jsonb_build_object('from', v_from, 'to', v_to),
    'kpis', jsonb_build_object(
      'sessions', total.sessions,
      'engagedSessions', total.engaged_sessions,
      'totalEngagedMs', total.total_engaged_ms,
      'averageEngagedMs', case when total.sessions = 0 then 0
        else round(total.total_engaged_ms::numeric / total.sessions) end,
      'consultationCtaSessions', total.consultation_cta_sessions,
      'formStarts', total.form_starts,
      'consultationRequests', total.consultation_requests,
      'consultationOpportunities', total.consultation_opportunities,
      'bookedConsultations', total.booked_consultations,
      'paidTherapyConversions', total.paid_therapy_conversions
    ),
    'funnel', jsonb_build_array(
      jsonb_build_object(
        'key', 'sessions', 'label', 'Ad sessions',
        'count', total.sessions,
        'sessionRate', case when total.sessions = 0 then 0 else 100 end
      ),
      jsonb_build_object(
        'key', 'engaged_sessions', 'label', 'Engaged sessions',
        'count', total.engaged_sessions,
        'sessionRate', case when total.sessions = 0 then 0 else
          round(total.engaged_sessions::numeric * 1000 / total.sessions) / 10 end
      ),
      jsonb_build_object(
        'key', 'consultation_cta', 'label', 'Consultation CTA clicked',
        'count', total.consultation_cta_sessions,
        'sessionRate', case when total.sessions = 0 then 0 else
          round(total.consultation_cta_sessions::numeric * 1000 / total.sessions) / 10 end
      ),
      jsonb_build_object(
        'key', 'consultation_page', 'label', 'Consultation form opened',
        'count', total.consultation_page_views,
        'sessionRate', case when total.sessions = 0 then 0 else
          round(total.consultation_page_views::numeric * 1000 / total.sessions) / 10 end
      ),
      jsonb_build_object(
        'key', 'form_starts', 'label', 'Form started',
        'count', total.form_starts,
        'sessionRate', case when total.sessions = 0 then 0 else
          round(total.form_starts::numeric * 1000 / total.sessions) / 10 end
      ),
      jsonb_build_object(
        'key', 'consultation_step_2', 'label', 'Availability reached',
        'count', total.consultation_step_2,
        'sessionRate', case when total.sessions = 0 then 0 else
          round(total.consultation_step_2::numeric * 1000 / total.sessions) / 10 end
      ),
      jsonb_build_object(
        'key', 'consultation_requests', 'label', 'Confirmed requests',
        'count', total.consultation_requests,
        'sessionRate', case when total.sessions = 0 then 0 else
          round(total.consultation_requests::numeric * 1000 / total.sessions) / 10 end
      ),
      jsonb_build_object(
        'key', 'booked_consultations', 'label', 'Consultations booked',
        'count', total.booked_consultations,
        'sessionRate', case when total.sessions = 0 then 0 else
          round(total.booked_consultations::numeric * 1000 / total.sessions) / 10 end
      ),
      jsonb_build_object(
        'key', 'paid_therapy', 'label', 'Paid therapy',
        'count', total.paid_therapy_conversions,
        'sessionRate', case when total.sessions = 0 then 0 else
          round(total.paid_therapy_conversions::numeric * 1000 / total.sessions) / 10 end
      )
    ),
    'pages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'path', page.path,
        'sessions', page.sessions,
        'views', page.views,
        'engagedMs', page.engaged_ms,
        'averageEngagedMs', page.average_engaged_ms,
        'exits', page.exits,
        'consultationCtaSessions', page.consultation_cta_sessions,
        'consultationRequests', page.consultation_requests
      ) order by page.sessions desc, page.views desc, page.path)
      from page_rows as page
    ), '[]'::jsonb),
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'path', section.path,
        'sectionId', section.section_id,
        'views', section.views,
        'sessions', section.sessions,
        'engagedMs', section.engaged_ms
      ) order by section.path, section.section_id)
      from section_rows as section
    ), '[]'::jsonb),
    'campaigns', coalesce((
      select jsonb_agg(jsonb_build_object(
        'source', campaign.source,
        'medium', campaign.medium,
        'campaign', campaign.campaign,
        'content', campaign.content,
        'googleClickIdPresent', campaign.google_click_id_present,
        'sessions', campaign.sessions,
        'engagedSessions', campaign.engaged_sessions,
        'consultationCtaSessions', campaign.consultation_cta_sessions,
        'formStarts', campaign.form_starts,
        'consultationRequests', campaign.consultation_requests,
        'bookedConsultations', campaign.booked_consultations,
        'paidTherapyConversions', campaign.paid_therapy_conversions
      ) order by campaign.sessions desc, campaign.campaign)
      from campaign_rows as campaign
    ), '[]'::jsonb),
    'actions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'event', action.event_name,
        'events', action.events,
        'sessions', action.sessions
      ) order by action.events desc, action.event_name)
      from action_rows as action
    ), '[]'::jsonb),
    'recentSessions', coalesce((
      select jsonb_agg(recent.item order by recent.last_seen_at desc)
      from recent_rows as recent
    ), '[]'::jsonb)
  ) into v_result
  from totals as total;

  return v_result;
end;
$$;

alter table public.google_ads_sessions enable row level security;
alter table public.google_ads_events enable row level security;
alter table public.google_ads_consultations enable row level security;

revoke all on table public.google_ads_sessions
  from public, anon, authenticated, service_role;
revoke all on table public.google_ads_events
  from public, anon, authenticated, service_role;
revoke all on table public.google_ads_consultations
  from public, anon, authenticated, service_role;

revoke all on function public.is_google_ads_tracked_path(text)
  from public, anon, authenticated, service_role;
revoke all on function public.is_google_ads_event_name(text)
  from public, anon, authenticated, service_role;
revoke all on function public.is_google_ads_campaign_dimension(text)
  from public, anon, authenticated, service_role;
revoke all on function public.ingest_google_ads_events(text, timestamptz, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.link_google_ads_consultation(text, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.consume_google_ads_conversion(text, text)
  from public, anon, authenticated;
revoke all on function public.get_google_ads_dashboard(timestamptz, timestamptz)
  from public, anon, authenticated;

grant execute on function public.ingest_google_ads_events(text, timestamptz, text, jsonb)
  to service_role;
grant execute on function public.link_google_ads_consultation(text, text, timestamptz)
  to service_role;
grant execute on function public.consume_google_ads_conversion(text, text)
  to service_role;
grant execute on function public.get_google_ads_dashboard(timestamptz, timestamptz)
  to service_role;

commit;

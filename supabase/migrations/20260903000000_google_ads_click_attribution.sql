-- Google Ads click attribution and click-time session seeding.
--
-- 1. First-class campaign / ad group / keyword / match-type columns on
--    google_ads_sessions (backfilled from the older vt1~ utm_content encoding).
-- 2. seed_google_ads_session: the signed entry redirect creates the session
--    row the moment a click is verified, so a visitor who leaves before any
--    JavaScript runs is still counted. Idempotent with the event pipeline.
-- 3. Dashboard RPCs expose the new attribution, session length, and two new
--    diagnostics: sessions with no events and sessions carrying suffix data.
-- 4. Paginated, privacy-safe export RPCs for the CSV download.
-- 5. A transactional self-test exercises every new function and rolls back.
--
-- Safe to run more than once. "Success, no rows" is the expected result.

begin;

set local search_path = pg_catalog, public, extensions;

alter table public.google_ads_sessions
  add column if not exists campaign_id text,
  add column if not exists campaign_name text,
  add column if not exists ad_group_id text,
  add column if not exists ad_group_name text,
  add column if not exists keyword text,
  add column if not exists match_type text,
  add column if not exists network text,
  add column if not exists ad_device text,
  add column if not exists creative_id text,
  add column if not exists seeded_at timestamptz;

comment on column public.google_ads_sessions.keyword is
  'The advertiser-account keyword that matched the ad (Google ValueTrack {keyword}); never the visitor''s search query.';
comment on column public.google_ads_sessions.seeded_at is
  'Set when the signed entry redirect created this row at click time, before any browser event.';

create or replace function public.is_google_ads_click_attribution_valid(
  p_campaign_id text,
  p_campaign_name text,
  p_ad_group_id text,
  p_ad_group_name text,
  p_keyword text,
  p_match_type text,
  p_network text,
  p_ad_device text,
  p_creative_id text
)
returns boolean
language sql
immutable
set search_path = pg_catalog, public
as $$
  select
    (p_campaign_id is null or p_campaign_id ~ '^[0-9]{1,20}$') and
    (p_ad_group_id is null or p_ad_group_id ~ '^[0-9]{1,20}$') and
    (p_creative_id is null or p_creative_id ~ '^[0-9]{1,20}$') and
    (p_campaign_name is null or (
      char_length(p_campaign_name) <= 80 and
      public.is_google_ads_campaign_dimension(p_campaign_name)
    )) and
    (p_ad_group_name is null or (
      char_length(p_ad_group_name) <= 80 and
      public.is_google_ads_campaign_dimension(p_ad_group_name)
    )) and
    (p_keyword is null or (
      char_length(p_keyword) <= 80 and
      public.is_google_ads_campaign_dimension(p_keyword)
    )) and
    (p_match_type is null or
      p_match_type in ('exact', 'phrase', 'broad', 'other')) and
    (p_network is null or p_network in (
      'search', 'search_partners', 'display', 'youtube', 'video_partners',
      'performance_max', 'demand_gen', 'other'
    )) and
    (p_ad_device is null or
      p_ad_device in ('mobile', 'tablet', 'desktop', 'other'));
$$;

-- Extracts one validated field from the legacy `vt1~a:..~n:..~k:..` encoding.
create or replace function public.google_ads_value_track_field(
  p_content text,
  p_key text
)
returns text
language sql
immutable
set search_path = pg_catalog, public
as $$
  select case
    when p_content is null or p_content not like 'vt1~%' or
         p_key not in ('a', 'n', 'k') then null
    else (
      select case
        when extracted.candidate is not null
         and char_length(extracted.candidate) <= 80
         and public.is_google_ads_campaign_dimension(extracted.candidate)
        then extracted.candidate
      end
      from (
        select nullif(btrim(substring(
          p_content from '~' || p_key || ':([^~]{1,80})(?:~|$)'
        )), '') as candidate
      ) as extracted
    )
  end;
$$;

update public.google_ads_sessions as session
set campaign_id = coalesce(
      session.campaign_id,
      case when session.utm_campaign ~ '^[0-9]{1,20}$'
        then session.utm_campaign end
    ),
    ad_group_id = coalesce(
      session.ad_group_id,
      case when public.google_ads_value_track_field(session.utm_content, 'a')
             ~ '^[0-9]{1,20}$'
        then public.google_ads_value_track_field(session.utm_content, 'a') end
    ),
    ad_group_name = coalesce(
      session.ad_group_name,
      public.google_ads_value_track_field(session.utm_content, 'n')
    ),
    keyword = coalesce(
      session.keyword,
      public.google_ads_value_track_field(session.utm_content, 'k')
    ),
    updated_at = transaction_timestamp()
where (
    session.utm_content like 'vt1~%' or
    session.utm_campaign ~ '^[0-9]{1,20}$'
  )
  and (
    session.campaign_id is null or session.ad_group_id is null or
    session.ad_group_name is null or session.keyword is null
  );

do $add_click_attribution_constraint$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'google_ads_sessions_click_attribution_valid'
      and conrelid = 'public.google_ads_sessions'::regclass
  ) then
    alter table public.google_ads_sessions
      add constraint google_ads_sessions_click_attribution_valid check (
        public.is_google_ads_click_attribution_valid(
          campaign_id, campaign_name, ad_group_id, ad_group_name, keyword,
          match_type, network, ad_device, creative_id
        )
      );
  end if;
end;
$add_click_attribution_constraint$;

create index if not exists google_ads_sessions_click_attribution_idx
  on public.google_ads_sessions (campaign_id, ad_group_id, keyword, started_at desc);

-- Creates (or completes) the session row at click time. The later event
-- pipeline and consultation link both tolerate an existing row with the same
-- signed attribution, so the three writers can arrive in any order.
create or replace function public.seed_google_ads_session(
  p_session_key text,
  p_session_started_at timestamptz,
  p_landing_path text,
  p_utm_source text,
  p_utm_medium text,
  p_utm_campaign text,
  p_utm_content text,
  p_google_click_id_present boolean,
  p_campaign_id text default null,
  p_campaign_name text default null,
  p_ad_group_id text default null,
  p_ad_group_name text default null,
  p_keyword text default null,
  p_match_type text default null,
  p_network text default null,
  p_ad_device text default null,
  p_creative_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_session public.google_ads_sessions%rowtype;
  v_inserted integer := 0;
  v_is_test boolean := coalesce(p_utm_campaign = 'manual_test', false);
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
     p_google_click_id_present is null or
     not public.is_google_ads_click_attribution_valid(
       p_campaign_id, p_campaign_name, p_ad_group_id, p_ad_group_name,
       p_keyword, p_match_type, p_network, p_ad_device, p_creative_id
     ) then
    raise exception using errcode = '22023', message = 'Invalid Google Ads session seed.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('google-ads-session:' || p_session_key, 0)
  );

  insert into public.google_ads_sessions (
    session_key, started_at, last_seen_at, landing_path, last_path,
    utm_source, utm_medium, utm_campaign, utm_content,
    google_click_id_present,
    campaign_id, campaign_name, ad_group_id, ad_group_name, keyword,
    match_type, network, ad_device, creative_id, seeded_at,
    is_test, test_marked_at
  ) values (
    p_session_key, p_session_started_at, p_session_started_at,
    p_landing_path, p_landing_path,
    p_utm_source, p_utm_medium, p_utm_campaign, p_utm_content,
    p_google_click_id_present,
    p_campaign_id, p_campaign_name, p_ad_group_id, p_ad_group_name, p_keyword,
    p_match_type, p_network, p_ad_device, p_creative_id, transaction_timestamp(),
    v_is_test,
    case when v_is_test then transaction_timestamp() else null end
  )
  on conflict (session_key) do nothing;
  get diagnostics v_inserted = row_count;

  select session.* into v_session
  from public.google_ads_sessions as session
  where session.session_key = p_session_key
  for update;

  if not found or
     v_session.started_at is distinct from p_session_started_at or
     v_session.landing_path is distinct from p_landing_path then
    raise exception using errcode = '22023', message = 'Google Ads session seed collision.';
  end if;

  if v_inserted = 0 then
    -- The event pipeline or a consultation link created the row first. Only
    -- confirm identical signed attribution and fill still-missing columns.
    if (v_session.utm_source is not null and
          v_session.utm_source is distinct from p_utm_source) or
       (v_session.utm_medium is not null and
          v_session.utm_medium is distinct from p_utm_medium) or
       (v_session.utm_campaign is not null and
          v_session.utm_campaign is distinct from p_utm_campaign) or
       (v_session.utm_content is not null and
          v_session.utm_content is distinct from p_utm_content) or
       (v_session.google_click_id_present is not null and
          v_session.google_click_id_present is distinct from p_google_click_id_present) then
      raise exception using errcode = '22023', message = 'Google Ads session seed collision.';
    end if;

    update public.google_ads_sessions as session
    set utm_source = coalesce(session.utm_source, p_utm_source),
        utm_medium = coalesce(session.utm_medium, p_utm_medium),
        utm_campaign = coalesce(session.utm_campaign, p_utm_campaign),
        utm_content = coalesce(session.utm_content, p_utm_content),
        google_click_id_present = coalesce(
          session.google_click_id_present, p_google_click_id_present
        ),
        campaign_id = coalesce(session.campaign_id, p_campaign_id),
        campaign_name = coalesce(session.campaign_name, p_campaign_name),
        ad_group_id = coalesce(session.ad_group_id, p_ad_group_id),
        ad_group_name = coalesce(session.ad_group_name, p_ad_group_name),
        keyword = coalesce(session.keyword, p_keyword),
        match_type = coalesce(session.match_type, p_match_type),
        network = coalesce(session.network, p_network),
        ad_device = coalesce(session.ad_device, p_ad_device),
        creative_id = coalesce(session.creative_id, p_creative_id),
        seeded_at = coalesce(session.seeded_at, transaction_timestamp()),
        is_test = session.is_test or v_is_test,
        test_marked_at = case
          when session.is_test or v_is_test
            then coalesce(session.test_marked_at, transaction_timestamp())
          else null
        end,
        updated_at = transaction_timestamp()
    where session.id = v_session.id;
  end if;

  return jsonb_build_object(
    'accepted', true,
    'seeded', v_inserted > 0,
    'sessionId', p_session_key
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
      and not ads_session.is_test
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
      coalesce(flags.consultation_step_2, false) as consultation_step_2,
      (
        ads_session.campaign_name is not null or
        ads_session.ad_group_id is not null or
        ads_session.ad_group_name is not null or
        ads_session.keyword is not null
      ) as attributed
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
        as consultation_step_2,
      count(*) filter (where metric.event_count = 0)::integer
        as sessions_without_events,
      count(*) filter (where metric.attributed)::integer
        as attributed_sessions
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
      coalesce(metric.campaign_id, metric.utm_campaign, 'Not set') as campaign_key,
      max(metric.campaign_name) as campaign_name,
      max(metric.utm_campaign) as utm_campaign,
      max(metric.campaign_id) as campaign_id,
      metric.ad_group_id,
      metric.ad_group_name,
      metric.keyword,
      metric.match_type,
      metric.network,
      min(metric.utm_content) as content,
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
      coalesce(metric.campaign_id, metric.utm_campaign, 'Not set'),
      metric.ad_group_id,
      metric.ad_group_name,
      metric.keyword,
      metric.match_type,
      metric.network,
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
        'durationMs', greatest(0, round(
          extract(epoch from (recent.last_seen_at - recent.started_at)) * 1000
        ))::bigint,
        'seededAt', recent.seeded_at,
        'landingPath', recent.landing_path,
        'lastPath', recent.last_path,
        'engagedMs', recent.engaged_ms,
        'maxScrollDepth', recent.max_scroll_depth,
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
          'campaignId', recent.campaign_id,
          'campaignName', recent.campaign_name,
          'adGroupId', recent.ad_group_id,
          'adGroupName', recent.ad_group_name,
          'keyword', recent.keyword,
          'matchType', recent.match_type,
          'network', recent.network,
          'adDevice', recent.ad_device,
          'creativeId', recent.creative_id,
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
      'paidTherapyConversions', total.paid_therapy_conversions,
      'sessionsWithoutEvents', total.sessions_without_events,
      'attributedSessions', total.attributed_sessions
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
        'campaign', coalesce(campaign.campaign_name, campaign.utm_campaign, 'Not set'),
        'campaignId', campaign.campaign_id,
        'campaignName', campaign.campaign_name,
        'content', campaign.content,
        'adGroupId', campaign.ad_group_id,
        'adGroupName', campaign.ad_group_name,
        'keyword', campaign.keyword,
        'matchType', campaign.match_type,
        'network', campaign.network,
        'googleClickIdPresent', campaign.google_click_id_present,
        'sessions', campaign.sessions,
        'engagedSessions', campaign.engaged_sessions,
        'consultationCtaSessions', campaign.consultation_cta_sessions,
        'formStarts', campaign.form_starts,
        'consultationRequests', campaign.consultation_requests,
        'bookedConsultations', campaign.booked_consultations,
        'paidTherapyConversions', campaign.paid_therapy_conversions
      ) order by campaign.sessions desc, campaign.campaign_key, campaign.keyword)
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

-- Clone the live contract byte-for-byte for the protected Test QA view, the
-- same way the original QA-visibility migration did.
do $install_google_ads_test_dashboard$
declare
  v_live_definition text;
  v_test_definition text;
  v_name_anchor text := 'FUNCTION public.get_google_ads_dashboard(';
  v_session_anchor text := 'and not ads_session.is_test';
  v_lead_anchor text := 'where not lead.is_test';
begin
  select pg_get_functiondef(
    'public.get_google_ads_dashboard(timestamptz,timestamptz)'::regprocedure
  ) into strict v_live_definition;

  if (length(v_live_definition) - length(replace(v_live_definition, v_name_anchor, '')))
       / length(v_name_anchor) <> 1 or
     (length(v_live_definition) - length(replace(v_live_definition, v_session_anchor, '')))
       / length(v_session_anchor) <> 1 or
     (length(v_live_definition) - length(replace(v_live_definition, v_lead_anchor, '')))
       / length(v_lead_anchor) <> 1 then
    raise exception 'Unexpected get_google_ads_dashboard definition; cannot clone the QA view.';
  end if;

  v_test_definition := replace(
    v_live_definition, v_name_anchor, 'FUNCTION public.get_google_ads_test_dashboard('
  );
  v_test_definition := replace(v_test_definition, v_session_anchor, 'and ads_session.is_test');
  v_test_definition := replace(v_test_definition, v_lead_anchor, 'where lead.is_test');
  if v_test_definition = v_live_definition or
     v_test_definition like '%not ads_session.is_test%' or
     v_test_definition like '%not lead.is_test%' then
    raise exception 'Could not safely clone get_google_ads_test_dashboard.';
  end if;
  execute v_test_definition;
end;
$install_google_ads_test_dashboard$;

-- Paginated CSV export sources. Both return closed structural fields only.
create or replace function public.export_google_ads_journeys(
  p_from timestamptz,
  p_to timestamptz,
  p_test boolean,
  p_limit integer,
  p_offset integer
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
  v_test boolean := coalesce(p_test, false);
  v_limit integer := least(greatest(coalesce(p_limit, 500), 1), 2000);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_result jsonb;
begin
  if v_from >= v_to or
     v_to > statement_timestamp() + interval '10 minutes' or
     v_to - v_from > interval '10 years' then
    raise exception using errcode = '22023', message = 'Invalid Google Ads export range.';
  end if;

  select coalesce(
    jsonb_agg(row_data.item order by row_data.started_at desc, row_data.session_key),
    '[]'::jsonb
  )
  into v_result
  from (
    select
      ads_session.started_at,
      ads_session.session_key,
      jsonb_build_object(
        'sessionId', ads_session.session_key,
        'startedAt', ads_session.started_at,
        'lastSeenAt', ads_session.last_seen_at,
        'durationMs', greatest(0, round(
          extract(epoch from (ads_session.last_seen_at - ads_session.started_at)) * 1000
        ))::bigint,
        'seededAt', ads_session.seeded_at,
        'landingPath', ads_session.landing_path,
        'lastPath', ads_session.last_path,
        'lastEvent', ads_session.last_event_name,
        'device', ads_session.device_category,
        'adDevice', ads_session.ad_device,
        'source', ads_session.utm_source,
        'medium', ads_session.utm_medium,
        'campaign', ads_session.utm_campaign,
        'content', ads_session.utm_content,
        'campaignId', ads_session.campaign_id,
        'campaignName', ads_session.campaign_name,
        'adGroupId', ads_session.ad_group_id,
        'adGroupName', ads_session.ad_group_name,
        'keyword', ads_session.keyword,
        'matchType', ads_session.match_type,
        'network', ads_session.network,
        'creativeId', ads_session.creative_id,
        'googleClickIdPresent', coalesce(ads_session.google_click_id_present, false),
        'referrerHost', ads_session.referrer_host,
        'engagedMs', ads_session.engaged_ms,
        'maxScrollDepth', ads_session.max_scroll_depth,
        'eventCount', ads_session.event_count,
        'pageViews', coalesce(activity.page_views, 0),
        'pagesViewed', coalesce(activity.pages_viewed, 0),
        'consultationCtaClicked', ads_session.consultation_cta_clicked,
        'formStarted', ads_session.form_started,
        'consultationSubmitted', lead.id is not null,
        'thankYouViewed', ads_session.thank_you_viewed,
        'consultationReferenceId', case
          when lead.id is not null then link.consultation_reference_id
        end,
        'workflowStatus', lead.workflow_status,
        'conversionStage', lead.conversion_stage,
        'booked', coalesce(
          lead.booked_at is not null and lead.workflow_status <> 'duplicate', false
        ),
        'bookedAt', lead.booked_at,
        'paidTherapy', coalesce(
          lead.paid_therapy_at is not null and lead.workflow_status <> 'duplicate', false
        ),
        'paidTherapyAt', lead.paid_therapy_at,
        'isTest', ads_session.is_test
      ) as item
    from public.google_ads_sessions as ads_session
    left join public.google_ads_consultations as link
      on link.session_id = ads_session.id
    left join public.consultation_leads as lead
      on lead.id = link.lead_id and lead.is_test = v_test
    left join lateral (
      select
        count(*) filter (where event.event_name = 'page_viewed')::integer
          as page_views,
        count(distinct event.path) filter (where event.event_name = 'page_viewed')::integer
          as pages_viewed
      from public.google_ads_events as event
      where event.session_id = ads_session.id
    ) as activity on true
    where ads_session.started_at >= v_from
      and ads_session.started_at < v_to
      and ads_session.is_test = v_test
    order by ads_session.started_at desc, ads_session.session_key
    limit v_limit offset v_offset
  ) as row_data;

  return v_result;
end;
$$;

create or replace function public.export_google_ads_journey_events(
  p_from timestamptz,
  p_to timestamptz,
  p_test boolean,
  p_limit integer,
  p_offset integer
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
  v_test boolean := coalesce(p_test, false);
  v_limit integer := least(greatest(coalesce(p_limit, 1000), 1), 5000);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_result jsonb;
begin
  if v_from >= v_to or
     v_to > statement_timestamp() + interval '10 minutes' or
     v_to - v_from > interval '10 years' then
    raise exception using errcode = '22023', message = 'Invalid Google Ads export range.';
  end if;

  select coalesce(
    jsonb_agg(row_data.item order by
      row_data.started_at desc, row_data.session_key, row_data.sequence),
    '[]'::jsonb
  )
  into v_result
  from (
    select
      ads_session.started_at,
      ads_session.session_key,
      event.sequence,
      jsonb_build_object(
        'sessionId', ads_session.session_key,
        'sessionStartedAt', ads_session.started_at,
        'eventId', event.client_event_id,
        'sequence', event.sequence,
        'occurredAt', event.occurred_at,
        'elapsedMs', event.elapsed_ms,
        'event', event.event_name,
        'path', event.path,
        'section', event.section_id,
        'targetType', event.target_type,
        'targetPath', event.target_path,
        'targetId', event.target_id,
        'ctaPlacement', event.cta_placement,
        'therapistId', event.therapist_id,
        'engagedMs', event.engaged_ms,
        'scrollDepth', event.scroll_depth,
        'formStep', event.form_step
      ) as item
    from public.google_ads_events as event
    join public.google_ads_sessions as ads_session
      on ads_session.id = event.session_id
    where ads_session.started_at >= v_from
      and ads_session.started_at < v_to
      and ads_session.is_test = v_test
    order by ads_session.started_at desc, ads_session.session_key, event.sequence
    limit v_limit offset v_offset
  ) as row_data;

  return v_result;
end;
$$;

revoke all on function public.is_google_ads_click_attribution_valid(
  text, text, text, text, text, text, text, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.google_ads_value_track_field(text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.seed_google_ads_session(
  text, timestamptz, text, text, text, text, text, boolean,
  text, text, text, text, text, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.get_google_ads_dashboard(timestamptz, timestamptz)
  from public, anon, authenticated;
revoke all on function public.get_google_ads_test_dashboard(timestamptz, timestamptz)
  from public, anon, authenticated;
revoke all on function public.export_google_ads_journeys(
  timestamptz, timestamptz, boolean, integer, integer
) from public, anon, authenticated;
revoke all on function public.export_google_ads_journey_events(
  timestamptz, timestamptz, boolean, integer, integer
) from public, anon, authenticated;

grant execute on function public.seed_google_ads_session(
  text, timestamptz, text, text, text, text, text, boolean,
  text, text, text, text, text, text, text, text, text
) to service_role;
grant execute on function public.get_google_ads_dashboard(timestamptz, timestamptz)
  to service_role;
grant execute on function public.get_google_ads_test_dashboard(timestamptz, timestamptz)
  to service_role;
grant execute on function public.export_google_ads_journeys(
  timestamptz, timestamptz, boolean, integer, integer
) to service_role;
grant execute on function public.export_google_ads_journey_events(
  timestamptz, timestamptz, boolean, integer, integer
) to service_role;

-- Transactional self-test: seed a click-time session, ingest an event batch
-- through the production RPC, re-seed idempotently, read it back through the
-- QA dashboard and both exports, prove the live dashboard excludes it, then
-- roll every diagnostic write back with the deliberate ZX001 exception. Any
-- genuine failure escapes and aborts this migration before commit.
do $verify_google_ads_click_attribution$
declare
  v_key text := 'gas-migration-qa-20260903000000-0001';
  v_started timestamptz := statement_timestamp() - interval '2 minutes';
  v_content text := 'vt1~a:7639334819~n:Therapy-Ontario~k:online therapy ontario';
  v_result jsonb;
  v_dashboard jsonb;
  v_rows jsonb;
begin
  begin
    select public.seed_google_ads_session(
      p_session_key => v_key,
      p_session_started_at => v_started,
      p_landing_path => '/welcome',
      p_utm_source => 'google',
      p_utm_medium => 'cpc',
      p_utm_campaign => 'manual_test',
      p_utm_content => v_content,
      p_google_click_id_present => true,
      p_campaign_id => '18124413697',
      p_campaign_name => 'Migration QA',
      p_ad_group_id => '7639334819',
      p_ad_group_name => 'Therapy-Ontario',
      p_keyword => 'online therapy ontario',
      p_match_type => 'phrase',
      p_network => 'search',
      p_ad_device => 'mobile',
      p_creative_id => '123456789012'
    ) into v_result;
    if not coalesce((v_result ->> 'accepted')::boolean, false) or
       not coalesce((v_result ->> 'seeded')::boolean, false) then
      raise exception 'Self-test: seed_google_ads_session did not create the session.';
    end if;

    select public.ingest_google_ads_events(
      v_key,
      v_started,
      '/welcome',
      jsonb_build_array(
        jsonb_build_object(
          'eventId', 'gae-migration-qa-20260903000000-0001',
          'sequence', 1,
          'occurredAt', v_started,
          'event', 'journey_started',
          'path', '/welcome',
          'elapsedMs', 0,
          'deviceCategory', 'mobile',
          'utmSource', 'google',
          'utmMedium', 'cpc',
          'utmCampaign', 'manual_test',
          'utmContent', v_content,
          'googleClickIdPresent', true
        ),
        jsonb_build_object(
          'eventId', 'gae-migration-qa-20260903000000-0002',
          'sequence', 2,
          'occurredAt', v_started + interval '5 seconds',
          'event', 'engagement_ping',
          'path', '/welcome',
          'engagedMs', 5000,
          'elapsedMs', 5000,
          'deviceCategory', 'mobile',
          'utmSource', 'google',
          'utmMedium', 'cpc',
          'utmCampaign', 'manual_test',
          'utmContent', v_content,
          'googleClickIdPresent', true
        )
      )
    ) into v_result;
    if not coalesce((v_result ->> 'accepted')::boolean, false) or
       (v_result ->> 'acceptedEvents')::integer <> 2 then
      raise exception 'Self-test: ingest_google_ads_events rejected a seeded session.';
    end if;

    select public.seed_google_ads_session(
      p_session_key => v_key,
      p_session_started_at => v_started,
      p_landing_path => '/welcome',
      p_utm_source => 'google',
      p_utm_medium => 'cpc',
      p_utm_campaign => 'manual_test',
      p_utm_content => v_content,
      p_google_click_id_present => true,
      p_campaign_id => '18124413697',
      p_campaign_name => 'Migration QA',
      p_ad_group_id => '7639334819',
      p_ad_group_name => 'Therapy-Ontario',
      p_keyword => 'online therapy ontario',
      p_match_type => 'phrase',
      p_network => 'search',
      p_ad_device => 'mobile',
      p_creative_id => '123456789012'
    ) into v_result;
    if not coalesce((v_result ->> 'accepted')::boolean, false) or
       coalesce((v_result ->> 'seeded')::boolean, true) then
      raise exception 'Self-test: repeated seed was not idempotent.';
    end if;

    select public.get_google_ads_test_dashboard(
      v_started - interval '1 hour', statement_timestamp() + interval '1 minute'
    ) into v_dashboard;
    if (v_dashboard -> 'kpis' ->> 'sessions')::integer < 1 or
       (v_dashboard -> 'kpis' ->> 'attributedSessions')::integer < 1 then
      raise exception 'Self-test: QA dashboard did not count the seeded session.';
    end if;
    if not exists (
      select 1
      from jsonb_array_elements(v_dashboard -> 'recentSessions') as recent
      where recent.value ->> 'sessionId' = v_key
        and recent.value -> 'attribution' ->> 'campaignName' = 'Migration QA'
        and recent.value -> 'attribution' ->> 'campaignId' = '18124413697'
        and recent.value -> 'attribution' ->> 'adGroupName' = 'Therapy-Ontario'
        and recent.value -> 'attribution' ->> 'keyword' = 'online therapy ontario'
        and recent.value -> 'attribution' ->> 'matchType' = 'phrase'
        and recent.value -> 'attribution' ->> 'network' = 'search'
        and (recent.value ->> 'engagedMs')::integer = 5000
        and (recent.value ->> 'eventCount')::integer = 2
        and recent.value ->> 'seededAt' is not null
    ) then
      raise exception 'Self-test: QA dashboard attribution is incomplete.';
    end if;
    if not exists (
      select 1
      from jsonb_array_elements(v_dashboard -> 'campaigns') as campaign
      where campaign.value ->> 'campaignName' = 'Migration QA'
        and campaign.value ->> 'campaign' = 'Migration QA'
        and campaign.value ->> 'adGroupName' = 'Therapy-Ontario'
        and campaign.value ->> 'keyword' = 'online therapy ontario'
        and (campaign.value ->> 'sessions')::integer >= 1
    ) then
      raise exception 'Self-test: QA campaign breakdown is incomplete.';
    end if;

    select public.export_google_ads_journeys(
      v_started - interval '1 hour', statement_timestamp() + interval '1 minute',
      true, 100, 0
    ) into v_rows;
    if not exists (
      select 1
      from jsonb_array_elements(v_rows) as journey
      where journey.value ->> 'sessionId' = v_key
        and journey.value ->> 'keyword' = 'online therapy ontario'
        and journey.value ->> 'campaignName' = 'Migration QA'
        and (journey.value ->> 'eventCount')::integer = 2
        and (journey.value ->> 'pageViews')::integer = 0
        and (journey.value ->> 'isTest')::boolean
    ) then
      raise exception 'Self-test: journey export is incomplete.';
    end if;

    select public.export_google_ads_journey_events(
      v_started - interval '1 hour', statement_timestamp() + interval '1 minute',
      true, 100, 0
    ) into v_rows;
    if (
      select count(*)
      from jsonb_array_elements(v_rows) as event
      where event.value ->> 'sessionId' = v_key
    ) <> 2 then
      raise exception 'Self-test: event export is incomplete.';
    end if;

    select public.get_google_ads_dashboard(
      v_started - interval '1 hour', statement_timestamp() + interval '1 minute'
    ) into v_dashboard;
    if exists (
      select 1
      from jsonb_array_elements(v_dashboard -> 'recentSessions') as recent
      where recent.value ->> 'sessionId' = v_key
    ) then
      raise exception 'Self-test: live dashboard exposed a test session.';
    end if;

    raise exception using
      errcode = 'ZX001',
      message = 'Rollback successful Google Ads click-attribution self-test.';
  exception
    when sqlstate 'ZX001' then
      null;
  end;
end;
$verify_google_ads_click_attribution$;

commit;

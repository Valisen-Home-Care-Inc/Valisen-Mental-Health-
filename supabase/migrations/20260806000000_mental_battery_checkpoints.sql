-- Mental Battery Checkpoints
--
-- Privacy boundary: these tables contain anonymous behavioural events only. They
-- intentionally have no questionnaire-answer, visitor-provided free text,
-- name, email, phone, IP-address, user-agent, fingerprint, advertising-ID, or
-- geolocation-coordinate columns. Placement notes are administrator-authored
-- operational metadata and never accept public input.

begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;
set local search_path = pg_catalog, public, extensions;

create table public.checkpoints (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique,
  status text not null default 'active',
  created_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp(),
  constraint checkpoints_code_format check (code ~ '^VMH-(0[1-9]|10)$'),
  constraint checkpoints_status_allowed check (status in ('active', 'inactive'))
);

create table public.checkpoint_placements (
  id uuid primary key default extensions.gen_random_uuid(),
  checkpoint_id uuid not null references public.checkpoints(id) on delete restrict,
  partner_name text not null,
  location_name text not null,
  location_notes text,
  status text not null default 'assigned',
  started_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default transaction_timestamp(),
  constraint checkpoint_placements_id_checkpoint_unique unique (id, checkpoint_id),
  constraint checkpoint_placements_partner_name_valid
    check (char_length(btrim(partner_name)) between 1 and 160),
  constraint checkpoint_placements_location_name_valid
    check (char_length(btrim(location_name)) between 1 and 200),
  constraint checkpoint_placements_location_notes_valid
    check (location_notes is null or char_length(location_notes) <= 1000),
  constraint checkpoint_placements_status_allowed
    check (status in ('assigned', 'unassigned')),
  constraint checkpoint_placements_interval_valid
    check (ended_at is null or ended_at > started_at),
  constraint checkpoint_placements_do_not_overlap
    exclude using gist (
      checkpoint_id with =,
      tstzrange(started_at, ended_at, '[)') with &&
    ) deferrable initially immediate
);

-- There may be scheduled placements, but only the final placement in a
-- checkpoint's timeline may be open-ended.
create unique index checkpoint_placements_one_open_ended
  on public.checkpoint_placements (checkpoint_id)
  where ended_at is null;

create index checkpoint_placements_checkpoint_started_idx
  on public.checkpoint_placements (checkpoint_id, started_at desc);

create table public.funnel_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  anonymous_session_id uuid not null unique,
  checkpoint_id uuid not null references public.checkpoints(id) on delete restrict,
  placement_id uuid not null,
  started_at timestamptz not null,
  last_event_at timestamptz not null,
  created_at timestamptz not null default transaction_timestamp(),
  constraint funnel_sessions_id_checkpoint_placement_unique
    unique (id, checkpoint_id, placement_id),
  constraint funnel_sessions_id_attribution_unique
    unique (id, anonymous_session_id, checkpoint_id, placement_id),
  constraint funnel_sessions_placement_belongs_to_checkpoint
    foreign key (placement_id, checkpoint_id)
    references public.checkpoint_placements(id, checkpoint_id)
    on delete restrict
);

create index funnel_sessions_checkpoint_started_idx
  on public.funnel_sessions (checkpoint_id, started_at desc);
create index funnel_sessions_placement_started_idx
  on public.funnel_sessions (placement_id, started_at desc);

create table public.funnel_events (
  id uuid primary key default extensions.gen_random_uuid(),
  client_event_id uuid not null unique,
  session_id uuid not null,
  checkpoint_id uuid not null,
  placement_id uuid not null,
  event_name text not null,
  step_number smallint,
  occurred_at timestamptz not null,
  created_at timestamptz not null default transaction_timestamp(),
  constraint funnel_events_session_attribution_matches
    foreign key (session_id, checkpoint_id, placement_id)
    references public.funnel_sessions(id, checkpoint_id, placement_id)
    on delete restrict,
  constraint funnel_events_name_allowed check (
    event_name in (
      'landing_view',
      'checkin_started',
      'checkin_step_completed',
      'checkin_completed',
      'result_viewed',
      'therapist_cta_clicked',
      'consultation_started',
      'consultation_submitted',
      'external_booking_clicked'
    )
  ),
  constraint funnel_events_payload_shape check (
    (event_name = 'checkin_step_completed' and step_number between 1 and 4)
    or
    (event_name <> 'checkin_step_completed' and step_number is null)
  )
);

-- Logical uniqueness prevents React rerenders/retries from inflating metrics.
-- client_event_id independently makes transport retries idempotent.
create unique index funnel_events_logical_event_unique
  on public.funnel_events (
    session_id,
    event_name,
    coalesce(step_number, 0)
  );
create index funnel_events_session_name_idx
  on public.funnel_events (session_id, event_name);
create index funnel_events_checkpoint_occurred_idx
  on public.funnel_events (checkpoint_id, occurred_at desc);

create table public.consultation_attributions (
  id uuid primary key default extensions.gen_random_uuid(),
  consultation_reference_id text not null unique,
  session_id uuid not null unique,
  anonymous_session_id uuid not null,
  checkpoint_id uuid not null,
  placement_id uuid not null,
  source text not null default 'mental_battery_checkpoint',
  status text not null default 'submitted',
  submitted_at timestamptz not null,
  updated_at timestamptz not null default transaction_timestamp(),
  constraint consultation_attributions_reference_valid check (
    consultation_reference_id ~ '^[A-Za-z0-9][A-Za-z0-9_-]{5,119}$'
  ),
  constraint consultation_attributions_source_fixed
    check (source = 'mental_battery_checkpoint'),
  constraint consultation_attributions_status_allowed check (
    status in ('submitted', 'contacted', 'scheduled', 'closed', 'not_a_fit')
  ),
  constraint consultation_attributions_session_attribution_matches
    foreign key (
      session_id,
      anonymous_session_id,
      checkpoint_id,
      placement_id
    ) references public.funnel_sessions(
      id,
      anonymous_session_id,
      checkpoint_id,
      placement_id
    ) on delete restrict
);

create index consultation_attributions_checkpoint_submitted_idx
  on public.consultation_attributions (checkpoint_id, submitted_at desc);
create index consultation_attributions_placement_submitted_idx
  on public.consultation_attributions (placement_id, submitted_at desc);

comment on table public.funnel_sessions is
  'Anonymous Mental Battery sessions. Contains no PII or wellness answers.';
comment on table public.funnel_events is
  'Strictly allowlisted behavioural events. step_number is the only event detail.';
comment on table public.consultation_attributions is
  'Non-PII bridge to the existing consultation system using its opaque reference ID.';

insert into public.checkpoints (code)
select 'VMH-' || lpad(series::text, 2, '0')
from generate_series(1, 10) as series
on conflict (code) do nothing;

insert into public.checkpoint_placements (
  checkpoint_id,
  partner_name,
  location_name,
  status,
  started_at
)
select
  checkpoint.id,
  'Unassigned',
  'Unassigned',
  'unassigned',
  transaction_timestamp()
from public.checkpoints as checkpoint
where checkpoint.code ~ '^VMH-(0[1-9]|10)$'
  and not exists (
    select 1
    from public.checkpoint_placements as existing
    where existing.checkpoint_id = checkpoint.id
  );

create or replace function public.move_checkpoint(
  p_checkpoint_code text,
  p_partner_name text,
  p_location_name text,
  p_location_notes text default null,
  p_effective_at timestamptz default transaction_timestamp()
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_checkpoint public.checkpoints%rowtype;
  v_covering public.checkpoint_placements%rowtype;
  v_exact public.checkpoint_placements%rowtype;
  v_next_started_at timestamptz;
  v_previous_placement_id uuid;
  v_new public.checkpoint_placements%rowtype;
  v_partner_name text := btrim(p_partner_name);
  v_location_name text := btrim(p_location_name);
  v_location_notes text := nullif(btrim(p_location_notes), '');
  v_effective_at timestamptz := p_effective_at;
begin
  if p_checkpoint_code is null or p_checkpoint_code !~ '^VMH-(0[1-9]|10)$' then
    raise exception using errcode = '22023', message = 'Invalid checkpoint code.';
  end if;
  if v_partner_name is null or char_length(v_partner_name) not between 1 and 160 then
    raise exception using errcode = '22023', message = 'Partner name must be 1 to 160 characters.';
  end if;
  if v_location_name is null or char_length(v_location_name) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'Location name must be 1 to 200 characters.';
  end if;
  if v_location_notes is not null and char_length(v_location_notes) > 1000 then
    raise exception using errcode = '22023', message = 'Location notes must be at most 1000 characters.';
  end if;
  if v_effective_at is null
     or v_effective_at < transaction_timestamp() - interval '5 minutes' then
    raise exception using
      errcode = '22023',
      message = 'A checkpoint move cannot be backdated; choose now or a future time.';
  end if;

  select checkpoint.*
  into strict v_checkpoint
  from public.checkpoints as checkpoint
  where checkpoint.code = p_checkpoint_code
  for update;

  if v_checkpoint.status <> 'active' then
    raise exception using errcode = '55000', message = 'Checkpoint is inactive.';
  end if;

  -- Treat a near-current admin timestamp as "now" after acquiring the lock.
  -- This prevents an event that won the lock first from falling outside the
  -- placement interval when the move transaction had to wait.
  if v_effective_at <= clock_timestamp() then
    v_effective_at := clock_timestamp();
  end if;

  -- Replacing an as-yet-unused schedule at the exact same instant is safe and
  -- makes admin retries deterministic. A placement with traffic is immutable.
  select placement.*
  into v_exact
  from public.checkpoint_placements as placement
  where placement.checkpoint_id = v_checkpoint.id
    and placement.started_at = v_effective_at
  for update;

  if found then
    if exists (
      select 1
      from public.funnel_sessions as session
      where session.placement_id = v_exact.id
    ) then
      raise exception using
        errcode = '55000',
        message = 'That placement already has traffic and cannot be replaced.';
    end if;

    update public.checkpoint_placements
    set partner_name = v_partner_name,
        location_name = v_location_name,
        location_notes = v_location_notes,
        status = 'assigned'
    where id = v_exact.id
    returning * into v_new;

    update public.checkpoints
    set updated_at = clock_timestamp()
    where id = v_checkpoint.id;

    select placement.id
    into v_previous_placement_id
    from public.checkpoint_placements as placement
    where placement.checkpoint_id = v_checkpoint.id
      and placement.ended_at = v_new.started_at
    order by placement.started_at desc
    limit 1;

    return jsonb_build_object(
      'checkpointCode', v_checkpoint.code,
      'previousPlacementId', v_previous_placement_id,
      'placementId', v_new.id,
      'effectiveAt', v_new.started_at
    );
  end if;

  select placement.*
  into v_covering
  from public.checkpoint_placements as placement
  where placement.checkpoint_id = v_checkpoint.id
    and placement.started_at < v_effective_at
    and (placement.ended_at is null or placement.ended_at > v_effective_at)
  order by placement.started_at desc
  limit 1
  for update;

  select min(placement.started_at)
  into v_next_started_at
  from public.checkpoint_placements as placement
  where placement.checkpoint_id = v_checkpoint.id
    and placement.started_at > v_effective_at;

  if v_covering.id is not null then
    v_previous_placement_id := v_covering.id;
    update public.checkpoint_placements
    set ended_at = v_effective_at
    where id = v_covering.id;
  end if;

  insert into public.checkpoint_placements (
    checkpoint_id,
    partner_name,
    location_name,
    location_notes,
    status,
    started_at,
    ended_at
  ) values (
    v_checkpoint.id,
    v_partner_name,
    v_location_name,
    v_location_notes,
    'assigned',
    v_effective_at,
    v_next_started_at
  )
  returning * into v_new;

  update public.checkpoints
  set updated_at = clock_timestamp()
  where id = v_checkpoint.id;

  return jsonb_build_object(
    'checkpointCode', v_checkpoint.code,
    'previousPlacementId', v_previous_placement_id,
    'placementId', v_new.id,
    'effectiveAt', v_new.started_at
  );
exception
  when no_data_found then
    raise exception using errcode = 'P0002', message = 'Checkpoint not found.';
end;
$$;

create or replace function public.get_checkpoint_detail(
  p_checkpoint_code text,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_generated_at timestamptz := statement_timestamp();
  v_from timestamptz := p_from;
  v_to timestamptz := coalesce(p_to, statement_timestamp());
  v_checkpoint public.checkpoints%rowtype;
  v_current public.checkpoint_placements%rowtype;
  v_result jsonb;
begin
  if p_checkpoint_code is null or p_checkpoint_code !~ '^VMH-(0[1-9]|10)$' then
    raise exception using errcode = '22023', message = 'Invalid checkpoint code.';
  end if;

  select checkpoint.*
  into strict v_checkpoint
  from public.checkpoints as checkpoint
  where checkpoint.code = p_checkpoint_code;

  select placement.*
  into v_current
  from public.checkpoint_placements as placement
  where placement.checkpoint_id = v_checkpoint.id
    and placement.started_at <= v_generated_at
    and (placement.ended_at is null or placement.ended_at > v_generated_at)
  order by placement.started_at desc
  limit 1;

  if v_from is null then
    select min(session.started_at)
    into v_from
    from public.funnel_sessions as session
    where session.checkpoint_id = v_checkpoint.id;

    v_from := coalesce(
      v_from,
      date_trunc('day', v_generated_at at time zone 'America/Toronto')
        at time zone 'America/Toronto'
    );
  end if;

  if not isfinite(v_from) or not isfinite(v_to) or v_from >= v_to then
    raise exception using
      errcode = '22023',
      message = 'Date range must contain finite timestamps with from before to.';
  end if;

  with cohort_sessions as (
    select session.*
    from public.funnel_sessions as session
    where session.checkpoint_id = v_checkpoint.id
      and session.started_at >= v_from
      and session.started_at < v_to
  ),
  cohort_flags as (
    select
      session.id,
      session.placement_id,
      session.started_at,
      coalesce(
        max(event.step_number) filter (where event.event_name = 'checkin_step_completed'),
        0
      )::integer as last_step_completed,
      coalesce(bool_or(event.event_name in (
        'checkin_started',
        'checkin_step_completed',
        'checkin_completed',
        'result_viewed',
        'therapist_cta_clicked',
        'consultation_started',
        'consultation_submitted',
        'external_booking_clicked'
      )), false) as checkin_started,
      coalesce(bool_or(event.event_name in (
        'checkin_completed',
        'result_viewed',
        'therapist_cta_clicked',
        'consultation_started',
        'consultation_submitted',
        'external_booking_clicked'
      )), false) as checkin_completed,
      coalesce(bool_or(event.event_name in (
        'result_viewed',
        'therapist_cta_clicked',
        'consultation_started',
        'consultation_submitted',
        'external_booking_clicked'
      )), false) as result_viewed,
      coalesce(bool_or(event.event_name in (
        'therapist_cta_clicked',
        'consultation_started',
        'consultation_submitted',
        'external_booking_clicked'
      )), false) as therapist_intent,
      coalesce(bool_or(event.event_name in (
        'consultation_started',
        'consultation_submitted',
        'external_booking_clicked'
      )), false) as consultation_started,
      coalesce(bool_or(event.event_name = 'consultation_submitted'), false) as consultation_submitted,
      coalesce(bool_or(event.event_name = 'external_booking_clicked'), false) as external_booking_clicked
    from cohort_sessions as session
    left join public.funnel_events as event on event.session_id = session.id
    group by session.id, session.placement_id, session.started_at
  ),
  totals as (
    select
      count(*)::bigint as sessions,
      count(*) filter (where checkin_started)::bigint as checkins_started,
      count(*) filter (where checkin_completed)::bigint as checkins_completed,
      count(*) filter (where result_viewed)::bigint as result_views,
      count(*) filter (where therapist_intent)::bigint as therapist_intent,
      count(*) filter (where consultation_started)::bigint as consultations_started,
      count(*) filter (where consultation_submitted)::bigint as consultations_submitted,
      count(*) filter (where external_booking_clicked)::bigint as external_booking_clicks
    from cohort_flags
  ),
  question_step_counts as (
    select
      question.step_number,
      count(flag.id) filter (
        where case question.step_number
            when 1 then flag.checkin_started
            else flag.checkin_completed
              or flag.last_step_completed >= question.step_number - 1
          end
      )::bigint as reached,
      count(flag.id) filter (
        where flag.checkin_completed
          or flag.last_step_completed >= question.step_number
      )::bigint as completed
    from generate_series(1, 4) as question(step_number)
    left join cohort_flags as flag on true
    group by question.step_number
  ),
  question_step_rows as (
    select
      question.step_number,
      question.reached,
      question.completed,
      greatest(question.reached - question.completed, 0)::bigint as drop_offs
    from question_step_counts as question
    order by question.step_number
  ),
  all_session_flags as (
    select
      session.id,
      coalesce(bool_or(event.event_name in (
        'checkin_started',
        'checkin_step_completed',
        'checkin_completed',
        'result_viewed',
        'therapist_cta_clicked',
        'consultation_started',
        'consultation_submitted',
        'external_booking_clicked'
      )), false) as checkin_started,
      coalesce(bool_or(event.event_name in (
        'checkin_completed',
        'result_viewed',
        'therapist_cta_clicked',
        'consultation_started',
        'consultation_submitted',
        'external_booking_clicked'
      )), false) as checkin_completed,
      coalesce(bool_or(event.event_name in (
        'therapist_cta_clicked',
        'consultation_started',
        'consultation_submitted',
        'external_booking_clicked'
      )), false) as therapist_intent,
      coalesce(bool_or(event.event_name = 'consultation_submitted'), false) as consultation_submitted
    from public.funnel_sessions as session
    left join public.funnel_events as event on event.session_id = session.id
    where session.checkpoint_id = v_checkpoint.id
    group by session.id
  ),
  all_totals as (
    select
      count(*)::bigint as sessions,
      count(*) filter (where checkin_started)::bigint as checkins_started,
      count(*) filter (where checkin_completed)::bigint as checkins_completed,
      count(*) filter (where therapist_intent)::bigint as therapist_intent,
      count(*) filter (where consultation_submitted)::bigint as consultations_submitted
    from all_session_flags
  ),
  daily_rows as (
    select
      day_series.day::date as day,
      count(flag.id)::bigint as sessions,
      count(flag.id) filter (where flag.checkin_started)::bigint as checkins_started,
      count(flag.id) filter (where flag.checkin_completed)::bigint as checkins_completed,
      count(flag.id) filter (where flag.therapist_intent)::bigint as therapist_intent,
      count(flag.id) filter (where flag.consultation_started)::bigint as consultations_started,
      count(flag.id) filter (where flag.consultation_submitted)::bigint as consultations_submitted
    from generate_series(
      (v_from at time zone 'America/Toronto')::date,
      ((v_to - interval '1 microsecond') at time zone 'America/Toronto')::date,
      interval '1 day'
    ) as day_series(day)
    left join cohort_flags as flag
      on (flag.started_at at time zone 'America/Toronto')::date = day_series.day::date
    group by day_series.day
    order by day_series.day
  ),
  day_of_week_rows as (
    select
      weekday.day_index,
      (array['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'])[
        weekday.day_index + 1
      ] as day_name,
      count(flag.id)::bigint as sessions,
      count(flag.id) filter (where flag.checkin_completed)::bigint as checkins_completed,
      count(flag.id) filter (where flag.therapist_intent)::bigint as therapist_intent,
      count(flag.id) filter (where flag.consultation_submitted)::bigint as consultations_submitted
    from generate_series(0, 6) as weekday(day_index)
    left join cohort_flags as flag
      on extract(dow from flag.started_at at time zone 'America/Toronto')::integer = weekday.day_index
    group by weekday.day_index
    order by weekday.day_index
  ),
  placement_rows as (
    select
      placement.id,
      placement.partner_name,
      placement.location_name,
      placement.location_notes,
      placement.status,
      placement.started_at,
      placement.ended_at,
      count(flag.id)::bigint as sessions,
      count(flag.id) filter (where flag.checkin_completed)::bigint as checkins_completed,
      count(flag.id) filter (where flag.therapist_intent)::bigint as therapist_intent,
      count(flag.id) filter (where flag.consultation_submitted)::bigint as consultations_submitted
    from public.checkpoint_placements as placement
    left join cohort_flags as flag on flag.placement_id = placement.id
    where placement.checkpoint_id = v_checkpoint.id
    group by placement.id
  ),
  lead_rows as (
    select jsonb_build_object(
      'referenceId', attribution.consultation_reference_id,
      'checkpointCode', v_checkpoint.code,
      'partnerName', placement.partner_name,
      'locationName', placement.location_name,
      'source', attribution.source,
      'status', attribution.status,
      'submittedAt', attribution.submitted_at
    ) as item,
    attribution.submitted_at
    from public.consultation_attributions as attribution
    join cohort_sessions as session on session.id = attribution.session_id
    join public.checkpoint_placements as placement on placement.id = attribution.placement_id
  )
  select jsonb_build_object(
    'generatedAt', v_generated_at,
    'range', jsonb_build_object('from', v_from, 'to', v_to),
    'checkpoint', jsonb_build_object(
      'code', v_checkpoint.code,
      'status', v_checkpoint.status,
      'createdAt', v_checkpoint.created_at,
      'currentPlacement', case
        when v_current.id is null then null
        else jsonb_build_object(
          'id', v_current.id,
          'partnerName', v_current.partner_name,
          'locationName', v_current.location_name,
          'startedAt', v_current.started_at
        )
      end
    ),
    'kpis', jsonb_build_object(
      'sessions', total.sessions,
      'checkinsStarted', total.checkins_started,
      'checkinsCompleted', total.checkins_completed,
      'completionRate', coalesce(
        round(100.0 * total.checkins_completed / nullif(total.checkins_started, 0), 1),
        0
      ),
      'resultViews', total.result_views,
      'therapistIntent', total.therapist_intent,
      'consultationsStarted', total.consultations_started,
      'consultationsSubmitted', total.consultations_submitted,
      'sessionToConsultationRate', coalesce(
        round(100.0 * total.consultations_submitted / nullif(total.sessions, 0), 1),
        0
      ),
      'externalBookingClicks', total.external_booking_clicks
    ),
    'cumulativeKpis', jsonb_build_object(
      'sessions', cumulative.sessions,
      'checkinsStarted', cumulative.checkins_started,
      'checkinsCompleted', cumulative.checkins_completed,
      'completionRate', coalesce(
        round(100.0 * cumulative.checkins_completed / nullif(cumulative.checkins_started, 0), 1),
        0
      ),
      'therapistIntent', cumulative.therapist_intent,
      'consultationsSubmitted', cumulative.consultations_submitted,
      'sessionToConsultationRate', coalesce(
        round(100.0 * cumulative.consultations_submitted / nullif(cumulative.sessions, 0), 1),
        0
      )
    ),
    'funnel', jsonb_build_array(
      jsonb_build_object('event', 'session', 'count', total.sessions),
      jsonb_build_object('event', 'checkin_started', 'count', total.checkins_started),
      jsonb_build_object('event', 'checkin_completed', 'count', total.checkins_completed),
      jsonb_build_object('event', 'result_viewed', 'count', total.result_views),
      jsonb_build_object('event', 'therapist_cta_clicked', 'count', total.therapist_intent),
      jsonb_build_object('event', 'consultation_started', 'count', total.consultations_started),
      jsonb_build_object('event', 'consultation_submitted', 'count', total.consultations_submitted)
    ),
    'questionSteps', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'stepNumber', question.step_number,
          'reached', question.reached,
          'completed', question.completed,
          'dropOffs', question.drop_offs,
          'completionRate', coalesce(
            round(100.0 * question.completed / nullif(question.reached, 0), 1),
            0
          ),
          'dropOffRate', coalesce(
            round(100.0 * question.drop_offs / nullif(question.reached, 0), 1),
            0
          )
        ) order by question.step_number
      )
      from question_step_rows as question
    ), '[]'::jsonb),
    'placements', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', placement.id,
          'partnerName', placement.partner_name,
          'locationName', placement.location_name,
          'locationNotes', placement.location_notes,
          'placementStatus', placement.status,
          'timelineStatus', case
            when placement.started_at > v_generated_at then 'scheduled'
            when placement.started_at <= v_generated_at
              and (placement.ended_at is null or placement.ended_at > v_generated_at) then 'current'
            else 'historical'
          end,
          'startedAt', placement.started_at,
          'endedAt', placement.ended_at,
          'sessions', placement.sessions,
          'checkinsCompleted', placement.checkins_completed,
          'therapistIntent', placement.therapist_intent,
          'consultationsSubmitted', placement.consultations_submitted,
          'sessionToConsultationRate', coalesce(
            round(100.0 * placement.consultations_submitted / nullif(placement.sessions, 0), 1),
            0
          )
        ) order by placement.started_at desc
      )
      from placement_rows as placement
    ), '[]'::jsonb),
    'daily', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'date', to_char(daily.day, 'YYYY-MM-DD'),
          'sessions', daily.sessions,
          'checkinsStarted', daily.checkins_started,
          'checkinsCompleted', daily.checkins_completed,
          'therapistIntent', daily.therapist_intent,
          'consultationsStarted', daily.consultations_started,
          'consultationsSubmitted', daily.consultations_submitted
        ) order by daily.day
      )
      from daily_rows as daily
    ), '[]'::jsonb),
    'dayOfWeek', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'day', weekday.day_name,
          'dayIndex', weekday.day_index,
          'sessions', weekday.sessions,
          'checkinsCompleted', weekday.checkins_completed,
          'therapistIntent', weekday.therapist_intent,
          'consultationsSubmitted', weekday.consultations_submitted
        ) order by weekday.day_index
      )
      from day_of_week_rows as weekday
    ), '[]'::jsonb),
    'leads', coalesce((
      select jsonb_agg(lead.item order by lead.submitted_at desc)
      from lead_rows as lead
    ), '[]'::jsonb)
  )
  into v_result
  from totals as total
  cross join all_totals as cumulative;

  return v_result;
exception
  when no_data_found then
    raise exception using errcode = 'P0002', message = 'Checkpoint not found.';
end;
$$;

create or replace function public.get_checkpoint_dashboard(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_generated_at timestamptz := statement_timestamp();
  v_from timestamptz := p_from;
  v_to timestamptz := coalesce(p_to, statement_timestamp());
  v_result jsonb;
begin
  if v_from is null then
    select min(session.started_at)
    into v_from
    from public.funnel_sessions as session;

    v_from := coalesce(
      v_from,
      date_trunc('day', v_generated_at at time zone 'America/Toronto')
        at time zone 'America/Toronto'
    );
  end if;

  if not isfinite(v_from) or not isfinite(v_to) or v_from >= v_to then
    raise exception using
      errcode = '22023',
      message = 'Date range must contain finite timestamps with from before to.';
  end if;

  with cohort_sessions as (
    select session.*
    from public.funnel_sessions as session
    where session.started_at >= v_from
      and session.started_at < v_to
  ),
  cohort_flags as (
    select
      session.id,
      session.checkpoint_id,
      session.placement_id,
      session.started_at,
      coalesce(
        max(event.step_number) filter (where event.event_name = 'checkin_step_completed'),
        0
      )::integer as last_step_completed,
      coalesce(bool_or(event.event_name in (
        'checkin_started',
        'checkin_step_completed',
        'checkin_completed',
        'result_viewed',
        'therapist_cta_clicked',
        'consultation_started',
        'consultation_submitted',
        'external_booking_clicked'
      )), false) as checkin_started,
      coalesce(bool_or(event.event_name in (
        'checkin_completed',
        'result_viewed',
        'therapist_cta_clicked',
        'consultation_started',
        'consultation_submitted',
        'external_booking_clicked'
      )), false) as checkin_completed,
      coalesce(bool_or(event.event_name in (
        'result_viewed',
        'therapist_cta_clicked',
        'consultation_started',
        'consultation_submitted',
        'external_booking_clicked'
      )), false) as result_viewed,
      coalesce(bool_or(event.event_name in (
        'therapist_cta_clicked',
        'consultation_started',
        'consultation_submitted',
        'external_booking_clicked'
      )), false) as therapist_intent,
      coalesce(bool_or(event.event_name in (
        'consultation_started',
        'consultation_submitted',
        'external_booking_clicked'
      )), false) as consultation_started,
      coalesce(bool_or(event.event_name = 'consultation_submitted'), false) as consultation_submitted,
      coalesce(bool_or(event.event_name = 'external_booking_clicked'), false) as external_booking_clicked
    from cohort_sessions as session
    left join public.funnel_events as event on event.session_id = session.id
    group by session.id, session.checkpoint_id, session.placement_id, session.started_at
  ),
  totals as (
    select
      count(*)::bigint as sessions,
      count(*) filter (where checkin_started)::bigint as checkins_started,
      count(*) filter (where checkin_completed)::bigint as checkins_completed,
      count(*) filter (where result_viewed)::bigint as result_views,
      count(*) filter (where therapist_intent)::bigint as therapist_intent,
      count(*) filter (where consultation_started)::bigint as consultations_started,
      count(*) filter (where consultation_submitted)::bigint as consultations_submitted,
      count(*) filter (where external_booking_clicked)::bigint as external_booking_clicks
    from cohort_flags
  ),
  question_step_counts as (
    select
      question.step_number,
      count(flag.id) filter (
        where case question.step_number
            when 1 then flag.checkin_started
            else flag.checkin_completed
              or flag.last_step_completed >= question.step_number - 1
          end
      )::bigint as reached,
      count(flag.id) filter (
        where flag.checkin_completed
          or flag.last_step_completed >= question.step_number
      )::bigint as completed
    from generate_series(1, 4) as question(step_number)
    left join cohort_flags as flag on true
    group by question.step_number
  ),
  question_step_rows as (
    select
      question.step_number,
      question.reached,
      question.completed,
      greatest(question.reached - question.completed, 0)::bigint as drop_offs
    from question_step_counts as question
    order by question.step_number
  ),
  checkpoint_metrics as (
    select
      checkpoint.id,
      checkpoint.code,
      checkpoint.status,
      checkpoint.created_at,
      count(flag.id)::bigint as sessions,
      count(flag.id) filter (where flag.checkin_started)::bigint as checkins_started,
      count(flag.id) filter (where flag.checkin_completed)::bigint as checkins_completed,
      count(flag.id) filter (where flag.result_viewed)::bigint as result_views,
      count(flag.id) filter (where flag.therapist_intent)::bigint as therapist_intent,
      count(flag.id) filter (where flag.consultation_started)::bigint as consultations_started,
      count(flag.id) filter (where flag.consultation_submitted)::bigint as consultations_submitted,
      count(flag.id) filter (where flag.external_booking_clicked)::bigint as external_booking_clicks
    from public.checkpoints as checkpoint
    left join cohort_flags as flag on flag.checkpoint_id = checkpoint.id
    group by checkpoint.id
  ),
  checkpoint_rows as (
    select
      metric.*,
      placement.id as current_placement_id,
      placement.partner_name as current_partner_name,
      placement.location_name as current_location_name,
      placement.started_at as current_started_at
    from checkpoint_metrics as metric
    left join lateral (
      select current_placement.*
      from public.checkpoint_placements as current_placement
      where current_placement.checkpoint_id = metric.id
        and current_placement.started_at <= v_generated_at
        and (
          current_placement.ended_at is null
          or current_placement.ended_at > v_generated_at
        )
      order by current_placement.started_at desc
      limit 1
    ) as placement on true
  ),
  daily_rows as (
    select
      day_series.day::date as day,
      count(flag.id)::bigint as sessions,
      count(flag.id) filter (where flag.checkin_started)::bigint as checkins_started,
      count(flag.id) filter (where flag.checkin_completed)::bigint as checkins_completed,
      count(flag.id) filter (where flag.therapist_intent)::bigint as therapist_intent,
      count(flag.id) filter (where flag.consultation_started)::bigint as consultations_started,
      count(flag.id) filter (where flag.consultation_submitted)::bigint as consultations_submitted
    from generate_series(
      (v_from at time zone 'America/Toronto')::date,
      ((v_to - interval '1 microsecond') at time zone 'America/Toronto')::date,
      interval '1 day'
    ) as day_series(day)
    left join cohort_flags as flag
      on (flag.started_at at time zone 'America/Toronto')::date = day_series.day::date
    group by day_series.day
    order by day_series.day
  ),
  placement_rows as (
    select jsonb_build_object(
      'id', placement.id,
      'checkpointCode', checkpoint.code,
      'partnerName', placement.partner_name,
      'locationName', placement.location_name,
      'locationNotes', placement.location_notes,
      'placementStatus', placement.status,
      'timelineStatus', case
        when placement.started_at > v_generated_at then 'scheduled'
        when placement.started_at <= v_generated_at
          and (placement.ended_at is null or placement.ended_at > v_generated_at) then 'current'
        else 'historical'
      end,
      'startedAt', placement.started_at,
      'endedAt', placement.ended_at
    ) as item,
    checkpoint.code,
    placement.started_at
    from public.checkpoint_placements as placement
    join public.checkpoints as checkpoint on checkpoint.id = placement.checkpoint_id
  ),
  lead_rows as (
    select jsonb_build_object(
      'referenceId', attribution.consultation_reference_id,
      'checkpointCode', checkpoint.code,
      'partnerName', placement.partner_name,
      'locationName', placement.location_name,
      'source', attribution.source,
      'status', attribution.status,
      'submittedAt', attribution.submitted_at
    ) as item,
    attribution.submitted_at
    from public.consultation_attributions as attribution
    join cohort_sessions as session on session.id = attribution.session_id
    join public.checkpoints as checkpoint on checkpoint.id = attribution.checkpoint_id
    join public.checkpoint_placements as placement on placement.id = attribution.placement_id
  )
  select jsonb_build_object(
    'generatedAt', v_generated_at,
    'range', jsonb_build_object('from', v_from, 'to', v_to),
    'kpis', jsonb_build_object(
      'sessions', total.sessions,
      'checkinsStarted', total.checkins_started,
      'checkinsCompleted', total.checkins_completed,
      'completionRate', coalesce(
        round(100.0 * total.checkins_completed / nullif(total.checkins_started, 0), 1),
        0
      ),
      'resultViews', total.result_views,
      'therapistIntent', total.therapist_intent,
      'consultationsStarted', total.consultations_started,
      'consultationsSubmitted', total.consultations_submitted,
      'sessionToConsultationRate', coalesce(
        round(100.0 * total.consultations_submitted / nullif(total.sessions, 0), 1),
        0
      ),
      'externalBookingClicks', total.external_booking_clicks
    ),
    'funnel', jsonb_build_array(
      jsonb_build_object('event', 'session', 'count', total.sessions),
      jsonb_build_object('event', 'checkin_started', 'count', total.checkins_started),
      jsonb_build_object('event', 'checkin_completed', 'count', total.checkins_completed),
      jsonb_build_object('event', 'result_viewed', 'count', total.result_views),
      jsonb_build_object('event', 'therapist_cta_clicked', 'count', total.therapist_intent),
      jsonb_build_object('event', 'consultation_started', 'count', total.consultations_started),
      jsonb_build_object('event', 'consultation_submitted', 'count', total.consultations_submitted)
    ),
    'questionSteps', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'stepNumber', question.step_number,
          'reached', question.reached,
          'completed', question.completed,
          'dropOffs', question.drop_offs,
          'completionRate', coalesce(
            round(100.0 * question.completed / nullif(question.reached, 0), 1),
            0
          ),
          'dropOffRate', coalesce(
            round(100.0 * question.drop_offs / nullif(question.reached, 0), 1),
            0
          )
        ) order by question.step_number
      )
      from question_step_rows as question
    ), '[]'::jsonb),
    'checkpoints', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'code', checkpoint.code,
          'status', checkpoint.status,
          'createdAt', checkpoint.created_at,
          'currentPlacement', case
            when checkpoint.current_placement_id is null then null
            else jsonb_build_object(
              'id', checkpoint.current_placement_id,
              'partnerName', checkpoint.current_partner_name,
              'locationName', checkpoint.current_location_name,
              'startedAt', checkpoint.current_started_at
            )
          end,
          'sessions', checkpoint.sessions,
          'checkinsStarted', checkpoint.checkins_started,
          'checkinsCompleted', checkpoint.checkins_completed,
          'completionRate', coalesce(
            round(100.0 * checkpoint.checkins_completed / nullif(checkpoint.checkins_started, 0), 1),
            0
          ),
          'resultViews', checkpoint.result_views,
          'therapistIntent', checkpoint.therapist_intent,
          'consultationsStarted', checkpoint.consultations_started,
          'consultationsSubmitted', checkpoint.consultations_submitted,
          'sessionToConsultationRate', coalesce(
            round(100.0 * checkpoint.consultations_submitted / nullif(checkpoint.sessions, 0), 1),
            0
          ),
          'externalBookingClicks', checkpoint.external_booking_clicks,
          'sparkline', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'date', to_char(spark_day.day, 'YYYY-MM-DD'),
                'sessions', spark_day.sessions
              ) order by spark_day.day
            )
            from (
              select
                series.day::date as day,
                count(flag.id)::bigint as sessions
              from generate_series(
                greatest(
                  (v_from at time zone 'America/Toronto')::date,
                  ((v_to - interval '1 microsecond') at time zone 'America/Toronto')::date - 29
                ),
                ((v_to - interval '1 microsecond') at time zone 'America/Toronto')::date,
                interval '1 day'
              ) as series(day)
              left join cohort_flags as flag
                on flag.checkpoint_id = checkpoint.id
                and (flag.started_at at time zone 'America/Toronto')::date = series.day::date
              group by series.day
            ) as spark_day
          ), '[]'::jsonb)
        ) order by checkpoint.code
      )
      from checkpoint_rows as checkpoint
    ), '[]'::jsonb),
    'daily', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'date', to_char(daily.day, 'YYYY-MM-DD'),
          'sessions', daily.sessions,
          'checkinsStarted', daily.checkins_started,
          'checkinsCompleted', daily.checkins_completed,
          'therapistIntent', daily.therapist_intent,
          'consultationsStarted', daily.consultations_started,
          'consultationsSubmitted', daily.consultations_submitted
        ) order by daily.day
      )
      from daily_rows as daily
    ), '[]'::jsonb),
    'placementHistory', coalesce((
      select jsonb_agg(placement.item order by placement.code, placement.started_at desc)
      from placement_rows as placement
    ), '[]'::jsonb),
    'leads', coalesce((
      select jsonb_agg(lead.item order by lead.submitted_at desc)
      from lead_rows as lead
    ), '[]'::jsonb)
  )
  into v_result
  from totals as total;

  return v_result;
end;
$$;

create or replace function public.ingest_checkpoint_event(
  p_checkpoint_code text,
  p_anonymous_session_id uuid,
  p_client_event_id uuid,
  p_event_name text,
  p_step_number smallint default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_now timestamptz;
  v_checkpoint public.checkpoints%rowtype;
  v_session public.funnel_sessions%rowtype;
  v_placement_id uuid;
  v_event_id uuid;
  v_existing_event public.funnel_events%rowtype;
begin
  if p_checkpoint_code is null or p_checkpoint_code !~ '^VMH-(0[1-9]|10)$' then
    raise exception using errcode = '22023', message = 'Invalid checkpoint code.';
  end if;
  if p_anonymous_session_id is null or p_client_event_id is null then
    raise exception using errcode = '22023', message = 'Session and event IDs are required.';
  end if;
  if p_event_name is null or p_event_name not in (
    'landing_view',
    'checkin_started',
    'checkin_step_completed',
    'checkin_completed',
    'result_viewed',
    'therapist_cta_clicked',
    'consultation_started',
    'external_booking_clicked'
  ) then
    raise exception using errcode = '22023', message = 'Event name is not allowed.';
  end if;
  if (p_event_name = 'checkin_step_completed' and (p_step_number is null or p_step_number not between 1 and 4))
     or (p_event_name <> 'checkin_step_completed' and p_step_number is not null) then
    raise exception using errcode = '22023', message = 'Invalid event step.';
  end if;

  -- The shared checkpoint lock serializes placement changes with first-session
  -- attribution. Server time is read after the lock, never from the request.
  select checkpoint.*
  into strict v_checkpoint
  from public.checkpoints as checkpoint
  where checkpoint.code = p_checkpoint_code
  for share;

  if v_checkpoint.status <> 'active' then
    raise exception using errcode = '55000', message = 'Checkpoint is inactive.';
  end if;

  v_now := clock_timestamp();

  select session.*
  into v_session
  from public.funnel_sessions as session
  where session.anonymous_session_id = p_anonymous_session_id;

  if not found then
    select placement.id
    into v_placement_id
    from public.checkpoint_placements as placement
    where placement.checkpoint_id = v_checkpoint.id
      and placement.started_at <= v_now
      and (placement.ended_at is null or placement.ended_at > v_now)
    order by placement.started_at desc
    limit 1;

    if v_placement_id is null then
      raise exception using errcode = '55000', message = 'Checkpoint has no placement at server time.';
    end if;

    insert into public.funnel_sessions (
      anonymous_session_id,
      checkpoint_id,
      placement_id,
      started_at,
      last_event_at
    ) values (
      p_anonymous_session_id,
      v_checkpoint.id,
      v_placement_id,
      v_now,
      v_now
    )
    on conflict (anonymous_session_id) do nothing
    returning * into v_session;

    if v_session.id is null then
      select session.*
      into strict v_session
      from public.funnel_sessions as session
      where session.anonymous_session_id = p_anonymous_session_id;
    end if;
  end if;

  if v_session.checkpoint_id <> v_checkpoint.id then
    raise exception using
      errcode = '22023',
      message = 'Anonymous session is already bound to another checkpoint.';
  end if;

  insert into public.funnel_events (
    client_event_id,
    session_id,
    checkpoint_id,
    placement_id,
    event_name,
    step_number,
    occurred_at
  ) values (
    p_client_event_id,
    v_session.id,
    v_session.checkpoint_id,
    v_session.placement_id,
    p_event_name,
    p_step_number,
    v_now
  )
  on conflict do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select event.*
    into v_existing_event
    from public.funnel_events as event
    where event.client_event_id = p_client_event_id;

    if found and (
      v_existing_event.session_id <> v_session.id
      or v_existing_event.event_name <> p_event_name
      or v_existing_event.step_number is distinct from p_step_number
    ) then
      raise exception using
        errcode = '22023',
        message = 'Event ID was already used with different event data.';
    end if;
  else
    update public.funnel_sessions
    set last_event_at = greatest(last_event_at, v_now)
    where id = v_session.id;
  end if;

  return jsonb_build_object(
    'accepted', true,
    'placementId', v_session.placement_id,
    'sessionId', v_session.id
  );
exception
  when no_data_found then
    raise exception using errcode = 'P0002', message = 'Checkpoint not found.';
end;
$$;

create or replace function public.record_checkpoint_consultation(
  p_checkpoint_code text,
  p_anonymous_session_id uuid,
  p_consultation_reference_id text,
  p_status text default 'submitted'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_session public.funnel_sessions%rowtype;
  v_attribution public.consultation_attributions%rowtype;
  v_event_id uuid;
begin
  if p_checkpoint_code is null or p_checkpoint_code !~ '^VMH-(0[1-9]|10)$' then
    raise exception using errcode = '22023', message = 'Invalid checkpoint code.';
  end if;
  if p_anonymous_session_id is null then
    raise exception using errcode = '22023', message = 'Anonymous session ID is required.';
  end if;
  if p_consultation_reference_id is null
     or p_consultation_reference_id !~ '^[A-Za-z0-9][A-Za-z0-9_-]{5,119}$' then
    raise exception using errcode = '22023', message = 'Invalid consultation reference ID.';
  end if;
  if p_status is null or p_status not in ('submitted', 'contacted', 'scheduled', 'closed', 'not_a_fit') then
    raise exception using errcode = '22023', message = 'Invalid consultation status.';
  end if;

  select session.*
  into strict v_session
  from public.funnel_sessions as session
  join public.checkpoints as checkpoint on checkpoint.id = session.checkpoint_id
  where session.anonymous_session_id = p_anonymous_session_id
    and checkpoint.code = p_checkpoint_code
  for update of session;

  insert into public.consultation_attributions (
    consultation_reference_id,
    session_id,
    anonymous_session_id,
    checkpoint_id,
    placement_id,
    status,
    submitted_at,
    updated_at
  ) values (
    p_consultation_reference_id,
    v_session.id,
    v_session.anonymous_session_id,
    v_session.checkpoint_id,
    v_session.placement_id,
    p_status,
    v_now,
    v_now
  )
  on conflict do nothing
  returning * into v_attribution;

  if v_attribution.id is null then
    select attribution.*
    into v_attribution
    from public.consultation_attributions as attribution
    where attribution.consultation_reference_id = p_consultation_reference_id;

    if not found then
      raise exception using
        errcode = '23505',
        message = 'This anonymous session is already attributed to another consultation.';
    end if;
    if v_attribution.session_id <> v_session.id then
      raise exception using
        errcode = '22023',
        message = 'Consultation reference is already bound to another session.';
    end if;
  end if;

  insert into public.funnel_events (
    client_event_id,
    session_id,
    checkpoint_id,
    placement_id,
    event_name,
    step_number,
    occurred_at
  ) values (
    extensions.gen_random_uuid(),
    v_session.id,
    v_session.checkpoint_id,
    v_session.placement_id,
    'consultation_submitted',
    null,
    v_now
  )
  on conflict do nothing
  returning id into v_event_id;

  if v_event_id is not null then
    update public.funnel_sessions
    set last_event_at = greatest(last_event_at, v_now)
    where id = v_session.id;
  end if;

  return jsonb_build_object(
    'accepted', true,
    'attributionId', v_attribution.id,
    'checkpointId', v_attribution.checkpoint_id,
    'placementId', v_attribution.placement_id,
    'sessionId', v_attribution.session_id,
    'source', v_attribution.source,
    'status', v_attribution.status,
    'submittedAt', v_attribution.submitted_at
  );
exception
  when no_data_found then
    raise exception using
      errcode = 'P0002',
      message = 'No matching checkpoint session was found.';
end;
$$;

-- RLS has no public policies by design. All browser traffic must pass through a
-- same-origin server endpoint using the service role and one of the audited RPCs.
alter table public.checkpoints enable row level security;
alter table public.checkpoint_placements enable row level security;
alter table public.funnel_sessions enable row level security;
alter table public.funnel_events enable row level security;
alter table public.consultation_attributions enable row level security;

revoke all on table public.checkpoints from public, anon, authenticated, service_role;
revoke all on table public.checkpoint_placements from public, anon, authenticated, service_role;
revoke all on table public.funnel_sessions from public, anon, authenticated, service_role;
revoke all on table public.funnel_events from public, anon, authenticated, service_role;
revoke all on table public.consultation_attributions from public, anon, authenticated, service_role;

revoke all on function public.move_checkpoint(text, text, text, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.ingest_checkpoint_event(text, uuid, uuid, text, smallint)
  from public, anon, authenticated;
revoke all on function public.record_checkpoint_consultation(text, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.get_checkpoint_dashboard(timestamptz, timestamptz)
  from public, anon, authenticated;
revoke all on function public.get_checkpoint_detail(text, timestamptz, timestamptz)
  from public, anon, authenticated;

grant execute on function public.move_checkpoint(text, text, text, text, timestamptz)
  to service_role;
grant execute on function public.ingest_checkpoint_event(text, uuid, uuid, text, smallint)
  to service_role;
grant execute on function public.record_checkpoint_consultation(text, uuid, text, text)
  to service_role;
grant execute on function public.get_checkpoint_dashboard(timestamptz, timestamptz)
  to service_role;
grant execute on function public.get_checkpoint_detail(text, timestamptz, timestamptz)
  to service_role;

commit;

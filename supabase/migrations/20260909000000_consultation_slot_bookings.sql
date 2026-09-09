-- Shared, collision-safe consultation calendar for /welcome and /quiz.
-- Slot records contain opaque operational identifiers only; contact details
-- remain in the existing service-role-only consultation CRM.

begin;

create table if not exists public.consultation_slot_bookings (
  id uuid primary key default extensions.gen_random_uuid(),
  slot_date date not null,
  slot_time text not null,
  client_submission_id text not null unique,
  consultation_reference_id text not null unique,
  source text not null,
  booked_at timestamptz not null default statement_timestamp(),
  constraint consultation_slot_bookings_slot_unique unique (slot_date, slot_time),
  constraint consultation_slot_bookings_time_valid check (
    slot_time ~ '^(9|10|11):[024][0] AM$|^12:[024][0] PM$|^[1-7]:[024][0] PM$'
  ),
  constraint consultation_slot_bookings_submission_valid check (
    client_submission_id ~ '^[A-Za-z0-9-]{16,80}$'
  ),
  constraint consultation_slot_bookings_reference_valid check (
    consultation_reference_id ~ '^VC-[A-F0-9]{24}$'
  ),
  constraint consultation_slot_bookings_source_valid check (
    source in ('welcome', 'quiz_calendar')
  )
);

create index if not exists consultation_slot_bookings_date_idx
  on public.consultation_slot_bookings (slot_date, slot_time);

alter table public.consultation_slot_bookings enable row level security;

create or replace function public.get_booked_consultation_slots(
  p_from date,
  p_to date
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
begin
  if p_from is null or p_to is null or p_to < p_from or p_to > p_from + 45 then
    raise exception using errcode = '22023', message = 'Invalid consultation slot range.';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object('date', booking.slot_date, 'time', booking.slot_time)
      order by booking.slot_date, booking.slot_time
    )
    from public.consultation_slot_bookings as booking
    where booking.slot_date between p_from and p_to
  ), '[]'::jsonb);
end;
$$;

create or replace function public.claim_consultation_slot(
  p_slot_date date,
  p_slot_time text,
  p_client_submission_id text,
  p_consultation_reference_id text,
  p_source text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_existing public.consultation_slot_bookings%rowtype;
begin
  if p_slot_date is null or p_slot_time is null or
     p_client_submission_id is null or p_consultation_reference_id is null or
     p_source not in ('welcome', 'quiz_calendar') or
     p_client_submission_id !~ '^[A-Za-z0-9-]{16,80}$' or
     p_consultation_reference_id !~ '^VC-[A-F0-9]{24}$' then
    raise exception using errcode = '22023', message = 'Invalid consultation slot claim.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'consultation-slot:' || p_slot_date::text || ':' || p_slot_time,
    0
  ));

  select booking.* into v_existing
  from public.consultation_slot_bookings as booking
  where booking.slot_date = p_slot_date
    and booking.slot_time = p_slot_time
  for update;

  if found then
    if v_existing.client_submission_id = p_client_submission_id and
       v_existing.consultation_reference_id = p_consultation_reference_id then
      return jsonb_build_object(
        'accepted', true,
        'replayed', true,
        'date', v_existing.slot_date,
        'time', v_existing.slot_time
      );
    end if;
    return jsonb_build_object('accepted', false, 'reason', 'slot_unavailable');
  end if;

  select booking.* into v_existing
  from public.consultation_slot_bookings as booking
  where booking.client_submission_id = p_client_submission_id
     or booking.consultation_reference_id = p_consultation_reference_id
  limit 1
  for update;

  if found then
    if v_existing.slot_date = p_slot_date and v_existing.slot_time = p_slot_time and
       v_existing.client_submission_id = p_client_submission_id and
       v_existing.consultation_reference_id = p_consultation_reference_id then
      return jsonb_build_object(
        'accepted', true,
        'replayed', true,
        'date', v_existing.slot_date,
        'time', v_existing.slot_time
      );
    end if;
    return jsonb_build_object('accepted', false, 'reason', 'identifier_in_use');
  end if;

  begin
    insert into public.consultation_slot_bookings (
      slot_date, slot_time, client_submission_id,
      consultation_reference_id, source
    ) values (
      p_slot_date, p_slot_time, p_client_submission_id,
      p_consultation_reference_id, p_source
    );
  exception when unique_violation then
    return jsonb_build_object('accepted', false, 'reason', 'identifier_in_use');
  end;

  return jsonb_build_object(
    'accepted', true,
    'replayed', false,
    'date', p_slot_date,
    'time', p_slot_time
  );
end;
$$;

create or replace function public.mark_consultation_slot_booked(
  p_consultation_reference_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_booking public.consultation_slot_bookings%rowtype;
  v_lead public.consultation_leads%rowtype;
begin
  select booking.* into v_booking
  from public.consultation_slot_bookings as booking
  where booking.consultation_reference_id = p_consultation_reference_id;

  if not found then
    raise exception using errcode = '22023', message = 'Consultation slot booking was not found.';
  end if;

  select lead.* into v_lead
  from public.consultation_leads as lead
  where lead.consultation_reference_id = p_consultation_reference_id
  for update;

  if not found then
    raise exception using errcode = '22023', message = 'Consultation lead was not found.';
  end if;

  if v_lead.conversion_stage = 'consultation_requested' then
    update public.consultation_leads as lead
    set conversion_stage = 'consultation_booked',
        booked_at = coalesce(lead.booked_at, v_booking.booked_at),
        last_activity_at = greatest(lead.last_activity_at, v_booking.booked_at),
        row_version = lead.row_version + 1,
        updated_at = statement_timestamp()
    where lead.id = v_lead.id
    returning * into v_lead;

    insert into public.consultation_lead_history (
      lead_id, event_type, from_workflow_status, to_workflow_status,
      from_conversion_stage, to_conversion_stage, note, actor_kind,
      actor_reference, recorded_at
    ) values (
      v_lead.id, 'conversion_updated', v_lead.workflow_status, v_lead.workflow_status,
      'consultation_requested', 'consultation_booked',
      'Booked through the shared website consultation calendar.', 'system',
      p_consultation_reference_id, v_booking.booked_at
    );
  end if;

  return jsonb_build_object(
    'accepted', true,
    'leadId', v_lead.id,
    'conversionStage', v_lead.conversion_stage,
    'bookedAt', v_lead.booked_at,
    'rowVersion', v_lead.row_version
  );
end;
$$;

revoke all on table public.consultation_slot_bookings
  from public, anon, authenticated, service_role;
revoke all on function public.get_booked_consultation_slots(date, date)
  from public, anon, authenticated;
revoke all on function public.claim_consultation_slot(date, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.mark_consultation_slot_booked(text)
  from public, anon, authenticated;

grant execute on function public.get_booked_consultation_slots(date, date)
  to service_role;
grant execute on function public.claim_consultation_slot(date, text, text, text, text)
  to service_role;
grant execute on function public.mark_consultation_slot_booked(text)
  to service_role;

comment on table public.consultation_slot_bookings is
  'Opaque, service-role-only slot claims shared by the /welcome and /quiz calendars.';

commit;

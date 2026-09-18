-- Shared capacity for every website calendar. The assigned clinician is an
-- shared reservation: one selected clinician for named bookings, or a pool for general calendars.
begin;

create table if not exists public.consultation_weekly_shifts (
  therapist_id text not null,
  weekday integer not null check (weekday between 0 and 6),
  start_minute integer not null check (start_minute between 0 and 1419),
  end_minute integer not null check (end_minute between 20 and 1440),
  primary key (therapist_id, weekday, start_minute),
  check (end_minute >= start_minute + 20)
);
insert into public.consultation_weekly_shifts values
 ('ryann-simpson',1,1020,1200),('ryann-simpson',2,1020,1200),('ryann-simpson',3,1020,1140),('ryann-simpson',4,960,1140),
 ('wilfred-bengnwi',1,900,1200),('wilfred-bengnwi',2,540,1080),('wilfred-bengnwi',3,540,780),('wilfred-bengnwi',4,540,720),('wilfred-bengnwi',5,540,780),
 ('meryem-ibrahim',0,540,1200),('meryem-ibrahim',2,540,1080),
 ('tim-kahtava',1,1110,1170),('tim-kahtava',2,600,720),('tim-kahtava',3,915,975),('tim-kahtava',6,795,855),
 ('dayong-quan',1,540,1020),('dayong-quan',5,540,1020)
on conflict (therapist_id, weekday, start_minute) do update set end_minute=excluded.end_minute;
alter table public.consultation_weekly_shifts enable row level security;
revoke all on table public.consultation_weekly_shifts from public, anon, authenticated, service_role;

create or replace function public.consultation_minute(p_time text) returns integer
language sql immutable strict set search_path = pg_catalog as $$
 select case when p_time ~ '^(1[0-2]|[1-9]):[0-5][0-9] (AM|PM)$' then
   (split_part(p_time, ':', 1)::integer % 12) * 60 +
   split_part(split_part(p_time, ':', 2), ' ', 1)::integer +
   case when right(p_time, 2) = 'PM' then 720 else 0 end end;
$$;
create or replace function public.consultation_time_label(p_minute integer) returns text
language sql immutable strict set search_path = pg_catalog as $$
 select (case when (p_minute / 60) % 12 = 0 then 12 else (p_minute / 60) % 12 end)::text
 || ':' || lpad((p_minute % 60)::text, 2, '0') || case when p_minute < 720 then ' AM' else ' PM' end;
$$;

alter table public.consultation_slot_bookings
  drop constraint if exists consultation_slot_bookings_slot_unique,
  drop constraint if exists consultation_slot_bookings_time_valid,
  add column if not exists therapist_id text,
  add column if not exists eligible_therapist_ids text[],
  add constraint consultation_slot_bookings_time_valid check (public.consultation_minute(slot_time) is not null);
create index if not exists consultation_slot_bookings_capacity_idx on public.consultation_slot_bookings (slot_date, therapist_id);

-- Existing bookings lack reliable therapist attribution. Retain them as
-- clinic-wide holds, rather than inventing an assignment and double-booking.
create or replace function public.consultation_therapist_free(p_date date, p_minute integer, p_therapist text)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
 select not exists (
   select 1 from public.consultation_slot_bookings b
   where b.slot_date = p_date and (b.therapist_id is null or b.therapist_id = p_therapist)
     and public.consultation_minute(b.slot_time) < p_minute + 20
     and public.consultation_minute(b.slot_time) + 20 > p_minute
 );
$$;

create or replace function public.get_booked_consultation_slots_v2(p_from date, p_to date, p_therapist_ids text[])
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
begin
 if p_from is null or p_to is null or p_to < p_from or p_to > p_from + 45 or
    coalesce(cardinality(p_therapist_ids),0) not between 1 and 5 or exists (
      select 1 from unnest(p_therapist_ids) t where t is null or t not in (select therapist_id from public.consultation_weekly_shifts)
    ) then raise exception 'Invalid consultation range or pool.' using errcode='22023'; end if;
 return coalesce((
   with candidates as (
     select distinct p_from + d.n as slot_date, minute.n as minute
     from generate_series(0, p_to-p_from) d(n)
     join public.consultation_weekly_shifts s on s.weekday = extract(dow from p_from+d.n)::integer
       and s.therapist_id = any(p_therapist_ids)
     cross join lateral generate_series(s.start_minute,s.end_minute-20,20) minute(n)
   )
   select jsonb_agg(jsonb_build_object('date', c.slot_date, 'time', public.consultation_time_label(c.minute)) order by c.slot_date,c.minute)
   from candidates c where not exists (
     select 1 from public.consultation_weekly_shifts s
     where s.therapist_id = any(p_therapist_ids) and s.weekday = extract(dow from c.slot_date)::integer
       and c.minute >= s.start_minute and c.minute+20 <= s.end_minute
       and public.consultation_therapist_free(c.slot_date,c.minute,s.therapist_id)
   )
 ), '[]'::jsonb);
end;
$$;

create or replace function public.claim_consultation_slot_v2(
 p_slot_date date, p_slot_time text, p_client_submission_id text,
 p_consultation_reference_id text, p_source text, p_therapist_ids text[]
) returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
 v_existing public.consultation_slot_bookings%rowtype;
 v_minute integer := public.consultation_minute(p_slot_time);
 v_therapist text;
 v_today date := (statement_timestamp() at time zone 'America/Toronto')::date;
begin
 if p_slot_date is null or v_minute is null or p_source is null or p_source not in ('welcome','quiz_calendar') or
    p_client_submission_id is null or p_client_submission_id !~ '^[A-Za-z0-9-]{16,80}$' or
    p_consultation_reference_id is null or p_consultation_reference_id !~ '^VC-[A-F0-9]{24}$' or
    coalesce(cardinality(p_therapist_ids),0) not between 1 and 5 or exists (
      select 1 from unnest(p_therapist_ids) t where t is null or t not in (select therapist_id from public.consultation_weekly_shifts)
    ) then raise exception 'Invalid consultation claim.' using errcode='22023'; end if;

 -- Serialize retries across dates, then all overlapping times on this date.
 perform pg_advisory_xact_lock(hashtextextended('consultation-request:'||p_client_submission_id,0));
 perform pg_advisory_xact_lock(hashtextextended('consultation-day:'||p_slot_date::text,0));
 select * into v_existing from public.consultation_slot_bookings
 where client_submission_id=p_client_submission_id or consultation_reference_id=p_consultation_reference_id limit 1 for update;
 if found then
   if v_existing.client_submission_id=p_client_submission_id and v_existing.consultation_reference_id=p_consultation_reference_id
     and v_existing.slot_date=p_slot_date and v_existing.slot_time=p_slot_time and v_existing.source=p_source
     and ((v_existing.eligible_therapist_ids is null and cardinality(p_therapist_ids)=5) or
       (v_existing.eligible_therapist_ids @> p_therapist_ids and v_existing.eligible_therapist_ids <@ p_therapist_ids)) then
     return jsonb_build_object('accepted',true,'replayed',true,'date',p_slot_date,'time',p_slot_time,'capacityTherapistId',v_existing.therapist_id);
   end if;
   return jsonb_build_object('accepted',false,'reason','identifier_in_use');
 end if;
 if p_slot_date <= v_today or p_slot_date > v_today+30 or not exists (
   select 1 from public.consultation_weekly_shifts s
   cross join lateral generate_series(s.start_minute,s.end_minute-20,20) m
   where s.therapist_id=any(p_therapist_ids) and s.weekday=extract(dow from p_slot_date)::integer and m=v_minute
 ) then return jsonb_build_object('accepted',false,'reason','slot_unavailable'); end if;

 select s.therapist_id into v_therapist from public.consultation_weekly_shifts s
 where s.therapist_id=any(p_therapist_ids) and s.weekday=extract(dow from p_slot_date)::integer
   and v_minute >= s.start_minute and v_minute+20 <= s.end_minute
   and public.consultation_therapist_free(p_slot_date,v_minute,s.therapist_id)
 order by array_position(p_therapist_ids,s.therapist_id) limit 1;
 if v_therapist is null then return jsonb_build_object('accepted',false,'reason','slot_unavailable'); end if;
 begin
   insert into public.consultation_slot_bookings (slot_date,slot_time,client_submission_id,consultation_reference_id,source,therapist_id,eligible_therapist_ids)
   values (p_slot_date,p_slot_time,p_client_submission_id,p_consultation_reference_id,p_source,v_therapist,p_therapist_ids);
 exception when unique_violation then
   return jsonb_build_object('accepted',false,'reason','identifier_in_use');
 end;
 return jsonb_build_object('accepted',true,'replayed',false,'date',p_slot_date,'time',p_slot_time,'capacityTherapistId',v_therapist);
end;
$$;

-- Older application instances also use the shared capacity during rollout.
create or replace function public.get_booked_consultation_slots(p_from date,p_to date)
returns jsonb language sql security definer set search_path=pg_catalog,public as $$
 select public.get_booked_consultation_slots_v2(p_from,p_to,array['ryann-simpson','wilfred-bengnwi','meryem-ibrahim','tim-kahtava','dayong-quan']);
$$;
create or replace function public.claim_consultation_slot(p_slot_date date,p_slot_time text,p_client_submission_id text,p_consultation_reference_id text,p_source text)
returns jsonb language sql security definer set search_path=pg_catalog,public as $$
 select public.claim_consultation_slot_v2(p_slot_date,p_slot_time,p_client_submission_id,p_consultation_reference_id,p_source,array['ryann-simpson','wilfred-bengnwi','meryem-ibrahim','tim-kahtava','dayong-quan']);
$$;
revoke all on function public.consultation_minute(text), public.consultation_time_label(integer), public.consultation_therapist_free(date,integer,text), public.get_booked_consultation_slots_v2(date,date,text[]), public.claim_consultation_slot_v2(date,text,text,text,text,text[]) from public,anon,authenticated;
grant execute on function public.get_booked_consultation_slots_v2(date,date,text[]), public.claim_consultation_slot_v2(date,text,text,text,text,text[]) to service_role;
commit;

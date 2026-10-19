-- Flyer area QR links (/booking/<code>, e.g. /booking/bh for Beacon Hill).
--
-- Each row is one QR scan that was redirected to the external booking page.
-- Privacy boundary: only the link code, a coarse device category and the time
-- are stored. No IP address, user-agent, referrer, fingerprint, location or
-- visitor-provided data. Transactional and safe to rerun.

begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
set local search_path = pg_catalog, public, extensions;

create table if not exists public.booking_link_scans (
  id uuid primary key default extensions.gen_random_uuid(),
  link_code text not null,
  device text not null,
  scanned_at timestamptz not null default transaction_timestamp(),
  constraint booking_link_scans_code_format check (link_code ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  constraint booking_link_scans_device_allowed check (device in ('ios', 'android', 'other'))
);

create index if not exists booking_link_scans_code_scanned_idx
  on public.booking_link_scans (link_code, scanned_at desc);
create index if not exists booking_link_scans_scanned_idx
  on public.booking_link_scans (scanned_at desc);

alter table public.booking_link_scans enable row level security;
revoke all on table public.booking_link_scans from public, anon, authenticated, service_role;

create or replace function public.record_booking_link_scan(p_link_code text, p_device text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
begin
  if p_link_code is null or p_link_code !~ '^[a-z0-9][a-z0-9-]{0,39}$' then
    raise exception 'Invalid booking link code';
  end if;
  if p_device is null or p_device not in ('ios', 'android', 'other') then
    raise exception 'Invalid booking link device';
  end if;
  insert into public.booking_link_scans (link_code, device) values (p_link_code, p_device);
  return jsonb_build_object('accepted', true);
end;
$$;

create or replace function public.get_booking_link_report()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
  with clock as (
    select
      now() as generated_at,
      (now() at time zone 'America/Toronto')::date as today
  ), scans as (
    select
      s.link_code,
      s.device,
      s.scanned_at,
      (s.scanned_at at time zone 'America/Toronto')::date as toronto_date
    from public.booking_link_scans s
  ), totals as (
    select
      s.link_code,
      count(*) filter (where s.toronto_date = c.today) as today_count,
      count(*) filter (where s.toronto_date > c.today - 7) as last_7_count,
      count(*) filter (where s.toronto_date > c.today - 30) as last_30_count,
      count(*) as all_time_count,
      min(s.scanned_at) as first_scan_at,
      max(s.scanned_at) as last_scan_at
    from scans s cross join clock c
    group by s.link_code
  ), daily as (
    select s.link_code, s.toronto_date, count(*) as scan_count
    from scans s cross join clock c
    where s.toronto_date > c.today - 30
    group by s.link_code, s.toronto_date
  ), devices as (
    select s.link_code, s.device, count(*) as scan_count
    from scans s cross join clock c
    where s.toronto_date > c.today - 30
    group by s.link_code, s.device
  ), recent as (
    select s.link_code, s.device, s.scanned_at
    from public.booking_link_scans s
    order by s.scanned_at desc
    limit 25
  )
  select jsonb_build_object(
    'generatedAt', (select generated_at from clock),
    'today', (select to_char(today, 'YYYY-MM-DD') from clock),
    'links', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', t.link_code,
        'today', t.today_count,
        'last7Days', t.last_7_count,
        'last30Days', t.last_30_count,
        'allTime', t.all_time_count,
        'firstScanAt', t.first_scan_at,
        'lastScanAt', t.last_scan_at
      ) order by t.link_code)
      from totals t
    ), '[]'::jsonb),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', d.link_code,
        'date', to_char(d.toronto_date, 'YYYY-MM-DD'),
        'count', d.scan_count
      ) order by d.link_code, d.toronto_date)
      from daily d
    ), '[]'::jsonb),
    'devices', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', d.link_code,
        'device', d.device,
        'count', d.scan_count
      ) order by d.link_code, d.scan_count desc)
      from devices d
    ), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', r.link_code,
        'device', r.device,
        'scannedAt', r.scanned_at
      ) order by r.scanned_at desc)
      from recent r
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.record_booking_link_scan(text, text) from public, anon, authenticated;
revoke all on function public.get_booking_link_report() from public, anon, authenticated;
grant execute on function public.record_booking_link_scan(text, text) to service_role;
grant execute on function public.get_booking_link_report() to service_role;

commit;

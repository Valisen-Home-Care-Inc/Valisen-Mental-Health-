-- Recoverable reporting-period archives for every CRM dashboard.
-- Raw operational records are never deleted. "Reset" only advances the
-- active reporting cutoff after a privacy-safe snapshot has been stored.

begin;

set local search_path = pg_catalog, public, extensions;

create table public.crm_reporting_state (
  section text primary key check (
    section in ('google_ads', 'quiz', 'checkpoints', 'consultations')
  ),
  active_since timestamptz not null,
  updated_at timestamptz not null default transaction_timestamp()
);

create table public.crm_reporting_archives (
  id uuid primary key default extensions.gen_random_uuid(),
  section text not null check (
    section in ('google_ads', 'quiz', 'checkpoints', 'consultations')
  ),
  label text not null check (
    char_length(label) between 1 and 100 and label = btrim(label)
  ),
  period_started_at timestamptz not null,
  period_ended_at timestamptz not null,
  summary jsonb not null check (
    jsonb_typeof(summary) = 'object' and
    octet_length(summary::text) <= 32768
  ),
  snapshot jsonb not null check (
    jsonb_typeof(snapshot) = 'object' and
    octet_length(snapshot::text) <= 2097152
  ),
  created_at timestamptz not null default transaction_timestamp(),
  constraint crm_reporting_archive_period_valid check (
    period_started_at < period_ended_at
  )
);

create index crm_reporting_archives_section_created_idx
  on public.crm_reporting_archives (section, created_at desc, id desc);

alter table public.crm_reporting_state enable row level security;
alter table public.crm_reporting_archives enable row level security;

insert into public.crm_reporting_state (section, active_since)
values
  ('google_ads', '2020-01-01T00:00:00Z'::timestamptz),
  ('quiz', '2020-01-01T00:00:00Z'::timestamptz),
  ('checkpoints', '2020-01-01T00:00:00Z'::timestamptz),
  ('consultations', '2020-01-01T00:00:00Z'::timestamptz)
on conflict (section) do nothing;

comment on table public.crm_reporting_state is
  'The active reporting-period cutoff for each CRM dashboard. It never removes source records.';
comment on table public.crm_reporting_archives is
  'Privacy-safe, immutable dashboard snapshots created before a reporting period is reset.';

create or replace function public.get_crm_reporting_state(p_section text)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_state public.crm_reporting_state%rowtype;
begin
  if p_section is null or p_section not in (
    'google_ads', 'quiz', 'checkpoints', 'consultations'
  ) then
    raise exception using errcode = '22023', message = 'Invalid CRM reporting section.';
  end if;

  select state.* into strict v_state
  from public.crm_reporting_state as state
  where state.section = p_section;

  return jsonb_build_object(
    'section', v_state.section,
    'activeSince', v_state.active_since,
    'updatedAt', v_state.updated_at
  );
end;
$$;

create or replace function public.list_crm_reporting_archives(p_section text)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_state public.crm_reporting_state%rowtype;
begin
  if p_section is null or p_section not in (
    'google_ads', 'quiz', 'checkpoints', 'consultations'
  ) then
    raise exception using errcode = '22023', message = 'Invalid CRM reporting section.';
  end if;

  select state.* into strict v_state
  from public.crm_reporting_state as state
  where state.section = p_section;

  return jsonb_build_object(
    'section', v_state.section,
    'activeSince', v_state.active_since,
    'updatedAt', v_state.updated_at,
    'archives', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', archive.id,
          'label', archive.label,
          'periodStartedAt', archive.period_started_at,
          'periodEndedAt', archive.period_ended_at,
          'summary', archive.summary,
          'createdAt', archive.created_at
        ) order by archive.created_at desc, archive.id desc
      )
      from public.crm_reporting_archives as archive
      where archive.section = p_section
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.get_crm_reporting_archive(
  p_section text,
  p_archive_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_archive public.crm_reporting_archives%rowtype;
begin
  if p_section is null or p_section not in (
    'google_ads', 'quiz', 'checkpoints', 'consultations'
  ) or p_archive_id is null then
    raise exception using errcode = '22023', message = 'Invalid CRM reporting archive.';
  end if;

  select archive.* into v_archive
  from public.crm_reporting_archives as archive
  where archive.section = p_section and archive.id = p_archive_id;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_archive.id,
    'section', v_archive.section,
    'label', v_archive.label,
    'periodStartedAt', v_archive.period_started_at,
    'periodEndedAt', v_archive.period_ended_at,
    'summary', v_archive.summary,
    'snapshot', v_archive.snapshot,
    'createdAt', v_archive.created_at
  );
end;
$$;

create or replace function public.archive_crm_reporting_period(
  p_section text,
  p_label text,
  p_expected_started_at timestamptz,
  p_period_ended_at timestamptz,
  p_summary jsonb,
  p_snapshot jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_state public.crm_reporting_state%rowtype;
  v_archive public.crm_reporting_archives%rowtype;
  v_label text := btrim(p_label);
begin
  if p_section is null or p_section not in (
      'google_ads', 'quiz', 'checkpoints', 'consultations'
    ) or
    v_label is null or char_length(v_label) not between 1 and 100 or
    v_label ~ '[[:cntrl:]]' or
    p_expected_started_at is null or p_period_ended_at is null or
    p_expected_started_at >= p_period_ended_at or
    p_period_ended_at > statement_timestamp() + interval '10 minutes' or
    p_summary is null or jsonb_typeof(p_summary) <> 'object' or
    octet_length(p_summary::text) > 32768 or
    p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' or
    octet_length(p_snapshot::text) > 2097152 then
    raise exception using errcode = '22023', message = 'Invalid CRM reporting archive.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('crm-reporting-period:' || p_section, 0)
  );

  select state.* into strict v_state
  from public.crm_reporting_state as state
  where state.section = p_section
  for update;

  if v_state.active_since is distinct from p_expected_started_at then
    raise exception using errcode = '40001', message = 'CRM reporting period changed.';
  end if;

  insert into public.crm_reporting_archives (
    section, label, period_started_at, period_ended_at, summary, snapshot
  ) values (
    p_section, v_label, v_state.active_since, p_period_ended_at,
    p_summary, p_snapshot
  ) returning * into v_archive;

  update public.crm_reporting_state as state
  set active_since = p_period_ended_at,
      updated_at = transaction_timestamp()
  where state.section = p_section;

  return jsonb_build_object(
    'id', v_archive.id,
    'section', v_archive.section,
    'label', v_archive.label,
    'periodStartedAt', v_archive.period_started_at,
    'periodEndedAt', v_archive.period_ended_at,
    'summary', v_archive.summary,
    'createdAt', v_archive.created_at,
    'activeSince', p_period_ended_at
  );
end;
$$;

revoke all on table public.crm_reporting_state from public, anon, authenticated;
revoke all on table public.crm_reporting_archives from public, anon, authenticated;
revoke all on function public.get_crm_reporting_state(text)
  from public, anon, authenticated;
revoke all on function public.list_crm_reporting_archives(text)
  from public, anon, authenticated;
revoke all on function public.get_crm_reporting_archive(text, uuid)
  from public, anon, authenticated;
revoke all on function public.archive_crm_reporting_period(
  text, text, timestamptz, timestamptz, jsonb, jsonb
) from public, anon, authenticated;

grant execute on function public.get_crm_reporting_state(text) to service_role;
grant execute on function public.list_crm_reporting_archives(text) to service_role;
grant execute on function public.get_crm_reporting_archive(text, uuid) to service_role;
grant execute on function public.archive_crm_reporting_period(
  text, text, timestamptz, timestamptz, jsonb, jsonb
) to service_role;

commit;

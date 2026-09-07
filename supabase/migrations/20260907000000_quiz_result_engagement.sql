-- Result-page summaries only. No answers, contact details, selected dates or DOM text.
begin;

create table if not exists public.quiz_result_engagement (
  view_id uuid primary key,
  reference_id text not null references public.quiz_result_submissions(reference_id) on delete cascade,
  sequence integer not null check (sequence between 0 and 10000),
  elapsed_seconds integer not null check (elapsed_seconds between 0 and 86400),
  active_seconds integer not null check (active_seconds between 0 and elapsed_seconds),
  scroll_depth integer not null check (scroll_depth between 0 and 100),
  sections jsonb not null,
  last_section text,
  actions jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists quiz_result_engagement_reference_idx on public.quiz_result_engagement(reference_id, created_at);
alter table public.quiz_result_engagement enable row level security;
revoke all on public.quiz_result_engagement from public, anon, authenticated;
grant select, insert, update, delete on public.quiz_result_engagement to service_role;

create or replace function public.record_quiz_result_engagement(p_reference_id text, p_snapshot jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_sections text[] := array['summary','therapists','booking','details','download'];
  v_actions text[] := array['date_selected','time_selected','consent_changed','booking_clicked','booking_failed','booking_completed','details_opened','profile_clicked','pdf_clicked','restart_clicked'];
  v_owner text;
begin
  if jsonb_typeof(p_snapshot) <> 'object' or
     exists (select 1 from jsonb_object_keys(p_snapshot) k where k <> all(array['viewId','sequence','elapsedSeconds','activeSeconds','scrollDepth','sections','lastSection','actions'])) or
     jsonb_typeof(p_snapshot->'sections') <> 'array' or jsonb_typeof(p_snapshot->'actions') <> 'object' then
    raise exception 'Invalid result engagement';
  end if;
  if exists (select 1 from jsonb_array_elements_text(p_snapshot->'sections') s where s <> all(v_sections)) or
     exists (select 1 from jsonb_each_text(p_snapshot->'actions') a where a.key <> all(v_actions) or a.value !~ '^[0-9]{1,5}$' or a.value::integer > 10000) or
     (p_snapshot ? 'lastSection' and not (p_snapshot->'sections' ? (p_snapshot->>'lastSection'))) then
    raise exception 'Invalid result engagement fields';
  end if;
  if not exists(select 1 from public.quiz_result_submissions where reference_id = p_reference_id and lead_record is not null) then
    raise exception 'Saved result required';
  end if;
  insert into public.quiz_result_engagement as stored
    (view_id, reference_id, sequence, elapsed_seconds, active_seconds, scroll_depth, sections, last_section, actions)
  values ((p_snapshot->>'viewId')::uuid, p_reference_id, (p_snapshot->>'sequence')::integer,
    (p_snapshot->>'elapsedSeconds')::integer, (p_snapshot->>'activeSeconds')::integer,
    (p_snapshot->>'scrollDepth')::integer, p_snapshot->'sections', p_snapshot->>'lastSection', p_snapshot->'actions')
  on conflict (view_id) do update set
    sequence = excluded.sequence,
    elapsed_seconds = greatest(stored.elapsed_seconds, excluded.elapsed_seconds),
    active_seconds = greatest(stored.active_seconds, excluded.active_seconds),
    scroll_depth = greatest(stored.scroll_depth, excluded.scroll_depth),
    sections = excluded.sections, last_section = excluded.last_section, actions = excluded.actions,
    updated_at = now()
  where stored.reference_id = excluded.reference_id and excluded.sequence > stored.sequence;
  select reference_id into v_owner from public.quiz_result_engagement where view_id = (p_snapshot->>'viewId')::uuid;
  if v_owner is distinct from p_reference_id then raise exception 'View belongs to another result'; end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.get_quiz_result_engagement(p_from timestamptz, p_to timestamptz)
returns jsonb language sql stable security definer set search_path = pg_catalog, public as $$
  with scoped as (
    select e.* from public.quiz_result_engagement e
    join public.quiz_result_submissions q on q.reference_id = e.reference_id
    where e.created_at >= p_from and e.created_at < p_to and not q.is_test
  ), visitors as (
    select reference_id, count(*) views, sum(active_seconds) active_seconds,
      sum(elapsed_seconds) elapsed_seconds, max(scroll_depth) scroll_depth, max(updated_at) last_seen
    from scoped group by reference_id
  ), records as (
    select jsonb_build_object(
      'referenceId', v.reference_id, 'views', v.views, 'activeSeconds', v.active_seconds,
      'elapsedSeconds', v.elapsed_seconds, 'scrollDepth', v.scroll_depth, 'lastSeenAt', v.last_seen,
      'lastSection', (select s.last_section from scoped s where s.reference_id = v.reference_id order by s.updated_at desc limit 1),
      'sections', coalesce((select jsonb_agg(distinct section) from scoped s cross join lateral jsonb_array_elements_text(s.sections) section where s.reference_id = v.reference_id), '[]'::jsonb),
      'actions', coalesce((select jsonb_object_agg(key, amount) from (
        select a.key, sum(a.value::integer) amount from scoped s cross join lateral jsonb_each_text(s.actions) a
        where s.reference_id = v.reference_id group by a.key
      ) totals), '{}'::jsonb)
    ) record, v.last_seen from visitors v order by v.last_seen desc limit 100
  )
  select jsonb_build_object(
    'views', (select count(*) from scoped), 'visitors', (select count(*) from visitors),
    'averageActiveSeconds', coalesce((select round(avg(active_seconds)) from scoped), 0),
    'averageScrollDepth', coalesce((select round(avg(scroll_depth)) from scoped), 0),
    'records', coalesce((select jsonb_agg(record order by last_seen desc) from records), '[]'::jsonb)
  );
$$;
revoke all on function public.record_quiz_result_engagement(text, jsonb) from public, anon, authenticated;
revoke all on function public.get_quiz_result_engagement(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.record_quiz_result_engagement(text, jsonb) to service_role;
grant execute on function public.get_quiz_result_engagement(timestamptz, timestamptz) to service_role;
commit;

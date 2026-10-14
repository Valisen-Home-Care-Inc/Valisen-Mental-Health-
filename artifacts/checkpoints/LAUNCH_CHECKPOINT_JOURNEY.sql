-- VALISEN: approved Mental Battery launch for VMH-01 through VMH-25.
-- Run this entire file in Supabase SQL Editor. Safe to run again.
-- Preserves existing records and old reports. No visitor data is exported.
begin;

-- 20261001000000_expand_mental_battery_checkpoints.sql
-- Extend the existing Mental Battery checkpoint system through VMH-25.
-- Existing checkpoints, placements, sessions, and attribution remain intact.


set local search_path = pg_catalog, public, extensions;

alter table public.checkpoints
  drop constraint checkpoints_code_format;
alter table public.checkpoints
  add constraint checkpoints_code_format
    check (code ~ '^VMH-(0[1-9]|1[0-9]|2[0-5])$');

alter table public.consultation_leads
  drop constraint consultation_leads_checkpoint_shape;
alter table public.consultation_leads
  add constraint consultation_leads_checkpoint_shape check (
    (source_kind <> 'mental_battery_checkpoint') or
    checkpoint_code ~ '^VMH-(0[1-9]|1[0-9]|2[0-5])$'
  );

-- Amend only the closed code validator in the currently installed RPCs. In
-- particular, preserve later CRM/Google Ads changes to consultation upserts.
-- CREATE OR REPLACE retains each RPC's owner, grants, and security settings.
-- Fail atomically if a required RPC or its expected validator is missing.
do $expand_checkpoint_validators$
declare
  v_signature text;
  v_definition text;
  v_old_pattern constant text := '^VMH-(0[1-9]|10)$';
  v_new_pattern constant text := '^VMH-(0[1-9]|1[0-9]|2[0-5])$';
begin
  foreach v_signature in array array[
    'public.move_checkpoint(text,text,text,text,timestamptz)',
    'public.get_checkpoint_detail(text,timestamptz,timestamptz)',
    'public.ingest_checkpoint_event(text,uuid,uuid,text,smallint)',
    'public.record_checkpoint_consultation(text,uuid,text,text)',
    'public.get_checkpoint_action_metrics(timestamptz,timestamptz,text)',
    'public.upsert_consultation_lead(text,text,text,text,text,text,text,text,text,text,text,text,text,text,timestamptz,text,text,text,uuid,text,text,text,text,text,text,text,text,timestamptz)'
  ] loop
    select pg_get_functiondef(v_signature::regprocedure) into v_definition;
    if position(v_old_pattern in v_definition) > 0 then
      execute replace(v_definition, v_old_pattern, v_new_pattern);
    elsif position(v_new_pattern in v_definition) = 0 then
      raise exception 'Could not extend checkpoint code validation in %.', v_signature;
    end if;
  end loop;
end;
$expand_checkpoint_validators$;

insert into public.checkpoints (code)
select 'VMH-' || lpad(series::text, 2, '0')
from generate_series(11, 25) as series
on conflict (code) do nothing;

-- Seed only new codes without any placement history. Rerunning this migration
-- never resets an assigned location or changes an existing placement timeline.
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
where checkpoint.code ~ '^VMH-(1[1-9]|2[0-5])$'
  and not exists (
    select 1
    from public.checkpoint_placements as existing
    where existing.checkpoint_id = checkpoint.id
  );

notify pgrst, 'reload schema';


-- 20261013000000_checkpoint_journey_v3.sql
-- Approved Mental Battery journey: anonymous structural progress and phone-only requests.
-- Keeps old checkpoint records, placement histories and all other funnels intact.

set local search_path = pg_catalog, public, extensions;

create table if not exists public.checkpoint_journeys (
  session_id uuid primary key references public.funnel_sessions(id) on delete restrict,
  version text not null default 'mental-battery-v3' check (version = 'mental-battery-v3'),
  created_at timestamptz not null default clock_timestamp()
);
create table if not exists public.checkpoint_journey_events (
  event_id uuid primary key,
  session_id uuid not null references public.checkpoint_journeys(session_id) on delete restrict,
  event_name text not null check (event_name in (
    'landing_view','checkin_started','question_reached','question_completed','checkin_completed',
    'result_viewed','consultation_cta_clicked','therapist_options_opened','therapist_changed',
    'consultation_started','contact_field_reached','form_validation_failed','request_attempted',
    'request_failed','request_saved'
  )),
  step_number smallint,
  field_name text,
  cta_placement text,
  occurred_at timestamptz not null default clock_timestamp(),
  check ((event_name in ('question_reached','question_completed') and step_number is not null and step_number between 1 and 4)
    or (event_name not in ('question_reached','question_completed') and step_number is null)),
  check ((event_name = 'contact_field_reached' and field_name is not null and field_name in ('name','phone','consent','language'))
    or (event_name <> 'contact_field_reached' and field_name is null)),
  check (cta_placement is null or (event_name = 'consultation_cta_clicked' and cta_placement in ('offer','mobile')))
);
create unique index if not exists checkpoint_journey_logical_event
  on public.checkpoint_journey_events(session_id,event_name,coalesce(step_number,0),coalesce(field_name,''),coalesce(cta_placement,''));
create index if not exists checkpoint_journey_events_time on public.checkpoint_journey_events(occurred_at,session_id);
create table if not exists public.checkpoint_call_requests (
  client_submission_id uuid primary key,
  session_id uuid not null references public.checkpoint_journeys(session_id) on delete restrict,
  lead_id uuid not null unique references public.consultation_leads(id) on delete restrict,
  reference_id text not null unique,
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  submitted_at timestamptz not null default clock_timestamp()
);
alter table public.checkpoint_journeys enable row level security;
alter table public.checkpoint_journey_events enable row level security;
alter table public.checkpoint_call_requests enable row level security;
revoke all on public.checkpoint_journeys, public.checkpoint_journey_events, public.checkpoint_call_requests from public,anon,authenticated,service_role;

-- Existing consultation forms still require email. Only this consented, phone-only path may omit it.
alter table public.consultation_requests alter column email drop not null;
alter table public.consultation_requests drop constraint if exists consultation_requests_phone_only_checkpoint;
alter table public.consultation_requests add constraint consultation_requests_phone_only_checkpoint
  check (email is not null or (source_kind = 'mental_battery_checkpoint' and consent_version = 'checkpoint-free-call-v3'));

create or replace function public.ingest_checkpoint_journey_event(
  p_checkpoint_code text, p_session_key uuid, p_event_id uuid, p_event_name text,
  p_step_number smallint default null, p_field text default null, p_placement text default null
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,extensions as $$
declare v_session public.funnel_sessions%rowtype; v_legacy jsonb; v_event public.checkpoint_journey_events%rowtype; v_mapped text;
begin
  if p_event_id is null or p_session_key is null or p_checkpoint_code is null or p_checkpoint_code !~ '^VMH-(0[1-9]|1[0-9]|2[0-5])$'
    or p_event_name is null or p_event_name not in ('landing_view','checkin_started','question_reached','question_completed','checkin_completed','result_viewed','consultation_cta_clicked','therapist_options_opened','therapist_changed','consultation_started','contact_field_reached','form_validation_failed','request_attempted','request_failed')
    or (p_event_name in ('question_reached','question_completed') and (p_step_number is null or p_step_number not between 1 and 4))
    or (p_event_name not in ('question_reached','question_completed') and p_step_number is not null)
    or (p_event_name = 'contact_field_reached' and (p_field is null or p_field not in ('name','phone','consent','language')))
    or (p_event_name <> 'contact_field_reached' and p_field is not null)
    or (p_placement is not null and (p_event_name <> 'consultation_cta_clicked' or p_placement not in ('offer','mobile')))
  then raise exception 'Invalid checkpoint journey event.' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('checkpoint-v3-session:'||p_session_key::text,0));
  select * into v_session from public.funnel_sessions where anonymous_session_id=p_session_key;
  if found and not exists(select 1 from public.checkpoint_journeys where session_id=v_session.id) then
    raise exception 'Legacy sessions cannot be relabelled.' using errcode='22023';
  end if;
  v_legacy := public.ingest_checkpoint_event(p_checkpoint_code,p_session_key,extensions.gen_random_uuid(),'landing_view',null);
  select * into strict v_session from public.funnel_sessions where anonymous_session_id=p_session_key;
  insert into public.checkpoint_journeys(session_id) values(v_session.id) on conflict do nothing;
  select * into v_event from public.checkpoint_journey_events where event_id=p_event_id;
  if found and (v_event.session_id<>v_session.id or v_event.event_name<>p_event_name or v_event.step_number is distinct from p_step_number or v_event.field_name is distinct from p_field or v_event.cta_placement is distinct from p_placement) then
    raise exception 'Event identifier is already in use.' using errcode='23505';
  end if;
  insert into public.checkpoint_journey_events(event_id,session_id,event_name,step_number,field_name,cta_placement)
    values(p_event_id,v_session.id,p_event_name,p_step_number,p_field,p_placement) on conflict do nothing;
  v_mapped := case when p_event_name='question_completed' then 'checkin_step_completed'
    when p_event_name in ('checkin_started','checkin_completed','result_viewed','consultation_cta_clicked','consultation_started') then p_event_name end;
  if v_mapped is not null then
    perform public.ingest_checkpoint_event(p_checkpoint_code,p_session_key,extensions.gen_random_uuid(),v_mapped,case when v_mapped='checkin_step_completed' then p_step_number end);
  end if;
  return jsonb_build_object('accepted',true,'placementId',v_session.placement_id);
end;
$$;

create or replace function public.save_checkpoint_call_request(
  p_checkpoint_code text,p_session_key uuid,p_client_submission_id uuid,p_reference_id text,p_payload_hash text,
  p_first_name text,p_phone text,p_therapist text,p_language text,p_service text
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,extensions as $$
declare v_session public.funnel_sessions%rowtype; v_existing public.checkpoint_call_requests%rowtype;
  v_lead uuid; v_now timestamptz := clock_timestamp(); v_therapy text; v_coordination text;
  v_consent constant text := 'I agree that Valisen Mental Health may contact me about this free consultation request and help arrange a therapist and time.';
begin
  if p_client_submission_id is null or p_reference_id is null or p_reference_id !~ '^VC-[A-F0-9]{24}$'
    or p_payload_hash is null or p_payload_hash !~ '^[a-f0-9]{64}$' or p_first_name is null or char_length(btrim(p_first_name)) not between 1 and 80
    or p_phone is null or regexp_replace(p_phone,'[^0-9]','','g') !~ '^[2-9][0-9]{2}[2-9][0-9]{6}$'
    or p_language is null or p_language not in ('English','French','Arabic','Mandarin')
    or p_therapist is null or p_therapist not in ('team-help','ryann-simpson','wilfred-bengnwi','meryem-ibrahim','tim-kahtava','dayong-quan')
    or p_service is null or p_service not in ('individual','couples')
  then raise exception 'Invalid checkpoint call request.' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('checkpoint-v3-request:'||p_client_submission_id::text,0));
  select * into v_existing from public.checkpoint_call_requests where client_submission_id=p_client_submission_id;
  if found then
    if v_existing.payload_hash<>p_payload_hash or v_existing.reference_id<>p_reference_id or not exists(
      select 1 from public.funnel_sessions s join public.checkpoints c on c.id=s.checkpoint_id
      where s.id=v_existing.session_id and s.anonymous_session_id=p_session_key and c.code=p_checkpoint_code
    ) then raise exception 'Submission identifier is already in use.' using errcode='23505'; end if;
    return jsonb_build_object('accepted',true,'created',false,'leadId',v_existing.lead_id,'referenceId',v_existing.reference_id);
  end if;
  perform public.ingest_checkpoint_journey_event(p_checkpoint_code,p_session_key,extensions.gen_random_uuid(),'landing_view');
  select * into strict v_session from public.funnel_sessions where anonymous_session_id=p_session_key;
  v_therapy := case when p_service='couples' then 'Couples Therapy' else 'Individual Therapy' end;
  v_coordination := 'Free 20-minute phone consultation requested through /c/'||p_checkpoint_code||'. Consultation language: '||p_language||'. Therapist preference: '||p_therapist||'. Respond by phone within 24 hours to arrange a time. This is not a booked appointment. Quiz answers are not attached.';
  insert into public.consultation_leads(consultation_reference_id,client_submission_id,first_name,phone,therapy_type,preferred_therapist,preferred_days,preferred_time,coordination_details,consent_text,consent_version,consented_at,source_kind,source_detail,checkpoint_code,checkpoint_placement_id,checkpoint_session_key,attribution_verified,notification_status,submitted_at,last_activity_at)
    values(p_reference_id,p_client_submission_id::text,btrim(p_first_name),p_phone,v_therapy,nullif(p_therapist,'team-help'),'Team will arrange','Team will arrange',v_coordination,v_consent,'checkpoint-free-call-v3',v_now,'mental_battery_checkpoint','mental_battery_checkpoint',p_checkpoint_code,v_session.placement_id,p_session_key::text,true,'pending',v_now,v_now) returning id into v_lead;
  insert into public.consultation_requests(lead_id,request_reference,request_kind,client_submission_id,first_name,email,phone,therapy_type,preferred_therapist,preferred_days,preferred_time,coordination_details,consent_text,consent_version,consented_at,source_kind,source_detail,checkpoint_code,checkpoint_placement_id,checkpoint_session_key,attribution_verified,notification_status,submitted_at)
    values(v_lead,p_reference_id,'consultation_form',p_client_submission_id::text,btrim(p_first_name),null,p_phone,v_therapy,nullif(p_therapist,'team-help'),'Team will arrange','Team will arrange',v_coordination,v_consent,'checkpoint-free-call-v3',v_now,'mental_battery_checkpoint','mental_battery_checkpoint',p_checkpoint_code,v_session.placement_id,p_session_key::text,true,'pending',v_now);
  insert into public.consultation_lead_history(lead_id,event_type,to_workflow_status,to_conversion_stage,note,actor_kind)
    values(v_lead,'created','new','consultation_requested','Checkpoint free-call request saved.','system');
  insert into public.checkpoint_call_requests(client_submission_id,session_id,lead_id,reference_id,payload_hash)
    values(p_client_submission_id,v_session.id,v_lead,p_reference_id,p_payload_hash);
  perform public.record_checkpoint_consultation(p_checkpoint_code,p_session_key,p_reference_id,'submitted');
  insert into public.checkpoint_journey_events(event_id,session_id,event_name) values(extensions.gen_random_uuid(),v_session.id,'request_saved') on conflict do nothing;
  return jsonb_build_object('accepted',true,'created',true,'leadId',v_lead,'referenceId',p_reference_id);
end;
$$;

create or replace function public.get_checkpoint_journey_report(p_from timestamptz,p_to timestamptz,p_checkpoint_code text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_result jsonb;
begin
  if p_from is null or p_to is null or p_to<=p_from or (p_checkpoint_code is not null and p_checkpoint_code !~ '^VMH-(0[1-9]|1[0-9]|2[0-5])$') then raise exception 'Invalid report range.' using errcode='22023'; end if;
  with cohort as (
    select s.* from public.funnel_sessions s join public.checkpoints c on c.id=s.checkpoint_id
    join public.checkpoint_journeys j on j.session_id=s.id
    where s.started_at>=p_from and s.started_at<p_to and (p_checkpoint_code is null or c.code=p_checkpoint_code)
  ), events as (
    select e.* from public.checkpoint_journey_events e join cohort s on s.id=e.session_id where e.occurred_at<p_to
  ), totals as (
    select count(distinct session_id) filter(where event_name='checkin_started') as started,
      count(distinct session_id) filter(where event_name='checkin_completed') as completed,
      count(distinct session_id) filter(where event_name='consultation_cta_clicked') as cta,
      count(distinct session_id) filter(where event_name='consultation_started') as opened,
      count(distinct session_id) filter(where event_name='contact_field_reached' and field_name='name') as name_reached,
      count(distinct session_id) filter(where event_name='contact_field_reached' and field_name='phone') as phone_reached,
      count(distinct session_id) filter(where event_name='contact_field_reached' and field_name='consent') as consent_reached,
      count(distinct session_id) filter(where event_name='form_validation_failed') as invalid,
      count(distinct session_id) filter(where event_name='request_attempted') as attempted,
      count(distinct session_id) filter(where event_name='request_failed') as failed,
      count(distinct session_id) filter(where event_name='request_saved') as saved,
      count(distinct session_id) filter(where event_name='therapist_options_opened') as options from events
  ), questions as (
    select n as step, count(distinct e.session_id) filter(where event_name='question_reached') as reached,
      count(distinct e.session_id) filter(where event_name='question_completed') as completed
    from generate_series(1,4) n left join events e on e.step_number=n group by n
  ) select jsonb_build_object(
    'available',true,'version','mental-battery-v3','sessions',(select count(*) from cohort),
    'started',t.started,'completed',t.completed,
    'threeQuestionResults',(select count(*) from cohort s where exists(select 1 from events e where e.session_id=s.id and e.event_name='checkin_completed') and not exists(select 1 from events e where e.session_id=s.id and e.step_number=4)),
    'fourQuestionResults',(select count(*) from cohort s where exists(select 1 from events e where e.session_id=s.id and e.event_name='checkin_completed') and exists(select 1 from events e where e.session_id=s.id and e.step_number=4)),
    'legacySessions',(select count(*) from public.funnel_sessions s join public.checkpoints c on c.id=s.checkpoint_id where s.started_at>=p_from and s.started_at<p_to and (p_checkpoint_code is null or c.code=p_checkpoint_code) and not exists(select 1 from public.checkpoint_journeys j where j.session_id=s.id)),
    'questions',(select jsonb_agg(jsonb_build_object('stepNumber',step,'label',case step when 1 then 'Your energy' when 2 then 'What’s on your mind' when 3 then 'Personal follow-up / wellbeing goal' else 'Everyday impact (only when asked)' end,'reached',reached,'completed',completed,'exits',greatest(0,reached-completed)) order by step) from questions),
    'actions',jsonb_build_object('cta',t.cta,'formOpened',t.opened,'nameReached',t.name_reached,'phoneReached',t.phone_reached,'consentReached',t.consent_reached,'validationFailed',t.invalid,'attempted',t.attempted,'failed',t.failed,'saved',t.saved,'therapistOptions',t.options,
      'booked',(select count(distinct r.session_id) from public.checkpoint_call_requests r join cohort s on s.id=r.session_id join public.consultation_leads l on l.id=r.lead_id where l.booked_at<p_to),
      'paid',(select count(distinct r.session_id) from public.checkpoint_call_requests r join cohort s on s.id=r.session_id join public.consultation_leads l on l.id=r.lead_id where l.paid_therapy_at<p_to))
  ) into v_result from totals t;
  return v_result;
end;
$$;

create or replace function public.checkpoint_journey_ready() returns jsonb
language sql security definer set search_path=pg_catalog,public as $$
  select jsonb_build_object('ready',true,'version','mental-battery-v3');
$$;
revoke all on function public.ingest_checkpoint_journey_event(text,uuid,uuid,text,smallint,text,text),public.save_checkpoint_call_request(text,uuid,uuid,text,text,text,text,text,text,text),public.get_checkpoint_journey_report(timestamptz,timestamptz,text),public.checkpoint_journey_ready() from public,anon,authenticated;
grant execute on function public.ingest_checkpoint_journey_event(text,uuid,uuid,text,smallint,text,text),public.save_checkpoint_call_request(text,uuid,uuid,text,text,text,text,text,text,text),public.get_checkpoint_journey_report(timestamptz,timestamptz,text),public.checkpoint_journey_ready() to service_role;
notify pgrst,'reload schema';

select 'ready' as tracking_status,
 (select count(*)=25 from public.checkpoints where code ~ '^VMH-(0[1-9]|1[0-9]|2[0-5])$') as all_vmhs_ready,
 (public.checkpoint_journey_ready()->>'ready')::boolean as new_question_tracking_ready,
 to_regprocedure('public.save_checkpoint_call_request(text,uuid,uuid,text,text,text,text,text,text,text)') is not null as phone_request_ready;
commit;

-- Contact-first Ads requests and privacy-safe booking control diagnostics.
-- Preserves existing leads, requests, appointments, and live/test isolation.
begin;

create or replace function public.is_google_ads_booking_control(p_id text) returns boolean
language sql immutable set search_path=pg_catalog as $$
 select p_id in ('button','submit','contact-submit','calendar-open','calendar-later','calendar-confirm',
 'calendar-date','calendar-time','calendar-period','calendar-previous-month','calendar-next-month',
 'therapist-select','language-select','header-cta','hero-cta','therapist-cta','closing-cta','mobile-cta','reminder-cta');
$$;

alter table public.google_ads_events drop constraint if exists google_ads_events_target_id_valid;
alter table public.google_ads_events add constraint google_ads_events_target_id_valid check (
 target_id is null or target_id in ('full-name','first-name','last-name','email','phone','therapy-type',
 'preferred-therapist','additional-info','availability','consent') or public.is_google_ads_booking_control(target_id)
);

do $patch$
declare definition text; original text;
begin
 select pg_get_functiondef('public.ingest_google_ads_events(text,timestamptz,text,jsonb)'::regprocedure) into definition;
 definition := replace(definition, E'\r\n', E'\n');
 if position('v_target_id is not null and not public.is_google_ads_booking_control(v_target_id)' in definition)=0 then
  original := definition;
  definition := replace(definition,'v_target_id is not null and v_target_id not in (','v_target_id is not null and not public.is_google_ads_booking_control(v_target_id) and v_target_id not in (');
  if definition=original then raise exception 'Expected Google Ads target identifier guard missing.'; end if;
 end if;
 if position('v_target_type = ''button'' and public.is_google_ads_booking_control(v_target_id)' in definition)=0 then
  original := definition;
  definition := replace(definition, 'v_target_id in (''button'', ''submit'')', 'public.is_google_ads_booking_control(v_target_id)');
  if definition=original then raise exception 'Expected Google Ads control guard missing.'; end if;
  original := definition;
  definition := replace(definition, E'v_target_type = ''consultation'' and v_target_path in (\n        ''/consultation'', ''/book-consultation'', ''/get-matched'', ''/intake''\n      ) and v_target_id is null',
    E'v_target_type = ''consultation'' and (v_target_path in (''/consultation'', ''/book-consultation'', ''/get-matched'', ''/intake'') or public.is_google_ads_consultation_path(v_target_path)) and (v_target_id is null or v_target_id in (''header-cta'',''hero-cta'',''therapist-cta'',''closing-cta'',''mobile-cta'',''reminder-cta''))');
  if definition=original then raise exception 'Expected Google Ads consultation target guard missing.'; end if;
 end if;
 execute definition;
end;
$patch$;

-- Clone the deployed request writer, preserving all existing validation,
-- notification leases, idempotency, and QA triggers. Add one verified parent
-- request to its lead lookup so two stages enrich one opportunity.
do $followup$
declare definition text; anchor text; gate text; procedure_oid oid; identity text;
begin
 select oid into strict procedure_oid from pg_proc where pronamespace='public'::regnamespace and proname='upsert_consultation_lead';
 definition := replace(pg_get_functiondef(procedure_oid), E'\r\n', E'\n');
 anchor := 'FUNCTION public.upsert_consultation_lead(';
 if position(anchor in definition)=0 then raise exception 'Expected consultation writer missing.'; end if;
 definition := replace(definition, anchor, 'FUNCTION public.upsert_consultation_followup(p_contact_reference text, ');
 anchor := 'or (v_client_submission is not null and lead.client_submission_id = v_client_submission)';
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor) <> 1 then raise exception 'Expected consultation lead lookup missing.'; end if;
 definition := replace(definition,anchor,anchor||E'\n     or lead.id = (select parent.lead_id from public.consultation_requests parent where parent.request_reference=p_contact_reference)');
 gate := E'begin\n  perform pg_advisory_xact_lock(hashtextextended(''contact-followup:''||p_contact_reference,0));\n  if p_contact_reference is null or p_contact_reference !~ ''^VC-[A-F0-9]{24}$'' or not exists (\n    select 1 from public.consultation_requests parent where parent.request_reference=p_contact_reference\n      and parent.request_kind=''consultation_form'' and lower(parent.email)=lower(btrim(p_email))\n      and regexp_replace(parent.phone,''[^0-9]'','''',''g'')=regexp_replace(p_phone,''[^0-9]'','''',''g'')\n      and parent.coordination_details like ''CONTACT DETAILS RECEIVED%''\n  ) then raise exception ''Invalid contact continuation.'' using errcode=''22023''; end if;\n';
 if position(E'begin\n' in definition)=0 then raise exception 'Expected consultation writer body missing.'; end if;
 definition := regexp_replace(definition, E'begin\n', gate);
 execute definition;
 select pg_get_function_identity_arguments(oid) into strict identity from pg_proc where pronamespace='public'::regnamespace and proname='upsert_consultation_followup';
 execute 'revoke all on function public.upsert_consultation_followup('||identity||') from public,anon,authenticated';
 execute 'grant execute on function public.upsert_consultation_followup('||identity||') to service_role';
end;
$followup$;

-- A follow-up reference belongs to the original lead through its request row.
do $booked$
declare definition text; anchor text := 'where lead.consultation_reference_id = p_consultation_reference_id';
begin
 select pg_get_functiondef('public.mark_consultation_slot_booked(text)'::regprocedure) into definition;
 if position('contact-first request lookup' in definition)=0 then
  if position(anchor in definition)=0 then raise exception 'Expected booking lead lookup missing.'; end if;
  definition := replace(definition,anchor,E'where lead.id = (select request.lead_id from public.consultation_requests request where request.request_reference=p_consultation_reference_id) -- contact-first request lookup');
  execute definition;
 end if;
end;
$booked$;

select 'ready' as contact_first_status,
 exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname='upsert_consultation_followup') as linked_followup_ready,
 public.is_google_ads_booking_control('contact-submit') and public.is_google_ads_booking_control('calendar-time') as detailed_tracking_ready;
commit;

-- Privacy-safe consultation field-entry tracking for signed Google Ads journeys.
-- The event stores only a closed field identifier. No form value, label, or
-- arbitrary text can pass either the application or database contracts.

begin;

set local search_path = pg_catalog, public, extensions;

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
    'form_field_entered', 'consultation_step_viewed',
    'consultation_validation_failed', 'consultation_submitted',
    'thank_you_viewed'
  );
$$;

alter table public.google_ads_events
  drop constraint google_ads_events_target_id_valid;
alter table public.google_ads_events
  add constraint google_ads_events_target_id_valid check (
    target_id is null or target_id in (
      'full-name', 'first-name', 'last-name', 'email', 'phone',
      'therapy-type', 'preferred-therapist', 'additional-info',
      'availability', 'consent', 'button', 'submit'
    )
  );

-- Preserve the existing mature ingestion function and amend only its closed
-- event/field/path checks. Assertions make schema drift fail the migration
-- instead of silently weakening validation.
do $install_google_ads_field_entry_ingestion$
declare
  v_definition text;
  v_previous text;
  v_anchor text;
  v_match_count integer;
begin
  select pg_get_functiondef(
    'public.ingest_google_ads_events(text,timestamptz,text,jsonb)'::regprocedure
  ) into strict v_definition;
  v_definition := replace(v_definition, E'\r\n', E'\n');

  v_anchor := '''first-name'', ''last-name''';
  v_match_count := (
    length(v_definition) - length(replace(v_definition, v_anchor, ''))
  ) / length(v_anchor);
  if v_match_count <> 3 then
    raise exception
      'Expected three Google Ads form-field allowlists; found %.',
      v_match_count;
  end if;
  v_definition := replace(
    v_definition,
    v_anchor,
    '''full-name'', ''first-name'', ''last-name'''
  );

  v_previous := v_definition;
  v_definition := replace(
    v_definition,
    '''form_started'', ''form_field_focused'',',
    '''form_started'', ''form_field_focused'', ''form_field_entered'','
  );
  if v_definition = v_previous then
    raise exception 'Could not add the Google Ads field-entry path event.';
  end if;

  v_previous := v_definition;
  v_definition := replace(
    v_definition,
    'and v_path <> ''/consultation''',
    'and v_path not in (''/consultation'', ''/welcome'')'
  );
  if v_definition = v_previous then
    raise exception 'Could not install Google Ads consultation-form paths.';
  end if;

  v_previous := v_definition;
  v_definition := replace(
    v_definition,
    'elsif v_event_name = ''form_field_focused'' and not coalesce((',
    'elsif v_event_name in (''form_field_focused'', ''form_field_entered'') and not coalesce(('
  );
  if v_definition = v_previous then
    raise exception 'Could not install Google Ads field-entry target validation.';
  end if;

  v_previous := v_definition;
  v_definition := replace(
    v_definition,
    '''form_field_focused'', ''consultation_validation_failed''' || E'\n' ||
      '    ) and v_has_target',
    '''form_field_focused'', ''form_field_entered'',' || E'\n' ||
      '      ''consultation_validation_failed''' || E'\n' ||
      '    ) and v_has_target'
  );
  if v_definition = v_previous then
    raise exception 'Could not install Google Ads field-entry target allowance.';
  end if;

  if v_definition not like '%form_field_entered%' or
     v_definition not like '%v_path not in (''/consultation'', ''/welcome'')%' or
     v_definition not like '%''full-name'', ''first-name'', ''last-name''%' then
    raise exception 'Google Ads field-entry ingestion verification failed.';
  end if;
  execute v_definition;
end;
$install_google_ads_field_entry_ingestion$;

-- Add a durable ordered summary to every recent journey. The timeline still
-- shows each event, while this list remains complete if a long session has
-- more events than the timeline display limit.
do $install_google_ads_field_entry_dashboard$
declare
  v_live_definition text;
  v_test_definition text;
  v_previous text;
  v_name_anchor text := 'FUNCTION public.get_google_ads_dashboard(';
  v_session_anchor text := 'and not ads_session.is_test';
  v_lead_anchor text := 'where not lead.is_test';
  v_json_anchor text := '''consultationSubmitted'', recent.request_count > 0,';
  v_json_replacement text := '''formFieldsEntered'', coalesce((' || E'\n' ||
    '          select jsonb_agg(field.target_id order by field.first_sequence)' || E'\n' ||
    '          from (' || E'\n' ||
    '            select event.target_id, min(event.sequence) as first_sequence' || E'\n' ||
    '            from public.google_ads_events as event' || E'\n' ||
    '            where event.session_id = recent.id' || E'\n' ||
    '              and event.event_name = ''form_field_entered''' || E'\n' ||
    '              and event.target_id is not null' || E'\n' ||
    '            group by event.target_id' || E'\n' ||
    '          ) as field' || E'\n' ||
    '        ), ''[]''::jsonb),' || E'\n' ||
    '        ''consultationSubmitted'', recent.request_count > 0,';
begin
  select pg_get_functiondef(
    'public.get_google_ads_dashboard(timestamptz,timestamptz)'::regprocedure
  ) into strict v_live_definition;
  v_live_definition := replace(v_live_definition, E'\r\n', E'\n');

  v_previous := v_live_definition;
  v_live_definition := replace(
    v_live_definition,
    v_json_anchor,
    v_json_replacement
  );
  if v_live_definition = v_previous or
     v_live_definition not like '%''formFieldsEntered''%' then
    raise exception 'Could not add field-entry summaries to the Google Ads dashboard.';
  end if;
  execute v_live_definition;

  if (length(v_live_definition) - length(replace(v_live_definition, v_name_anchor, '')))
       / length(v_name_anchor) <> 1 or
     (length(v_live_definition) - length(replace(v_live_definition, v_session_anchor, '')))
       / length(v_session_anchor) <> 1 or
     (length(v_live_definition) - length(replace(v_live_definition, v_lead_anchor, '')))
       / length(v_lead_anchor) <> 1 then
    raise exception 'Unexpected Google Ads dashboard definition; cannot clone QA safely.';
  end if;

  v_test_definition := replace(
    v_live_definition,
    v_name_anchor,
    'FUNCTION public.get_google_ads_test_dashboard('
  );
  v_test_definition := replace(
    v_test_definition,
    v_session_anchor,
    'and ads_session.is_test'
  );
  v_test_definition := replace(
    v_test_definition,
    v_lead_anchor,
    'where lead.is_test'
  );
  if v_test_definition = v_live_definition or
     v_test_definition like '%not ads_session.is_test%' or
     v_test_definition like '%not lead.is_test%' or
     v_test_definition not like '%''formFieldsEntered''%' then
    raise exception 'Could not safely clone the Google Ads field-entry QA view.';
  end if;
  execute v_test_definition;
end;
$install_google_ads_field_entry_dashboard$;

comment on table public.google_ads_events is
  'Closed-taxonomy Google Ads mirror events. Consultation field events store field identifiers only; raw URLs, labels, values, and free text are never retained.';

commit;

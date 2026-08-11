-- Unified growth analytics and consented consultation CRM
--
-- This migration is deliberately additive. The original Mental Battery tables
-- and RPCs remain authoritative for checkpoint/location reporting. Anonymous
-- site/quiz behaviour is stored separately from consultation contact details.

begin;

set local search_path = pg_catalog, public, extensions;

create table public.growth_funnel_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  session_key text not null unique,
  started_at timestamptz not null,
  last_seen_at timestamptz not null,
  last_event_name text not null default 'session_started',
  last_path text not null default '/',
  last_page text,
  last_stage text not null default 'page_view',
  quiz_version text,
  max_quiz_question smallint not null default 0,
  quiz_started boolean not null default false,
  quiz_completed boolean not null default false,
  results_access_viewed boolean not null default false,
  quiz_lead_submitted boolean not null default false,
  results_viewed boolean not null default false,
  therapist_match_viewed boolean not null default false,
  consultation_click_count integer not null default 0,
  consultation_page_viewed boolean not null default false,
  consultation_max_step smallint not null default 0,
  consultation_submitted boolean not null default false,
  jane_click_count integer not null default 0,
  explicit_exit boolean not null default false,
  last_cta_placement text,
  therapist_id text,
  submission_reference text,
  device_category text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  referrer_host text,
  event_count integer not null default 0,
  last_sequence integer not null default 0,
  created_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp(),
  constraint growth_funnel_sessions_key_valid
    check (session_key ~ '^fs-[A-Za-z0-9-]{16,90}$'),
  constraint growth_funnel_sessions_time_valid
    check (last_seen_at >= started_at - interval '5 minutes'),
  constraint growth_funnel_sessions_quiz_question_valid
    check (max_quiz_question between 0 and 19),
  constraint growth_funnel_sessions_quiz_version_valid
    check (quiz_version is null or char_length(quiz_version) between 1 and 40),
  constraint growth_funnel_sessions_consultation_step_valid
    check (consultation_max_step between 0 and 10),
  constraint growth_funnel_sessions_counts_valid
    check (
      consultation_click_count >= 0 and jane_click_count >= 0 and
      event_count >= 0 and last_sequence >= 0
    ),
  constraint growth_funnel_sessions_device_valid
    check (device_category is null or device_category in ('mobile', 'tablet', 'desktop'))
);

create index growth_funnel_sessions_started_idx
  on public.growth_funnel_sessions (started_at desc);
create index growth_funnel_sessions_quiz_idx
  on public.growth_funnel_sessions (quiz_started, started_at desc);
create index growth_funnel_sessions_source_idx
  on public.growth_funnel_sessions (utm_source, utm_campaign, started_at desc);
create index growth_funnel_sessions_reference_idx
  on public.growth_funnel_sessions (submission_reference)
  where submission_reference is not null;

create table public.growth_quiz_attempts (
  attempt_key text primary key,
  session_id uuid not null references public.growth_funnel_sessions(id) on delete cascade,
  started_at timestamptz not null,
  last_seen_at timestamptz not null,
  last_stage text not null default 'quiz_page_viewed',
  max_quiz_question smallint not null default 0,
  last_quiz_question smallint not null default 0,
  quiz_started boolean not null default false,
  quiz_completed boolean not null default false,
  explicit_exit boolean not null default false,
  quiz_version text,
  last_sequence integer not null default 0,
  created_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp(),
  constraint growth_quiz_attempts_key_valid
    check (attempt_key ~ '^qa-[A-Za-z0-9-]{16,90}$'),
  constraint growth_quiz_attempts_time_valid
    check (last_seen_at >= started_at - interval '5 minutes'),
  constraint growth_quiz_attempts_question_valid
    check (max_quiz_question between 0 and 19),
  constraint growth_quiz_attempts_last_question_valid
    check (last_quiz_question between 0 and 19),
  constraint growth_quiz_attempts_sequence_valid check (last_sequence >= 0)
);

create index growth_quiz_attempts_session_idx
  on public.growth_quiz_attempts (session_id, started_at);
create index growth_quiz_attempts_started_idx
  on public.growth_quiz_attempts (started_at desc);

create table public.growth_funnel_events (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid not null references public.growth_funnel_sessions(id) on delete cascade,
  client_event_id text not null unique,
  sequence integer not null,
  occurred_at timestamptz not null,
  event_name text not null,
  path text not null,
  page text,
  stage text not null,
  quiz_question smallint,
  quiz_attempt_key text,
  quiz_intent text,
  funnel_step smallint,
  cta_placement text,
  therapist_id text,
  submission_reference text,
  finder_used boolean,
  funnel_completed boolean,
  elapsed_ms integer not null,
  created_at timestamptz not null default transaction_timestamp(),
  constraint growth_funnel_events_session_sequence_unique unique (session_id, sequence),
  constraint growth_funnel_events_client_id_valid
    check (client_event_id ~ '^fe-[A-Za-z0-9-]{16,90}$'),
  constraint growth_funnel_events_sequence_valid check (sequence between 1 and 1000000),
  constraint growth_funnel_events_name_allowed check (event_name in (
    'session_exit',
    'landing_page_viewed', 'homepage_viewed', 'therapist_directory_viewed',
    'paid_traffic_landed', 'hero_finder_clicked', 'hero_compare_clicked',
    'hero_booking_clicked', 'hero_phone_clicked', 'pricing_section_viewed',
    'insurance_section_viewed', 'therapist_finder_started',
    'therapist_finder_step_completed', 'therapist_finder_completed',
    'therapist_recommendation_viewed', 'therapist_recommendation_profile_clicked',
    'therapist_recommendation_jane_clicked', 'concern_selector_used',
    'therapist_card_viewed', 'therapist_profile_clicked',
    'therapist_compare_started', 'therapist_compare_completed',
    'directory_jane_clicked', 'possibility_builder_viewed',
    'possibility_builder_started', 'possibility_stage_completed',
    'possibility_reflection_viewed', 'recommendation_profile_clicked',
    'recommendation_jane_clicked', 'alternative_therapists_clicked',
    'possibility_builder_restarted', 'phone_clicked', 'request_help_opened',
    'request_help_submitted', 'quiz_clicked', 'consultation_page_viewed',
    'consultation_form_started', 'consultation_step_viewed',
    'consultation_form_validation_failed', 'consultation_request_clicked',
    'consultation_request_submitted', 'consultation_jane_secondary_clicked',
    'quiz_page_viewed', 'quiz_question_viewed', 'quiz_question_answered',
    'quiz_back_clicked', 'quiz_access_form_viewed', 'quiz_access_form_started',
    'quiz_access_form_validation_failed', 'quiz_started', 'quiz_progressed',
    'quiz_completed', 'quiz_intent_selected', 'lead_details_submitted',
    'results_viewed', 'therapist_match_viewed', 'jane_booking_clicked',
    'contact_help_opened', 'contact_help_submitted',
    'therapist_directory_clicked'
  )),
  constraint growth_funnel_events_path_valid
    check (path in (
      '/', '/about', '/anxiety-therapy-ottawa', '/book-consultation',
      '/consultation', '/depression-therapy-ottawa', '/faq',
      '/faq/am-i-burnt-out', '/faq/am-i-depressed',
      '/faq/does-insurance-cover-therapy', '/faq/dont-know-what-i-need',
      '/faq/do-i-have-anxiety', '/faq/first-therapy-session',
      '/faq/how-long-therapy', '/faq/how-often-therapy', '/faq/how-to-book',
      '/faq/how-to-find-therapist', '/faq/is-my-grief-normal',
      '/faq/languages-offered', '/faq/rp-vs-rsw',
      '/faq/stress-vs-anxiety', '/faq/tax-deductible-therapy',
      '/faq/therapy-approaches', '/faq/therapy-cost-ottawa',
      '/faq/therapist-credentials', '/faq/trauma-signs',
      '/faq/what-is-valisen', '/faq/which-plans-cover-rps', '/get-matched',
      '/grief-counselling-ottawa', '/insurance', '/intake',
      '/life-transitions-therapy-ottawa', '/privacy-policy', '/quiz',
      '/relationship-counselling-ottawa', '/resources',
      '/resources/five-signs-of-perfectionism',
      '/self-esteem-therapy-ottawa', '/services', '/sitewide',
      '/stress-therapy-ottawa', '/terms', '/therapists',
      '/therapists/dayong-quan', '/therapists/meryem-ibrahim',
      '/therapists/ryann-simpson', '/therapists/tim-kahtava',
      '/therapists/wilfred-bengnwi', '/therapists/profile',
      '/trauma-therapy-ottawa'
    )),
  constraint growth_funnel_events_page_valid
    check (page is null or page in (
      'homepage', 'therapist_directory', 'therapist_profile',
      'quiz', 'consultation', 'sitewide'
    )),
  constraint growth_funnel_events_question_shape check (
    (event_name in ('quiz_question_viewed', 'quiz_question_answered')
      and quiz_question is not null
      and quiz_question between 1 and 19
      and quiz_attempt_key is not null)
    or
    (event_name not in ('quiz_question_viewed', 'quiz_question_answered')
      and quiz_question is null)
  ),
  constraint growth_funnel_events_attempt_valid check (
    quiz_attempt_key is null or quiz_attempt_key ~ '^qa-[A-Za-z0-9-]{16,90}$'
  ),
  constraint growth_funnel_events_reference_valid check (
    submission_reference is null or
    submission_reference ~ '^(VC-[A-Za-z0-9_-]{6,36}|VQ-[A-Za-z0-9_-]{4,36})$'
  ),
  constraint growth_funnel_events_quiz_intent_valid check (
    quiz_intent is null or quiz_intent in (
      'ready_to_speak', 'brief_consultation',
      'see_recommended_therapist', 'exploring'
    )
  ),
  constraint growth_funnel_events_quiz_intent_shape check (
    (event_name = 'quiz_intent_selected' and
      quiz_intent is not null and quiz_attempt_key is not null) or
    (event_name <> 'quiz_intent_selected' and quiz_intent is null)
  ),
  constraint growth_funnel_events_funnel_step_shape check (
    funnel_step is null or
    (event_name in (
      'therapist_finder_started', 'therapist_finder_step_completed',
      'therapist_finder_completed', 'possibility_builder_started',
      'possibility_stage_completed', 'possibility_reflection_viewed',
      'therapist_recommendation_viewed', 'possibility_builder_restarted',
      'consultation_page_viewed', 'consultation_form_started',
      'consultation_step_viewed', 'consultation_form_validation_failed',
      'consultation_request_submitted'
    ) and funnel_step between 1 and 10)
  ),
  constraint growth_funnel_events_elapsed_valid
    check (elapsed_ms between 0 and 604800000)
);

create index growth_funnel_events_session_occurred_idx
  on public.growth_funnel_events (session_id, occurred_at, sequence);
create index growth_funnel_events_name_occurred_idx
  on public.growth_funnel_events (event_name, occurred_at desc);
create index growth_funnel_events_quiz_question_idx
  on public.growth_funnel_events (quiz_attempt_key, quiz_question, event_name, occurred_at desc)
  where quiz_question is not null;

create table public.quiz_lead_links (
  id uuid primary key default extensions.gen_random_uuid(),
  reference_id text not null unique,
  funnel_session_key text,
  quiz_attempt_key text,
  quiz_version text not null,
  scoring_version text not null,
  intent text,
  recommended_therapist text,
  consented_at timestamptz not null,
  created_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp(),
  constraint quiz_lead_links_reference_valid
    check (reference_id ~ '^VQ-[A-Za-z0-9_-]{4,80}$'),
  constraint quiz_lead_links_session_valid
    check (funnel_session_key is null or funnel_session_key ~ '^fs-[A-Za-z0-9-]{16,90}$'),
  constraint quiz_lead_links_attempt_valid
    check (quiz_attempt_key is null or quiz_attempt_key ~ '^qa-[A-Za-z0-9-]{16,90}$'),
  constraint quiz_lead_links_version_valid
    check (char_length(quiz_version) between 1 and 40 and char_length(scoring_version) between 1 and 40),
  constraint quiz_lead_links_intent_valid
    check (intent is null or intent in (
      'exploring', 'see_recommended_therapist', 'brief_consultation',
      'ready_to_speak'
    )),
  constraint quiz_lead_links_therapist_valid
    check (recommended_therapist is null or recommended_therapist ~ '^[a-z0-9-]{2,80}$')
);

create index quiz_lead_links_session_idx on public.quiz_lead_links (funnel_session_key);
create index quiz_lead_links_created_idx on public.quiz_lead_links (created_at desc);

create table public.quiz_result_submissions (
  id uuid primary key default extensions.gen_random_uuid(),
  client_submission_id text not null unique,
  reference_id text not null unique,
  payload_hash text not null,
  sheet_status text not null default 'pending',
  sheet_row_number integer,
  storage_claim_token uuid,
  storage_claimed_at timestamptz,
  storage_claim_expires_at timestamptz,
  storage_attempt_count integer not null default 0,
  created_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp(),
  constraint quiz_result_submissions_client_id_valid
    check (client_submission_id ~ '^[A-Za-z0-9-]{8,64}$'),
  constraint quiz_result_submissions_reference_valid
    check (reference_id ~ '^VQ-[A-Za-z0-9_-]{4,80}$'),
  constraint quiz_result_submissions_payload_hash_valid
    check (payload_hash ~ '^[a-f0-9]{64}$'),
  constraint quiz_result_submissions_sheet_status_valid
    check (sheet_status in ('pending', 'ready', 'failed')),
  constraint quiz_result_submissions_sheet_row_valid check (
    (sheet_status = 'ready' and sheet_row_number is not null and sheet_row_number >= 2) or
    (sheet_status <> 'ready' and sheet_row_number is null)
  ),
  constraint quiz_result_submissions_storage_claim_valid check (
    (
      storage_claim_token is null and
      storage_claimed_at is null and
      storage_claim_expires_at is null
    ) or (
      storage_claim_token is not null and
      storage_claimed_at is not null and
      storage_claim_expires_at > storage_claimed_at and
      sheet_status <> 'ready'
    )
  ),
  constraint quiz_result_submissions_attempts_valid
    check (storage_attempt_count >= 0)
);

create index quiz_result_submissions_active_claim_idx
  on public.quiz_result_submissions (storage_claim_expires_at)
  where storage_claim_token is not null;

create table public.quiz_result_email_deliveries (
  submission_id uuid not null
    references public.quiz_result_submissions(id) on delete restrict,
  delivery_kind text not null,
  delivery_status text not null default 'pending',
  claim_token uuid,
  claimed_at timestamptz,
  claim_expires_at timestamptz,
  attempt_count integer not null default 0,
  sent_at timestamptz,
  created_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp(),
  primary key (submission_id, delivery_kind),
  constraint quiz_result_email_deliveries_kind_valid
    check (delivery_kind in ('internal_results', 'visitor_results')),
  constraint quiz_result_email_deliveries_status_valid
    check (delivery_status in ('pending', 'sent', 'failed')),
  constraint quiz_result_email_deliveries_claim_valid check (
    (
      claim_token is null and claimed_at is null and claim_expires_at is null
    ) or (
      claim_token is not null and claimed_at is not null and
      claim_expires_at > claimed_at and delivery_status <> 'sent'
    )
  ),
  constraint quiz_result_email_deliveries_sent_valid check (
    (delivery_status = 'sent' and sent_at is not null) or
    (delivery_status <> 'sent' and sent_at is null)
  ),
  constraint quiz_result_email_deliveries_attempts_valid
    check (attempt_count >= 0)
);

create index quiz_result_email_deliveries_active_claim_idx
  on public.quiz_result_email_deliveries (claim_expires_at)
  where claim_token is not null;

create table public.consultation_leads (
  id uuid primary key default extensions.gen_random_uuid(),
  consultation_reference_id text unique,
  quiz_reference_id text unique,
  client_submission_id text unique,
  first_name text,
  last_name text,
  email text,
  phone text,
  therapy_type text,
  preferred_therapist text,
  preferred_days text,
  preferred_time text,
  coordination_details text,
  consent_text text,
  consent_version text,
  consented_at timestamptz,
  source_kind text not null,
  source_detail text,
  checkpoint_code text,
  checkpoint_placement_id uuid,
  checkpoint_session_key text,
  attribution_verified boolean not null default false,
  funnel_session_key text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  referrer_host text,
  workflow_status text not null default 'new',
  conversion_stage text not null default 'consultation_requested',
  booked_at timestamptz,
  paid_therapy_at timestamptz,
  closed_at timestamptz,
  close_reason text,
  admin_note text,
  notification_status text not null default 'pending',
  submitted_at timestamptz not null,
  last_activity_at timestamptz not null,
  row_version integer not null default 1,
  created_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp(),
  constraint consultation_leads_has_reference check (
    consultation_reference_id is not null or quiz_reference_id is not null
  ),
  constraint consultation_leads_consultation_reference_valid check (
    consultation_reference_id is null or
    consultation_reference_id ~ '^[A-Za-z0-9][A-Za-z0-9_-]{5,119}$'
  ),
  constraint consultation_leads_quiz_reference_valid check (
    quiz_reference_id is null or quiz_reference_id ~ '^VQ-[A-Za-z0-9_-]{4,80}$'
  ),
  constraint consultation_leads_client_submission_valid check (
    client_submission_id is null or client_submission_id ~ '^[A-Za-z0-9-]{16,80}$'
  ),
  constraint consultation_leads_source_allowed check (source_kind in (
    'mental_battery_checkpoint', 'quiz', 'direct', 'therapist',
    'possibility_builder', 'website', 'other'
  )),
  constraint consultation_leads_workflow_allowed check (workflow_status in (
    'new', 'in_progress', 'waiting_on_client', 'closed_won',
    'closed_lost', 'closed_unknown', 'duplicate'
  )),
  constraint consultation_leads_conversion_allowed check (conversion_stage in (
    'consultation_requested', 'consultation_booked', 'paid_therapy'
  )),
  constraint consultation_leads_notification_allowed check (notification_status in (
    'pending', 'sent', 'failed', 'unknown'
  )),
  constraint consultation_leads_milestones_valid check (
    (conversion_stage = 'consultation_requested' or booked_at is not null) and
    (conversion_stage <> 'paid_therapy' or paid_therapy_at is not null) and
    (paid_therapy_at is null or booked_at is not null)
  ),
  constraint consultation_leads_paid_workflow_valid check (
    conversion_stage <> 'paid_therapy' or workflow_status = 'closed_won'
  ),
  constraint consultation_leads_contact_lengths check (
    (first_name is null or char_length(first_name) between 1 and 80) and
    (last_name is null or char_length(last_name) between 1 and 80) and
    (email is null or char_length(email) <= 254) and
    (phone is null or char_length(phone) <= 30)
  ),
  constraint consultation_leads_notes_lengths check (
    (coordination_details is null or char_length(coordination_details) <= 3000) and
    (admin_note is null or char_length(admin_note) <= 2000) and
    (close_reason is null or char_length(close_reason) <= 500)
  ),
  constraint consultation_leads_checkpoint_shape check (
    (source_kind <> 'mental_battery_checkpoint') or
    checkpoint_code ~ '^VMH-(0[1-9]|10)$'
  ),
  constraint consultation_leads_checkpoint_session_valid check (
    checkpoint_session_key is null or
    checkpoint_session_key ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
  ),
  constraint consultation_leads_funnel_session_valid check (
    funnel_session_key is null or funnel_session_key ~ '^fs-[A-Za-z0-9-]{16,90}$'
  ),
  constraint consultation_leads_row_version_valid check (row_version > 0)
);

create index consultation_leads_submitted_idx
  on public.consultation_leads (submitted_at desc);
create index consultation_leads_pipeline_idx
  on public.consultation_leads (workflow_status, conversion_stage, submitted_at desc);
create index consultation_leads_source_idx
  on public.consultation_leads (source_kind, submitted_at desc);
create index consultation_leads_checkpoint_idx
  on public.consultation_leads (checkpoint_code, submitted_at desc)
  where checkpoint_code is not null;
create index consultation_leads_funnel_idx
  on public.consultation_leads (funnel_session_key)
  where funnel_session_key is not null;

create table public.consultation_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  lead_id uuid not null references public.consultation_leads(id) on delete restrict,
  request_reference text not null unique,
  request_kind text not null,
  client_submission_id text unique,
  quiz_reference_id text,
  first_name text not null,
  last_name text,
  email text not null,
  phone text not null,
  therapy_type text,
  preferred_therapist text,
  preferred_days text,
  preferred_time text,
  coordination_details text,
  consent_text text not null,
  consent_version text not null,
  consented_at timestamptz not null,
  source_kind text not null,
  source_detail text,
  checkpoint_code text,
  checkpoint_placement_id uuid,
  checkpoint_session_key text,
  attribution_verified boolean not null default false,
  funnel_session_key text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  referrer_host text,
  notification_status text not null,
  notification_claim_token uuid,
  notification_claimed_at timestamptz,
  notification_claim_expires_at timestamptz,
  notification_attempt_count integer not null default 0,
  submitted_at timestamptz not null,
  created_at timestamptz not null default transaction_timestamp(),
  constraint consultation_requests_reference_valid check (
    request_reference ~ '^(VC-[A-Za-z0-9_-]{6,116}|VQ-[A-Za-z0-9_-]{4,80})$'
  ),
  constraint consultation_requests_kind_valid check (
    request_kind in ('consultation_form', 'quiz_contact_help')
  ),
  constraint consultation_requests_quiz_reference_valid check (
    quiz_reference_id is null or quiz_reference_id ~ '^VQ-[A-Za-z0-9_-]{4,80}$'
  ),
  constraint consultation_requests_source_valid check (source_kind in (
    'mental_battery_checkpoint', 'quiz', 'direct', 'therapist',
    'possibility_builder', 'website', 'other'
  )),
  constraint consultation_requests_notification_valid check (
    notification_status in ('pending', 'sent', 'failed', 'unknown')
  ),
  constraint consultation_requests_notification_claim_valid check (
    (
      notification_claim_token is null and
      notification_claimed_at is null and
      notification_claim_expires_at is null
    ) or (
      notification_claim_token is not null and
      notification_claimed_at is not null and
      notification_claim_expires_at > notification_claimed_at
    ) and (
      notification_status <> 'sent' or notification_claim_token is null
    )
  ),
  constraint consultation_requests_notification_attempts_valid check (
    notification_attempt_count >= 0
  ),
  constraint consultation_requests_contact_valid check (
    char_length(first_name) between 1 and 80 and
    char_length(email) <= 254 and char_length(phone) <= 30 and
    (last_name is null or char_length(last_name) <= 80) and
    (coordination_details is null or char_length(coordination_details) <= 3000) and
    char_length(consent_text) between 1 and 2000 and
    char_length(consent_version) between 1 and 80
  ),
  constraint consultation_requests_checkpoint_session_valid check (
    checkpoint_session_key is null or
    checkpoint_session_key ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
  )
);

create index consultation_requests_lead_idx
  on public.consultation_requests (lead_id, submitted_at desc);
create index consultation_requests_submitted_idx
  on public.consultation_requests (submitted_at desc);
create index consultation_requests_active_claim_idx
  on public.consultation_requests (notification_claim_expires_at)
  where notification_claim_token is not null;

create table public.consultation_lead_history (
  id uuid primary key default extensions.gen_random_uuid(),
  lead_id uuid not null references public.consultation_leads(id) on delete restrict,
  event_type text not null,
  from_workflow_status text,
  to_workflow_status text,
  from_conversion_stage text,
  to_conversion_stage text,
  note text,
  actor_kind text not null default 'system',
  actor_reference text,
  recorded_at timestamptz not null default transaction_timestamp(),
  constraint consultation_lead_history_event_allowed check (event_type in (
    'created', 'details_enriched', 'notification_updated',
    'workflow_updated', 'conversion_updated', 'note_updated'
  )),
  constraint consultation_lead_history_actor_allowed
    check (actor_kind in ('system', 'admin')),
  constraint consultation_lead_history_note_valid
    check (note is null or char_length(note) <= 1000)
);

create index consultation_lead_history_lead_idx
  on public.consultation_lead_history (lead_id, recorded_at desc);

comment on table public.growth_funnel_sessions is
  'Anonymous first-party site/quiz session summaries. Contains no contact details or quiz answers.';
comment on table public.growth_funnel_events is
  'Strictly allowlisted anonymous interaction events. Quiz answers, results and free text are prohibited.';
comment on table public.growth_quiz_attempts is
  'Anonymous per-attempt quiz progress, allowing retakes to remain distinct without storing answers.';
comment on table public.quiz_lead_links is
  'Non-PII bridge from a consented quiz reference to anonymous funnel attribution.';
comment on table public.quiz_result_submissions is
  'Service-role-only idempotency registry for quiz result storage. Contains opaque identifiers, a payload fingerprint and Sheet reconciliation state, but no contact details or quiz answers.';
comment on table public.quiz_result_email_deliveries is
  'Service-role-only durable claims for internal and visitor quiz-result emails. The delivery state is authoritative; Sheet columns are a reconciliation mirror.';
comment on table public.consultation_leads is
  'Service-role-only consultation opportunities containing contact details supplied with explicit consent.';
comment on table public.consultation_requests is
  'Service-role-only snapshots of distinct consented requests; retryable contact details may refresh only before successful delivery and outside an active notification lease.';
comment on table public.consultation_lead_history is
  'Append-only operational stage history; shared admin auth cannot identify a named human actor.';

create or replace function public.ingest_growth_funnel_events(
  p_session_key text,
  p_session_started_at timestamptz,
  p_events jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_session public.growth_funnel_sessions%rowtype;
  v_event jsonb;
  v_inserted_id uuid;
  v_existing public.growth_funnel_events%rowtype;
  v_event_id text;
  v_event_name text;
  v_sequence integer;
  v_occurred_at timestamptz;
  v_path text;
  v_page text;
  v_stage text;
  v_client_stage text;
  v_quiz_question smallint;
  v_quiz_position smallint;
  v_quiz_attempt_key text;
  v_quiz_intent text;
  v_funnel_step smallint;
  v_cta text;
  v_therapist text;
  v_reference text;
  v_device text;
  v_utm_source text;
  v_utm_medium text;
  v_utm_campaign text;
  v_utm_content text;
  v_referrer text;
  v_quiz_version text;
  v_elapsed integer;
  v_finder_used boolean;
  v_funnel_completed boolean;
  v_accepted integer := 0;
begin
  if p_session_key is null or p_session_key !~ '^fs-[A-Za-z0-9-]{16,90}$' then
    raise exception using errcode = '22023', message = 'Invalid funnel session identifier.';
  end if;
  if p_session_started_at is null or
     p_session_started_at < statement_timestamp() - interval '7 days' or
     p_session_started_at > statement_timestamp() + interval '10 minutes' then
    raise exception using errcode = '22023', message = 'Invalid funnel session timestamp.';
  end if;
  if p_events is null or jsonb_typeof(p_events) <> 'array' or
     jsonb_array_length(p_events) not between 1 and 20 then
    raise exception using errcode = '22023', message = 'Invalid funnel event batch.';
  end if;

  insert into public.growth_funnel_sessions (
    session_key, started_at, last_seen_at
  ) values (
    p_session_key, p_session_started_at, p_session_started_at
  )
  on conflict (session_key) do update
  set started_at = least(public.growth_funnel_sessions.started_at, excluded.started_at),
      updated_at = transaction_timestamp()
  returning * into v_session;

  for v_event in
    select item.value
    from jsonb_array_elements(p_events) as item(value)
    order by (item.value ->> 'sequence')::integer
  loop
    v_event_id := nullif(btrim(v_event ->> 'eventId'), '');
    v_event_name := nullif(btrim(v_event ->> 'event'), '');
    v_sequence := (v_event ->> 'sequence')::integer;
    v_occurred_at := (v_event ->> 'occurredAt')::timestamptz;
    v_path := nullif(btrim(v_event ->> 'path'), '');
    v_page := nullif(btrim(v_event ->> 'page'), '');
    v_client_stage := nullif(btrim(v_event ->> 'stage'), '');
    v_quiz_attempt_key := nullif(btrim(v_event ->> 'quizAttemptId'), '');
    v_quiz_intent := nullif(btrim(v_event ->> 'quizIntent'), '');
    v_cta := nullif(btrim(v_event ->> 'ctaPlacement'), '');
    v_therapist := nullif(btrim(v_event ->> 'therapistId'), '');
    v_reference := nullif(btrim(v_event ->> 'submissionReference'), '');
    v_device := nullif(btrim(v_event ->> 'deviceCategory'), '');
    v_utm_source := nullif(btrim(v_event ->> 'utmSource'), '');
    v_utm_medium := nullif(btrim(v_event ->> 'utmMedium'), '');
    v_utm_campaign := nullif(btrim(v_event ->> 'utmCampaign'), '');
    v_utm_content := nullif(btrim(v_event ->> 'utmContent'), '');
    v_referrer := nullif(btrim(v_event ->> 'referrerHost'), '');
    v_quiz_version := nullif(btrim(v_event ->> 'quizVersion'), '');
    v_elapsed := (v_event ->> 'elapsedMs')::integer;
    v_finder_used := case
      when v_event ? 'finderUsed' then (v_event ->> 'finderUsed')::boolean
      else null
    end;
    v_funnel_completed := case
      when v_event ? 'funnelCompleted' then (v_event ->> 'funnelCompleted')::boolean
      else null
    end;
    v_quiz_question := case
      when v_event_name in ('quiz_question_viewed', 'quiz_question_answered')
        then ((v_event ->> 'quizStep')::integer + 1)::smallint
      else null
    end;
    v_quiz_position := case
      when v_event ? 'quizStep'
        then ((v_event ->> 'quizStep')::integer + 1)::smallint
      else null
    end;
    v_funnel_step := case
      when v_event ? 'funnelStep' then (v_event ->> 'funnelStep')::smallint
      else null
    end;

    if v_event_id is null or v_event_id !~ '^fe-[A-Za-z0-9-]{16,90}$' or
       v_sequence not between 1 and 1000000 or
       v_occurred_at < p_session_started_at - interval '5 minutes' or
       v_occurred_at > statement_timestamp() + interval '10 minutes' or
       v_path is null or v_path not in (
         '/', '/about', '/anxiety-therapy-ottawa', '/book-consultation',
         '/consultation', '/depression-therapy-ottawa', '/faq',
         '/faq/am-i-burnt-out', '/faq/am-i-depressed',
         '/faq/does-insurance-cover-therapy', '/faq/dont-know-what-i-need',
         '/faq/do-i-have-anxiety', '/faq/first-therapy-session',
         '/faq/how-long-therapy', '/faq/how-often-therapy', '/faq/how-to-book',
         '/faq/how-to-find-therapist', '/faq/is-my-grief-normal',
         '/faq/languages-offered', '/faq/rp-vs-rsw',
         '/faq/stress-vs-anxiety', '/faq/tax-deductible-therapy',
         '/faq/therapy-approaches', '/faq/therapy-cost-ottawa',
         '/faq/therapist-credentials', '/faq/trauma-signs',
         '/faq/what-is-valisen', '/faq/which-plans-cover-rps', '/get-matched',
         '/grief-counselling-ottawa', '/insurance', '/intake',
         '/life-transitions-therapy-ottawa', '/privacy-policy', '/quiz',
         '/relationship-counselling-ottawa', '/resources',
         '/resources/five-signs-of-perfectionism',
         '/self-esteem-therapy-ottawa', '/services', '/sitewide',
         '/stress-therapy-ottawa', '/terms', '/therapists',
         '/therapists/dayong-quan', '/therapists/meryem-ibrahim',
         '/therapists/ryann-simpson', '/therapists/tim-kahtava',
         '/therapists/wilfred-bengnwi', '/therapists/profile',
         '/trauma-therapy-ottawa'
       ) or
       (v_page is not null and char_length(v_page) > 40) or
       (v_client_stage is not null and (
         char_length(v_client_stage) > 80 or
         v_client_stage !~ '^[a-z0-9_-]+$'
       )) or
       (v_quiz_attempt_key is not null and
         v_quiz_attempt_key !~ '^qa-[A-Za-z0-9-]{16,90}$') or
       (v_quiz_intent is not null and v_quiz_intent not in (
         'ready_to_speak', 'brief_consultation',
         'see_recommended_therapist', 'exploring'
       )) or
       (v_event_name = 'quiz_intent_selected' and
         (v_quiz_intent is null or v_quiz_attempt_key is null)) or
       (v_event_name <> 'quiz_intent_selected' and v_quiz_intent is not null) or
       (v_quiz_position is not null and v_quiz_position not between 1 and 19) or
       (v_cta is not null and (char_length(v_cta) > 50 or v_cta !~ '^[a-z0-9_-]+$')) or
       (v_therapist is not null and (char_length(v_therapist) > 80 or v_therapist !~ '^[a-z0-9-]+$')) or
       (v_reference is not null and
         v_reference !~ '^(VC-[A-Za-z0-9_-]{6,36}|VQ-[A-Za-z0-9_-]{4,36})$') or
       (v_utm_source is not null and char_length(v_utm_source) > 120) or
       (v_utm_medium is not null and char_length(v_utm_medium) > 120) or
       (v_utm_campaign is not null and char_length(v_utm_campaign) > 120) or
       (v_utm_content is not null and char_length(v_utm_content) > 120) or
       (v_referrer is not null and char_length(v_referrer) > 120) or
       (v_quiz_version is not null and char_length(v_quiz_version) > 40) or
       v_elapsed not between 0 and 604800000 then
      raise exception using errcode = '22023', message = 'Invalid funnel event.';
    end if;

    v_stage := case
      when v_event_name = 'quiz_question_viewed'
        then 'quiz_question_' || v_quiz_question::text || '_viewed'
      when v_event_name = 'quiz_question_answered'
        then 'quiz_question_' || v_quiz_question::text || '_answered'
      when v_event_name like 'consultation_%' and v_funnel_step is not null
        then 'consultation_step_' || v_funnel_step::text
      when v_event_name = 'session_exit'
        then coalesce(v_client_stage, v_session.last_stage)
      else v_event_name
    end;

    if v_event_name in ('quiz_question_viewed', 'quiz_question_answered') and
       v_quiz_attempt_key is null then
      raise exception using errcode = '22023', message = 'Quiz question events require an attempt identifier.';
    end if;

    if v_quiz_attempt_key is not null then
      insert into public.growth_quiz_attempts (
        attempt_key, session_id, started_at, last_seen_at,
        last_quiz_question, quiz_version
      ) values (
        v_quiz_attempt_key, v_session.id, v_occurred_at, v_occurred_at,
        coalesce(v_quiz_position, 0), v_quiz_version
      )
      on conflict (attempt_key) do update
      set started_at = least(public.growth_quiz_attempts.started_at, excluded.started_at),
          quiz_version = coalesce(public.growth_quiz_attempts.quiz_version, excluded.quiz_version),
          updated_at = transaction_timestamp();

      if not exists (
        select 1 from public.growth_quiz_attempts as attempt
        where attempt.attempt_key = v_quiz_attempt_key
          and attempt.session_id = v_session.id
      ) then
        raise exception using errcode = '22023', message = 'Quiz attempt identifier collision.';
      end if;
    end if;

    v_inserted_id := null;
    insert into public.growth_funnel_events (
      session_id, client_event_id, sequence, occurred_at, event_name,
      path, page, stage, quiz_question, quiz_attempt_key, funnel_step, cta_placement,
      quiz_intent, therapist_id, submission_reference, finder_used, funnel_completed,
      elapsed_ms
    ) values (
      v_session.id, v_event_id, v_sequence, v_occurred_at, v_event_name,
      v_path, v_page, v_stage, v_quiz_question, v_quiz_attempt_key, v_funnel_step, v_cta,
      v_quiz_intent, v_therapist, v_reference, v_finder_used, v_funnel_completed,
      v_elapsed
    )
    on conflict do nothing
    returning id into v_inserted_id;

    if v_inserted_id is null then
      select event.* into v_existing
      from public.growth_funnel_events as event
      where event.client_event_id = v_event_id
         or (event.session_id = v_session.id and event.sequence = v_sequence)
      limit 1;
      if found and (
        v_existing.session_id is distinct from v_session.id or
        v_existing.client_event_id is distinct from v_event_id or
        v_existing.sequence is distinct from v_sequence or
        v_existing.occurred_at is distinct from v_occurred_at or
        v_existing.event_name is distinct from v_event_name or
        v_existing.path is distinct from v_path or
        v_existing.page is distinct from v_page or
        v_existing.stage is distinct from v_stage or
        v_existing.quiz_question is distinct from v_quiz_question or
        v_existing.quiz_attempt_key is distinct from v_quiz_attempt_key or
        v_existing.quiz_intent is distinct from v_quiz_intent or
        v_existing.funnel_step is distinct from v_funnel_step or
        v_existing.cta_placement is distinct from v_cta or
        v_existing.therapist_id is distinct from v_therapist or
        v_existing.submission_reference is distinct from v_reference or
        v_existing.finder_used is distinct from v_finder_used or
        v_existing.funnel_completed is distinct from v_funnel_completed or
        v_existing.elapsed_ms is distinct from v_elapsed
      ) then
        raise exception using errcode = '22023', message = 'Funnel event identifier collision.';
      end if;
      continue;
    end if;

    v_accepted := v_accepted + 1;
    update public.growth_funnel_sessions as session
    set
      last_seen_at = greatest(session.last_seen_at, v_occurred_at),
      last_event_name = case when v_sequence > session.last_sequence then v_event_name else session.last_event_name end,
      last_path = case when v_sequence > session.last_sequence then v_path else session.last_path end,
      last_page = case when v_sequence > session.last_sequence then coalesce(v_page, session.last_page) else session.last_page end,
      last_stage = case when v_sequence > session.last_sequence then v_stage else session.last_stage end,
      max_quiz_question = greatest(session.max_quiz_question, coalesce(v_quiz_question, 0)),
      quiz_version = coalesce(session.quiz_version, v_quiz_version),
      quiz_started = session.quiz_started or v_event_name = 'quiz_started',
      quiz_completed = session.quiz_completed or v_event_name = 'quiz_completed',
      results_access_viewed = session.results_access_viewed or v_event_name = 'quiz_access_form_viewed',
      quiz_lead_submitted = session.quiz_lead_submitted or v_event_name = 'lead_details_submitted',
      results_viewed = session.results_viewed or v_event_name = 'results_viewed',
      therapist_match_viewed = session.therapist_match_viewed or v_event_name = 'therapist_match_viewed',
      -- Keep the primary booking-intent signal exact. Opening the optional
      -- "contact me" dialog is useful engagement, but it is not a click on
      -- the consultation request CTA and must not inflate this counter.
      consultation_click_count = session.consultation_click_count +
        case when v_event_name = 'consultation_request_clicked' then 1 else 0 end,
      consultation_page_viewed = session.consultation_page_viewed or v_event_name = 'consultation_page_viewed',
      consultation_max_step = greatest(
        session.consultation_max_step,
        case when v_event_name like 'consultation_%' then coalesce(v_funnel_step, 0) else 0 end
      ),
      consultation_submitted = session.consultation_submitted or v_event_name = 'consultation_request_submitted',
      jane_click_count = session.jane_click_count + case when v_event_name in (
        'jane_booking_clicked', 'consultation_jane_secondary_clicked',
        'directory_jane_clicked', 'therapist_recommendation_jane_clicked',
        'recommendation_jane_clicked'
      ) then 1 else 0 end,
      explicit_exit = case
        when v_sequence > session.last_sequence then v_event_name = 'session_exit'
        else session.explicit_exit
      end,
      last_cta_placement = case when v_sequence > session.last_sequence then coalesce(v_cta, session.last_cta_placement) else session.last_cta_placement end,
      therapist_id = coalesce(session.therapist_id, v_therapist),
      submission_reference = coalesce(v_reference, session.submission_reference),
      device_category = coalesce(session.device_category, v_device),
      utm_source = coalesce(session.utm_source, v_utm_source),
      utm_medium = coalesce(session.utm_medium, v_utm_medium),
      utm_campaign = coalesce(session.utm_campaign, v_utm_campaign),
      utm_content = coalesce(session.utm_content, v_utm_content),
      referrer_host = coalesce(session.referrer_host, v_referrer),
      event_count = session.event_count + 1,
      last_sequence = greatest(session.last_sequence, v_sequence),
      updated_at = transaction_timestamp()
    where session.id = v_session.id
    returning * into v_session;

    if v_quiz_attempt_key is not null then
      update public.growth_quiz_attempts as attempt
      set
        last_seen_at = greatest(attempt.last_seen_at, v_occurred_at),
        last_stage = case when v_sequence > attempt.last_sequence then v_stage else attempt.last_stage end,
        max_quiz_question = greatest(attempt.max_quiz_question, coalesce(v_quiz_question, 0)),
        last_quiz_question = case
          when v_sequence > attempt.last_sequence
            then coalesce(v_quiz_position, attempt.last_quiz_question)
          else attempt.last_quiz_question
        end,
        quiz_started = attempt.quiz_started or v_event_name = 'quiz_started',
        quiz_completed = attempt.quiz_completed or v_event_name = 'quiz_completed',
        explicit_exit = case
          when v_sequence > attempt.last_sequence then v_event_name = 'session_exit'
          else attempt.explicit_exit
        end,
        quiz_version = coalesce(attempt.quiz_version, v_quiz_version),
        last_sequence = greatest(attempt.last_sequence, v_sequence),
        updated_at = transaction_timestamp()
      where attempt.attempt_key = v_quiz_attempt_key;
    end if;
  end loop;

  return jsonb_build_object(
    'accepted', true,
    'acceptedEvents', v_accepted,
    'sessionId', v_session.id,
    'sessionKey', v_session.session_key
  );
exception
  when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow then
    raise exception using errcode = '22023', message = 'Invalid funnel event value.';
end;
$$;

create or replace function public.record_quiz_lead_link(
  p_reference_id text,
  p_funnel_session_key text,
  p_quiz_attempt_key text,
  p_quiz_version text,
  p_scoring_version text,
  p_intent text,
  p_recommended_therapist text,
  p_consented_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_link public.quiz_lead_links%rowtype;
  v_existing_link public.quiz_lead_links%rowtype;
begin
  if p_reference_id is null or p_reference_id !~ '^VQ-[A-Za-z0-9_-]{4,80}$' or
     (p_funnel_session_key is not null and p_funnel_session_key !~ '^fs-[A-Za-z0-9-]{16,90}$') or
     (p_quiz_attempt_key is not null and p_quiz_attempt_key !~ '^qa-[A-Za-z0-9-]{16,90}$') or
     p_quiz_version is null or char_length(btrim(p_quiz_version)) not between 1 and 40 or
     p_scoring_version is null or char_length(btrim(p_scoring_version)) not between 1 and 40 or
     (p_intent is not null and p_intent not in (
       'exploring', 'see_recommended_therapist', 'brief_consultation',
       'ready_to_speak'
     )) or
     (p_recommended_therapist is not null and p_recommended_therapist !~ '^[a-z0-9-]{2,80}$') or
     p_consented_at is null or p_consented_at > statement_timestamp() + interval '10 minutes' then
    raise exception using errcode = '22023', message = 'Invalid quiz lead attribution.';
  end if;
  if p_quiz_attempt_key is not null and p_funnel_session_key is null then
    raise exception using errcode = '22023', message = 'A quiz attempt requires its funnel session.';
  end if;
  if p_funnel_session_key is not null and not exists (
    select 1 from public.growth_funnel_sessions as session
    where session.session_key = p_funnel_session_key
  ) then
    raise exception using errcode = '22023', message = 'Quiz funnel session not found.';
  end if;
  if p_quiz_attempt_key is not null and
     not exists (
       select 1
       from public.growth_quiz_attempts as attempt
       join public.growth_funnel_sessions as session on session.id = attempt.session_id
       where attempt.attempt_key = p_quiz_attempt_key
         and session.session_key = p_funnel_session_key
     ) then
    raise exception using errcode = '22023', message = 'Quiz attempt does not belong to the funnel session.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('quiz-lead-link:' || p_reference_id, 0)
  );
  select link.* into v_existing_link
  from public.quiz_lead_links as link
  where link.reference_id = p_reference_id
  for update;
  if found and (
    (v_existing_link.funnel_session_key is not null and p_funnel_session_key is not null and
      v_existing_link.funnel_session_key <> p_funnel_session_key) or
    (v_existing_link.quiz_attempt_key is not null and p_quiz_attempt_key is not null and
      v_existing_link.quiz_attempt_key <> p_quiz_attempt_key) or
    v_existing_link.quiz_version <> btrim(p_quiz_version) or
    v_existing_link.scoring_version <> btrim(p_scoring_version) or
    (v_existing_link.intent is not null and p_intent is not null and
      v_existing_link.intent <> p_intent) or
    (v_existing_link.recommended_therapist is not null and p_recommended_therapist is not null and
      v_existing_link.recommended_therapist <> p_recommended_therapist)
  ) then
    raise exception using errcode = '23505', message = 'Quiz lead attribution is already linked differently.';
  end if;

  insert into public.quiz_lead_links (
    reference_id, funnel_session_key, quiz_attempt_key, quiz_version, scoring_version,
    intent, recommended_therapist, consented_at
  ) values (
    p_reference_id, p_funnel_session_key, p_quiz_attempt_key, btrim(p_quiz_version),
    btrim(p_scoring_version), p_intent, p_recommended_therapist, p_consented_at
  )
  on conflict (reference_id) do update
  set funnel_session_key = coalesce(public.quiz_lead_links.funnel_session_key, excluded.funnel_session_key),
      quiz_attempt_key = coalesce(public.quiz_lead_links.quiz_attempt_key, excluded.quiz_attempt_key),
      intent = coalesce(public.quiz_lead_links.intent, excluded.intent),
      recommended_therapist = coalesce(public.quiz_lead_links.recommended_therapist, excluded.recommended_therapist),
      updated_at = transaction_timestamp()
  returning * into v_link;

  return jsonb_build_object(
    'accepted', true,
    'referenceId', v_link.reference_id,
    'sessionKey', v_link.funnel_session_key
  );
end;
$$;

create or replace function public.claim_quiz_result_submission(
  p_client_submission_id text,
  p_payload_hash text,
  p_existing_reference_id text,
  p_lease_seconds integer default 300
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_submission public.quiz_result_submissions%rowtype;
  v_reference text;
  v_existing_reference text := nullif(btrim(p_existing_reference_id), '');
  v_claim_token uuid;
  v_retry_after integer := 0;
  v_now timestamptz := statement_timestamp();
begin
  if p_client_submission_id is null or
     p_client_submission_id !~ '^[A-Za-z0-9-]{8,64}$' or
     p_payload_hash is null or p_payload_hash !~ '^[a-f0-9]{64}$' or
     (v_existing_reference is not null and
       v_existing_reference !~ '^VQ-[A-Za-z0-9_-]{4,80}$') or
     p_lease_seconds is null or p_lease_seconds < 30 or p_lease_seconds > 900 then
    raise exception using errcode = '22023', message = 'Invalid quiz result storage claim.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'quiz-result-submission:' || p_client_submission_id,
      0
    )
  );

  select submission.* into v_submission
  from public.quiz_result_submissions as submission
  where submission.client_submission_id = p_client_submission_id
  for update;

  if found then
    if v_submission.payload_hash <> p_payload_hash or
       (v_existing_reference is not null and
         v_submission.reference_id <> v_existing_reference) then
      raise exception using
        errcode = '23505',
        message = 'Quiz submission identifier was reused with different result data.';
    end if;

    if v_submission.sheet_status = 'ready' then
      return jsonb_build_object(
        'accepted', true,
        'claimed', false,
        'reason', 'already_ready',
        'clientSubmissionId', v_submission.client_submission_id,
        'referenceId', v_submission.reference_id,
        'storageStatus', v_submission.sheet_status,
        'sheetRowNumber', v_submission.sheet_row_number,
        'attemptCount', v_submission.storage_attempt_count,
        'retryAfterSeconds', 0
      );
    end if;

    if v_submission.storage_claim_token is not null and
       v_submission.storage_claim_expires_at > v_now then
      v_retry_after := greatest(
        1,
        ceil(extract(epoch from (
          v_submission.storage_claim_expires_at - v_now
        )))::integer
      );
      return jsonb_build_object(
        'accepted', true,
        'claimed', false,
        'reason', 'lease_active',
        'clientSubmissionId', v_submission.client_submission_id,
        'referenceId', v_submission.reference_id,
        'storageStatus', v_submission.sheet_status,
        'leaseExpiresAt', v_submission.storage_claim_expires_at,
        'attemptCount', v_submission.storage_attempt_count,
        'retryAfterSeconds', v_retry_after
      );
    end if;

    v_claim_token := extensions.gen_random_uuid();
    update public.quiz_result_submissions as submission
    set sheet_status = 'pending',
        sheet_row_number = null,
        storage_claim_token = v_claim_token,
        storage_claimed_at = v_now,
        storage_claim_expires_at = v_now + p_lease_seconds * interval '1 second',
        storage_attempt_count = case
          when submission.storage_attempt_count < 2147483647
            then submission.storage_attempt_count + 1
          else submission.storage_attempt_count
        end,
        updated_at = transaction_timestamp()
    where submission.id = v_submission.id
    returning * into v_submission;
  else
    v_claim_token := extensions.gen_random_uuid();
    if v_existing_reference is not null then
      v_reference := v_existing_reference;
      insert into public.quiz_result_submissions (
        client_submission_id, reference_id, payload_hash,
        storage_claim_token, storage_claimed_at,
        storage_claim_expires_at, storage_attempt_count
      ) values (
        p_client_submission_id, v_reference, p_payload_hash,
        v_claim_token, v_now,
        v_now + p_lease_seconds * interval '1 second', 1
      )
      returning * into v_submission;
    else
      loop
        v_reference := 'VQ-' || upper(substr(
          replace(extensions.gen_random_uuid()::text, '-', ''),
          1,
          12
        ));
        begin
          insert into public.quiz_result_submissions (
            client_submission_id, reference_id, payload_hash,
            storage_claim_token, storage_claimed_at,
            storage_claim_expires_at, storage_attempt_count
          ) values (
            p_client_submission_id, v_reference, p_payload_hash,
            v_claim_token, v_now,
            v_now + p_lease_seconds * interval '1 second', 1
          )
          returning * into v_submission;
          exit;
        exception
          when unique_violation then
            -- A generated 48-bit display reference can collide at very large
            -- volume. The client-submission advisory lock rules out a local
            -- identity race, so generate another display reference safely.
            null;
        end;
      end loop;
    end if;
  end if;

  return jsonb_build_object(
    'accepted', true,
    'claimed', true,
    'reason', 'claimed',
    'clientSubmissionId', v_submission.client_submission_id,
    'referenceId', v_submission.reference_id,
    'storageStatus', v_submission.sheet_status,
    'claimToken', v_submission.storage_claim_token,
    'leaseExpiresAt', v_submission.storage_claim_expires_at,
    'attemptCount', v_submission.storage_attempt_count,
    'retryAfterSeconds', 0
  );
end;
$$;

create or replace function public.complete_quiz_result_submission_storage(
  p_client_submission_id text,
  p_claim_token uuid,
  p_storage_status text,
  p_sheet_row_number integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_submission public.quiz_result_submissions%rowtype;
begin
  if p_client_submission_id is null or
     p_client_submission_id !~ '^[A-Za-z0-9-]{8,64}$' or
     p_claim_token is null or
     p_storage_status not in ('ready', 'failed') or
     (p_storage_status = 'ready' and
       (p_sheet_row_number is null or p_sheet_row_number < 2)) or
     (p_storage_status = 'failed' and p_sheet_row_number is not null) then
    raise exception using errcode = '22023', message = 'Invalid quiz result storage completion.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'quiz-result-submission:' || p_client_submission_id,
      0
    )
  );

  select submission.* into v_submission
  from public.quiz_result_submissions as submission
  where submission.client_submission_id = p_client_submission_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Quiz result submission not found.';
  end if;

  if v_submission.storage_claim_token is distinct from p_claim_token then
    return jsonb_build_object(
      'accepted', false,
      'staleClaim', true,
      'clientSubmissionId', v_submission.client_submission_id,
      'referenceId', v_submission.reference_id,
      'storageStatus', v_submission.sheet_status,
      'attemptCount', v_submission.storage_attempt_count
    );
  end if;

  update public.quiz_result_submissions as submission
  set sheet_status = p_storage_status,
      sheet_row_number = case
        when p_storage_status = 'ready' then p_sheet_row_number
        else null
      end,
      storage_claim_token = null,
      storage_claimed_at = null,
      storage_claim_expires_at = null,
      updated_at = transaction_timestamp()
  where submission.id = v_submission.id
  returning * into v_submission;

  return jsonb_build_object(
    'accepted', true,
    'staleClaim', false,
    'clientSubmissionId', v_submission.client_submission_id,
    'referenceId', v_submission.reference_id,
    'storageStatus', v_submission.sheet_status,
    'sheetRowNumber', v_submission.sheet_row_number,
    'attemptCount', v_submission.storage_attempt_count
  );
end;
$$;

create or replace function public.claim_quiz_result_email_delivery(
  p_reference_id text,
  p_delivery_kind text,
  p_known_sent boolean default false,
  p_lease_seconds integer default 300
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_submission public.quiz_result_submissions%rowtype;
  v_delivery public.quiz_result_email_deliveries%rowtype;
  v_claim_token uuid;
  v_retry_after integer := 0;
  v_now timestamptz := statement_timestamp();
begin
  if p_reference_id is null or
     p_reference_id !~ '^VQ-[A-Za-z0-9_-]{4,80}$' or
     p_delivery_kind not in ('internal_results', 'visitor_results') or
     p_known_sent is null or
     p_lease_seconds is null or p_lease_seconds < 30 or p_lease_seconds > 900 then
    raise exception using errcode = '22023', message = 'Invalid quiz result email claim.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'quiz-result-email:' || p_reference_id || ':' || p_delivery_kind,
      0
    )
  );

  select submission.* into v_submission
  from public.quiz_result_submissions as submission
  where submission.reference_id = p_reference_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Quiz result submission not found.';
  end if;

  insert into public.quiz_result_email_deliveries (
    submission_id, delivery_kind, delivery_status, sent_at
  ) values (
    v_submission.id,
    p_delivery_kind,
    case when p_known_sent then 'sent' else 'pending' end,
    case when p_known_sent then v_now else null end
  )
  on conflict (submission_id, delivery_kind) do nothing;

  select delivery.* into strict v_delivery
  from public.quiz_result_email_deliveries as delivery
  where delivery.submission_id = v_submission.id
    and delivery.delivery_kind = p_delivery_kind
  for update;

  if p_known_sent and v_delivery.delivery_status <> 'sent' then
    update public.quiz_result_email_deliveries as delivery
    set delivery_status = 'sent',
        claim_token = null,
        claimed_at = null,
        claim_expires_at = null,
        sent_at = coalesce(delivery.sent_at, v_now),
        updated_at = transaction_timestamp()
    where delivery.submission_id = v_submission.id
      and delivery.delivery_kind = p_delivery_kind
    returning * into v_delivery;
  end if;

  if v_delivery.delivery_status = 'sent' then
    return jsonb_build_object(
      'accepted', true,
      'claimed', false,
      'reason', 'already_sent',
      'alreadySent', true,
      'referenceId', v_submission.reference_id,
      'deliveryKind', v_delivery.delivery_kind,
      'deliveryStatus', v_delivery.delivery_status,
      'attemptCount', v_delivery.attempt_count,
      'retryAfterSeconds', 0
    );
  end if;

  if v_delivery.claim_token is not null and v_delivery.claim_expires_at > v_now then
    v_retry_after := greatest(
      1,
      ceil(extract(epoch from (v_delivery.claim_expires_at - v_now)))::integer
    );
    return jsonb_build_object(
      'accepted', true,
      'claimed', false,
      'reason', 'lease_active',
      'alreadySent', false,
      'referenceId', v_submission.reference_id,
      'deliveryKind', v_delivery.delivery_kind,
      'deliveryStatus', v_delivery.delivery_status,
      'leaseExpiresAt', v_delivery.claim_expires_at,
      'attemptCount', v_delivery.attempt_count,
      'retryAfterSeconds', v_retry_after
    );
  end if;

  v_claim_token := extensions.gen_random_uuid();
  update public.quiz_result_email_deliveries as delivery
  set delivery_status = 'pending',
      claim_token = v_claim_token,
      claimed_at = v_now,
      claim_expires_at = v_now + p_lease_seconds * interval '1 second',
      attempt_count = case
        when delivery.attempt_count < 2147483647
          then delivery.attempt_count + 1
        else delivery.attempt_count
      end,
      sent_at = null,
      updated_at = transaction_timestamp()
  where delivery.submission_id = v_submission.id
    and delivery.delivery_kind = p_delivery_kind
  returning * into v_delivery;

  return jsonb_build_object(
    'accepted', true,
    'claimed', true,
    'reason', 'claimed',
    'alreadySent', false,
    'referenceId', v_submission.reference_id,
    'deliveryKind', v_delivery.delivery_kind,
    'deliveryStatus', v_delivery.delivery_status,
    'claimToken', v_delivery.claim_token,
    'leaseExpiresAt', v_delivery.claim_expires_at,
    'attemptCount', v_delivery.attempt_count,
    'retryAfterSeconds', 0
  );
end;
$$;

create or replace function public.complete_quiz_result_email_delivery(
  p_reference_id text,
  p_delivery_kind text,
  p_claim_token uuid,
  p_delivery_status text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_submission public.quiz_result_submissions%rowtype;
  v_delivery public.quiz_result_email_deliveries%rowtype;
begin
  if p_reference_id is null or
     p_reference_id !~ '^VQ-[A-Za-z0-9_-]{4,80}$' or
     p_delivery_kind not in ('internal_results', 'visitor_results') or
     p_claim_token is null or
     p_delivery_status not in ('sent', 'failed') then
    raise exception using errcode = '22023', message = 'Invalid quiz result email completion.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'quiz-result-email:' || p_reference_id || ':' || p_delivery_kind,
      0
    )
  );

  select submission.* into v_submission
  from public.quiz_result_submissions as submission
  where submission.reference_id = p_reference_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Quiz result submission not found.';
  end if;

  select delivery.* into v_delivery
  from public.quiz_result_email_deliveries as delivery
  where delivery.submission_id = v_submission.id
    and delivery.delivery_kind = p_delivery_kind
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Quiz result email delivery not found.';
  end if;

  if v_delivery.claim_token is distinct from p_claim_token then
    return jsonb_build_object(
      'accepted', false,
      'staleClaim', true,
      'referenceId', v_submission.reference_id,
      'deliveryKind', v_delivery.delivery_kind,
      'deliveryStatus', v_delivery.delivery_status,
      'attemptCount', v_delivery.attempt_count
    );
  end if;

  update public.quiz_result_email_deliveries as delivery
  set delivery_status = p_delivery_status,
      claim_token = null,
      claimed_at = null,
      claim_expires_at = null,
      sent_at = case
        when p_delivery_status = 'sent' then transaction_timestamp()
        else null
      end,
      updated_at = transaction_timestamp()
  where delivery.submission_id = v_submission.id
    and delivery.delivery_kind = p_delivery_kind
  returning * into v_delivery;

  return jsonb_build_object(
    'accepted', true,
    'staleClaim', false,
    'referenceId', v_submission.reference_id,
    'deliveryKind', v_delivery.delivery_kind,
    'deliveryStatus', v_delivery.delivery_status,
    'attemptCount', v_delivery.attempt_count,
    'sentAt', v_delivery.sent_at
  );
end;
$$;

create or replace function public.upsert_consultation_lead(
  p_consultation_reference_id text,
  p_quiz_reference_id text,
  p_client_submission_id text,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_therapy_type text,
  p_preferred_therapist text,
  p_preferred_days text,
  p_preferred_time text,
  p_coordination_details text,
  p_consent_text text,
  p_consent_version text,
  p_consented_at timestamptz,
  p_source_kind text,
  p_source_detail text,
  p_checkpoint_code text,
  p_checkpoint_placement_id uuid,
  p_checkpoint_session_key text,
  p_funnel_session_key text,
  p_utm_source text,
  p_utm_medium text,
  p_utm_campaign text,
  p_utm_content text,
  p_referrer_host text,
  p_notification_status text,
  p_submitted_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_lead public.consultation_leads%rowtype;
  v_request public.consultation_requests%rowtype;
  v_is_new boolean := false;
  v_reference text := nullif(btrim(p_consultation_reference_id), '');
  v_quiz_reference text := nullif(btrim(p_quiz_reference_id), '');
  v_client_submission text := nullif(btrim(p_client_submission_id), '');
  v_first_name text := nullif(btrim(p_first_name), '');
  v_last_name text := nullif(btrim(p_last_name), '');
  v_email text := nullif(lower(btrim(p_email)), '');
  v_phone text := nullif(btrim(p_phone), '');
  v_funnel_session text := nullif(btrim(p_funnel_session_key), '');
  v_request_reference text := coalesce(
    nullif(btrim(p_consultation_reference_id), ''),
    nullif(btrim(p_quiz_reference_id), '')
  );
  v_request_kind text := case
    when nullif(btrim(p_consultation_reference_id), '') is null
      then 'quiz_contact_help'
    else 'consultation_form'
  end;
  v_therapy_type text := nullif(btrim(p_therapy_type), '');
  v_preferred_therapist text := nullif(btrim(p_preferred_therapist), '');
  v_preferred_days text := nullif(btrim(p_preferred_days), '');
  v_preferred_time text := nullif(btrim(p_preferred_time), '');
  v_coordination_details text := nullif(btrim(p_coordination_details), '');
  v_consent_text text := nullif(p_consent_text, '');
  v_consent_version text := nullif(btrim(p_consent_version), '');
  v_source_detail text := nullif(btrim(p_source_detail), '');
  v_checkpoint_code_input text := nullif(btrim(p_checkpoint_code), '');
  v_checkpoint_placement_input uuid := p_checkpoint_placement_id;
  v_checkpoint_session_input text := nullif(btrim(p_checkpoint_session_key), '');
  v_checkpoint_code text := nullif(btrim(p_checkpoint_code), '');
  v_checkpoint_placement_id uuid := p_checkpoint_placement_id;
  v_checkpoint_session_key text := nullif(btrim(p_checkpoint_session_key), '');
  v_verified_checkpoint_code text;
  v_verified_checkpoint_placement_id uuid;
  v_verified_checkpoint_session_key text;
  v_attribution_verified boolean := false;
  v_snapshot_refresh boolean := false;
  v_attribution_refresh boolean := false;
  v_utm_source text := nullif(btrim(p_utm_source), '');
  v_utm_medium text := nullif(btrim(p_utm_medium), '');
  v_utm_campaign text := nullif(btrim(p_utm_campaign), '');
  v_utm_content text := nullif(btrim(p_utm_content), '');
  v_referrer_host text := nullif(btrim(p_referrer_host), '');
  v_now timestamptz := transaction_timestamp();
begin
  if v_reference is null and v_quiz_reference is null then
    raise exception using errcode = '22023', message = 'A consultation or quiz reference is required.';
  end if;
  if (v_reference is not null and v_reference !~ '^[A-Za-z0-9][A-Za-z0-9_-]{5,119}$') or
     (v_quiz_reference is not null and v_quiz_reference !~ '^VQ-[A-Za-z0-9_-]{4,80}$') or
     (v_client_submission is not null and v_client_submission !~ '^[A-Za-z0-9-]{16,80}$') or
     v_first_name is null or char_length(v_first_name) > 80 or
     v_email is null or char_length(v_email) > 254 or
     v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or
     v_phone is null or char_length(v_phone) > 30 or
     v_consent_text is null or char_length(v_consent_text) > 2000 or
     v_consent_version is null or char_length(v_consent_version) > 80 or
     p_source_kind not in (
       'mental_battery_checkpoint', 'quiz', 'direct', 'therapist',
       'possibility_builder', 'website', 'other'
     ) or
     p_notification_status not in ('pending', 'sent', 'failed', 'unknown') or
     p_consented_at is null or p_consented_at > statement_timestamp() + interval '10 minutes' or
     p_submitted_at is null or p_submitted_at > statement_timestamp() + interval '10 minutes' or
     (p_funnel_session_key is not null and p_funnel_session_key !~ '^fs-[A-Za-z0-9-]{16,90}$') or
     (v_checkpoint_session_input is not null and
       v_checkpoint_session_input !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$') or
     (p_source_kind = 'mental_battery_checkpoint' and
       (v_reference is null or v_checkpoint_code_input is null or
        v_checkpoint_code_input !~ '^VMH-(0[1-9]|10)$')) then
    raise exception using errcode = '22023', message = 'Invalid consultation lead.';
  end if;

  if p_source_kind = 'mental_battery_checkpoint' and v_reference is not null then
    select checkpoint.code, attribution.placement_id,
           attribution.anonymous_session_id::text
    into v_verified_checkpoint_code, v_verified_checkpoint_placement_id,
         v_verified_checkpoint_session_key
    from public.consultation_attributions as attribution
    join public.checkpoints as checkpoint on checkpoint.id = attribution.checkpoint_id
    where attribution.consultation_reference_id = v_reference;

    if found then
      if (v_checkpoint_code_input is not null and
            v_checkpoint_code_input <> v_verified_checkpoint_code) or
         (v_checkpoint_placement_input is not null and
            v_checkpoint_placement_input <> v_verified_checkpoint_placement_id) or
         (v_checkpoint_session_input is not null and
            v_checkpoint_session_input <> v_verified_checkpoint_session_key) then
        raise exception using errcode = '22023', message = 'Checkpoint attribution does not match the recorded consultation.';
      end if;
      v_checkpoint_code := v_verified_checkpoint_code;
      v_checkpoint_placement_id := v_verified_checkpoint_placement_id;
      v_checkpoint_session_key := v_verified_checkpoint_session_key;
      v_attribution_verified := true;
    end if;
  elsif p_source_kind = 'quiz' then
    v_attribution_verified := v_quiz_reference is not null and exists (
      select 1 from public.quiz_lead_links as link
      where link.reference_id = v_quiz_reference
    );
  else
    v_attribution_verified := true;
  end if;

  -- Quiz attribution is server-owned. Resolve it before idempotency checks so a
  -- retry that omits the derived session still compares with the same snapshot.
  if v_funnel_session is null and v_quiz_reference is not null then
    select link.funnel_session_key into v_funnel_session
    from public.quiz_lead_links as link
    where link.reference_id = v_quiz_reference;
  end if;
  if v_funnel_session is null and v_quiz_reference is not null then
    select session.session_key into v_funnel_session
    from public.growth_funnel_sessions as session
    where session.submission_reference = v_quiz_reference
    order by session.last_seen_at desc
    limit 1;
  end if;

  -- Serialize retries of the same durable request and concurrent attempts to
  -- create the same logical opportunity before reading either table.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('consultation-request:' || v_request_reference, 0)
  );
  if v_client_submission is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('consultation-lead-client:' || v_client_submission, 0)
    );
  end if;
  if v_quiz_reference is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('consultation-lead-quiz:' || v_quiz_reference, 0)
    );
  end if;

  select request.* into v_request
  from public.consultation_requests as request
  where request.request_reference = v_request_reference
  for update;

  if found then
    select lead.* into strict v_lead
    from public.consultation_leads as lead
    where lead.id = v_request.lead_id
    for update;

    if v_request.request_kind is distinct from v_request_kind or
       v_request.client_submission_id is distinct from v_client_submission or
       v_request.quiz_reference_id is distinct from v_quiz_reference or
       v_request.consent_text is distinct from v_consent_text or
       v_request.consent_version is distinct from v_consent_version or
       v_request.source_kind is distinct from p_source_kind or
       v_request.source_detail is distinct from v_source_detail or
       v_request.funnel_session_key is distinct from v_funnel_session or
       v_request.utm_source is distinct from v_utm_source or
       v_request.utm_medium is distinct from v_utm_medium or
       v_request.utm_campaign is distinct from v_utm_campaign or
       v_request.utm_content is distinct from v_utm_content or
       v_request.referrer_host is distinct from v_referrer_host or
       (
         not v_request.attribution_verified and not v_attribution_verified and
         (
           v_request.checkpoint_code is distinct from v_checkpoint_code_input or
           v_request.checkpoint_placement_id is distinct from v_checkpoint_placement_input or
           v_request.checkpoint_session_key is distinct from v_checkpoint_session_input
         )
       ) or
       (
         v_request.attribution_verified and
         (
           v_request.checkpoint_code is distinct from v_checkpoint_code or
           v_request.checkpoint_placement_id is distinct from v_checkpoint_placement_id or
           v_request.checkpoint_session_key is distinct from v_checkpoint_session_key
         )
       ) then
      raise exception using errcode = '23505', message = 'Request reference was reused with different consultation data.';
    end if;

    v_snapshot_refresh :=
      v_request.first_name is distinct from v_first_name or
      v_request.last_name is distinct from v_last_name or
      lower(v_request.email) is distinct from v_email or
      v_request.phone is distinct from v_phone or
      v_request.therapy_type is distinct from v_therapy_type or
      v_request.preferred_therapist is distinct from v_preferred_therapist or
      v_request.preferred_days is distinct from v_preferred_days or
      v_request.preferred_time is distinct from v_preferred_time or
      v_request.coordination_details is distinct from v_coordination_details;
    v_attribution_refresh :=
      not v_request.attribution_verified and v_attribution_verified;

    if v_snapshot_refresh and (
      v_request.notification_status = 'sent' or
      (
        v_request.notification_claim_token is not null and
        v_request.notification_claim_expires_at > statement_timestamp()
      )
    ) then
      raise exception using
        errcode = '23505',
        message = 'Delivered or actively processing request data cannot be changed.';
    end if;

    if v_snapshot_refresh or v_attribution_refresh then
      update public.consultation_requests as request
      set first_name = case when v_snapshot_refresh then v_first_name else request.first_name end,
          last_name = case when v_snapshot_refresh then v_last_name else request.last_name end,
          email = case when v_snapshot_refresh then v_email else request.email end,
          phone = case when v_snapshot_refresh then v_phone else request.phone end,
          therapy_type = case when v_snapshot_refresh then v_therapy_type else request.therapy_type end,
          preferred_therapist = case when v_snapshot_refresh then v_preferred_therapist else request.preferred_therapist end,
          preferred_days = case when v_snapshot_refresh then v_preferred_days else request.preferred_days end,
          preferred_time = case when v_snapshot_refresh then v_preferred_time else request.preferred_time end,
          coordination_details = case when v_snapshot_refresh then v_coordination_details else request.coordination_details end,
          checkpoint_code = case when v_attribution_refresh then v_checkpoint_code else request.checkpoint_code end,
          checkpoint_placement_id = case when v_attribution_refresh then v_checkpoint_placement_id else request.checkpoint_placement_id end,
          checkpoint_session_key = case when v_attribution_refresh then v_checkpoint_session_key else request.checkpoint_session_key end,
          attribution_verified = request.attribution_verified or v_attribution_refresh
      where request.id = v_request.id
      returning * into v_request;

      update public.consultation_leads as lead
      set first_name = case when v_snapshot_refresh then v_first_name else lead.first_name end,
          last_name = case when v_snapshot_refresh then v_last_name else lead.last_name end,
          email = case when v_snapshot_refresh then v_email else lead.email end,
          phone = case when v_snapshot_refresh then v_phone else lead.phone end,
          therapy_type = case when v_snapshot_refresh then v_therapy_type else lead.therapy_type end,
          preferred_therapist = case when v_snapshot_refresh then v_preferred_therapist else lead.preferred_therapist end,
          preferred_days = case when v_snapshot_refresh then v_preferred_days else lead.preferred_days end,
          preferred_time = case when v_snapshot_refresh then v_preferred_time else lead.preferred_time end,
          coordination_details = case when v_snapshot_refresh then v_coordination_details else lead.coordination_details end,
          checkpoint_code = case when v_attribution_refresh then v_checkpoint_code else lead.checkpoint_code end,
          checkpoint_placement_id = case when v_attribution_refresh then v_checkpoint_placement_id else lead.checkpoint_placement_id end,
          checkpoint_session_key = case when v_attribution_refresh then v_checkpoint_session_key else lead.checkpoint_session_key end,
          attribution_verified = lead.attribution_verified or v_attribution_refresh,
          last_activity_at = v_now,
          row_version = lead.row_version + 1,
          updated_at = v_now
      where lead.id = v_lead.id
      returning * into v_lead;

      insert into public.consultation_lead_history (
        lead_id, event_type, to_workflow_status, to_conversion_stage,
        note, actor_kind
      ) values (
        v_lead.id, 'details_enriched', v_lead.workflow_status,
        v_lead.conversion_stage,
        case
          when v_snapshot_refresh and v_attribution_refresh then
            'Retry details refreshed and request attribution verified for ' || v_request_reference || '.'
          when v_snapshot_refresh then
            'Retry details refreshed before notification delivery for ' || v_request_reference || '.'
          else 'Request attribution verified for ' || v_request_reference || '.'
        end,
        'system'
      );
    end if;

    return jsonb_build_object(
      'accepted', true,
      'created', false,
      'leadId', v_lead.id,
      'referenceId', coalesce(v_lead.consultation_reference_id, v_lead.quiz_reference_id),
      'consultationReferenceId', v_lead.consultation_reference_id,
      'quizReferenceId', v_lead.quiz_reference_id,
      'requestNotificationStatus', v_request.notification_status,
      'attributionVerified', v_request.attribution_verified,
      'rowVersion', v_lead.row_version
    );
  end if;

  select lead.* into v_lead
  from public.consultation_leads as lead
  where (v_reference is not null and lead.consultation_reference_id = v_reference)
     or (v_quiz_reference is not null and lead.quiz_reference_id = v_quiz_reference)
     or (v_client_submission is not null and lead.client_submission_id = v_client_submission)
  order by
    case when lead.consultation_reference_id = v_reference then 0 else 1 end,
    lead.created_at
  limit 1
  for update;

  if not found then
    v_is_new := true;
    insert into public.consultation_leads (
      consultation_reference_id, quiz_reference_id, client_submission_id,
      first_name, last_name, email, phone, therapy_type,
      preferred_therapist, preferred_days, preferred_time,
      coordination_details, consent_text, consent_version, consented_at,
      source_kind, source_detail, checkpoint_code,
      checkpoint_placement_id, checkpoint_session_key, attribution_verified,
      funnel_session_key,
      utm_source, utm_medium, utm_campaign, utm_content, referrer_host,
      notification_status, submitted_at, last_activity_at
    ) values (
      v_reference, v_quiz_reference, v_client_submission,
      v_first_name, v_last_name, v_email, v_phone,
      v_therapy_type, v_preferred_therapist, v_preferred_days,
      v_preferred_time, v_coordination_details, v_consent_text,
      v_consent_version, p_consented_at, p_source_kind, v_source_detail,
      v_checkpoint_code, v_checkpoint_placement_id,
      v_checkpoint_session_key, v_attribution_verified, v_funnel_session,
      v_utm_source, v_utm_medium, v_utm_campaign, v_utm_content,
      v_referrer_host, p_notification_status,
      p_submitted_at, p_submitted_at
    )
    returning * into v_lead;

    insert into public.consultation_lead_history (
      lead_id, event_type, to_workflow_status, to_conversion_stage,
      note, actor_kind
    ) values (
      v_lead.id, 'created', v_lead.workflow_status, v_lead.conversion_stage,
      'Consultation request recorded.', 'system'
    );
  else
    if v_lead.email is not null and lower(v_lead.email) <> v_email then
      raise exception using errcode = '23505', message = 'Consultation reference is already in use.';
    end if;
    if v_lead.quiz_reference_id is not null and v_quiz_reference is not null and
       v_lead.quiz_reference_id <> v_quiz_reference then
      raise exception using errcode = '23505', message = 'Quiz reference is already linked.';
    end if;
    update public.consultation_leads as lead
    set
      consultation_reference_id = coalesce(lead.consultation_reference_id, v_reference),
      quiz_reference_id = coalesce(lead.quiz_reference_id, v_quiz_reference),
      client_submission_id = coalesce(lead.client_submission_id, v_client_submission),
      first_name = coalesce(v_first_name, lead.first_name),
      last_name = coalesce(v_last_name, lead.last_name),
      email = coalesce(v_email, lead.email),
      phone = coalesce(v_phone, lead.phone),
      therapy_type = coalesce(v_therapy_type, lead.therapy_type),
      preferred_therapist = coalesce(v_preferred_therapist, lead.preferred_therapist),
      preferred_days = coalesce(v_preferred_days, lead.preferred_days),
      preferred_time = coalesce(v_preferred_time, lead.preferred_time),
      coordination_details = coalesce(v_coordination_details, lead.coordination_details),
      consent_text = coalesce(v_consent_text, lead.consent_text),
      consent_version = coalesce(v_consent_version, lead.consent_version),
      consented_at = coalesce(lead.consented_at, p_consented_at),
      source_kind = case
        when lead.source_kind = 'mental_battery_checkpoint' or p_source_kind = 'mental_battery_checkpoint'
          then 'mental_battery_checkpoint'
        when lead.source_kind = 'quiz' or p_source_kind = 'quiz' then 'quiz'
        else p_source_kind
      end,
      source_detail = case
        when p_source_kind = 'mental_battery_checkpoint'
          then coalesce(v_source_detail, lead.source_detail)
        else coalesce(lead.source_detail, v_source_detail)
      end,
      checkpoint_code = case when v_attribution_verified
        then v_checkpoint_code else coalesce(lead.checkpoint_code, v_checkpoint_code) end,
      checkpoint_placement_id = case when v_attribution_verified
        then v_checkpoint_placement_id else coalesce(lead.checkpoint_placement_id, v_checkpoint_placement_id) end,
      checkpoint_session_key = case when v_attribution_verified
        then v_checkpoint_session_key else coalesce(lead.checkpoint_session_key, v_checkpoint_session_key) end,
      attribution_verified = case
        when lead.source_kind = 'mental_battery_checkpoint' then
          lead.attribution_verified or
            (p_source_kind = 'mental_battery_checkpoint' and v_attribution_verified)
        when p_source_kind = 'mental_battery_checkpoint' then v_attribution_verified
        when lead.source_kind = 'quiz' then
          lead.attribution_verified or (p_source_kind = 'quiz' and v_attribution_verified)
        when p_source_kind = 'quiz' then v_attribution_verified
        else true
      end,
      funnel_session_key = coalesce(lead.funnel_session_key, v_funnel_session),
      utm_source = coalesce(lead.utm_source, v_utm_source),
      utm_medium = coalesce(lead.utm_medium, v_utm_medium),
      utm_campaign = coalesce(lead.utm_campaign, v_utm_campaign),
      utm_content = coalesce(lead.utm_content, v_utm_content),
      referrer_host = coalesce(lead.referrer_host, v_referrer_host),
      notification_status = case
        when lead.notification_status = 'sent' then 'sent'
        else p_notification_status
      end,
      submitted_at = least(lead.submitted_at, p_submitted_at),
      last_activity_at = greatest(lead.last_activity_at, p_submitted_at),
      row_version = lead.row_version + 1,
      updated_at = v_now
    where lead.id = v_lead.id
    returning * into v_lead;

    insert into public.consultation_lead_history (
      lead_id, event_type, to_workflow_status, to_conversion_stage,
      note, actor_kind
    ) values (
      v_lead.id, 'details_enriched', v_lead.workflow_status,
      v_lead.conversion_stage, 'Consultation details refreshed.', 'system'
    );
  end if;

  -- Preserve one durable row per deliberate submission reference, even when
  -- several requests enrich the same client opportunity. Before delivery and
  -- outside a live lease, a retry may refresh coordination details.
  insert into public.consultation_requests (
    lead_id, request_reference, request_kind, client_submission_id,
    quiz_reference_id, first_name, last_name, email, phone, therapy_type,
    preferred_therapist, preferred_days, preferred_time,
    coordination_details, consent_text, consent_version, consented_at,
    source_kind, source_detail, checkpoint_code, checkpoint_placement_id,
    checkpoint_session_key, attribution_verified, funnel_session_key,
    utm_source, utm_medium, utm_campaign, utm_content, referrer_host,
    notification_status, submitted_at
  ) values (
    v_lead.id, v_request_reference, v_request_kind, v_client_submission,
    v_quiz_reference, v_first_name, v_last_name, v_email, v_phone,
    v_therapy_type, v_preferred_therapist, v_preferred_days,
    v_preferred_time, v_coordination_details, v_consent_text,
    v_consent_version, p_consented_at, p_source_kind, v_source_detail,
    v_checkpoint_code, v_checkpoint_placement_id, v_checkpoint_session_key,
    v_attribution_verified, v_funnel_session, v_utm_source, v_utm_medium,
    v_utm_campaign, v_utm_content, v_referrer_host,
    p_notification_status, p_submitted_at
  )
  returning * into v_request;

  return jsonb_build_object(
    'accepted', true,
    'created', v_is_new,
    'leadId', v_lead.id,
    'referenceId', coalesce(v_lead.consultation_reference_id, v_lead.quiz_reference_id),
    'consultationReferenceId', v_lead.consultation_reference_id,
    'quizReferenceId', v_lead.quiz_reference_id,
    'requestNotificationStatus', v_request.notification_status,
    'attributionVerified', v_request.attribution_verified,
    'rowVersion', v_lead.row_version
  );
end;
$$;

create or replace function public.claim_consultation_notification(
  p_lead_id uuid,
  p_request_reference text,
  p_lease_seconds integer default 300
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_request public.consultation_requests%rowtype;
  v_lead public.consultation_leads%rowtype;
  v_claim_token uuid;
  v_latest_notification_status text;
  v_retry_after integer := 0;
  v_now timestamptz := statement_timestamp();
begin
  if p_lead_id is null or
     p_request_reference is null or
     p_request_reference !~ '^(VC-[A-Za-z0-9_-]{6,116}|VQ-[A-Za-z0-9_-]{4,80})$' or
     p_lease_seconds is null or p_lease_seconds < 30 or p_lease_seconds > 900 then
    raise exception using errcode = '22023', message = 'Invalid notification claim.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('consultation-request:' || p_request_reference, 0)
  );

  select request.* into v_request
  from public.consultation_requests as request
  where request.lead_id = p_lead_id
    and request.request_reference = p_request_reference
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Consultation request not found.';
  end if;

  -- Keep the same request -> lead order used by upsert and completion.
  select lead.* into strict v_lead
  from public.consultation_leads as lead
  where lead.id = p_lead_id
  for update;

  if v_request.notification_status = 'sent' then
    return jsonb_build_object(
      'accepted', true,
      'claimed', false,
      'reason', 'already_sent',
      'alreadySent', true,
      'leadId', v_lead.id,
      'requestReference', v_request.request_reference,
      'requestNotificationStatus', v_request.notification_status,
      'attemptCount', v_request.notification_attempt_count,
      'retryAfterSeconds', 0,
      'rowVersion', v_lead.row_version
    );
  end if;

  if v_request.notification_claim_token is not null and
     v_request.notification_claim_expires_at > v_now then
    v_retry_after := greatest(
      1,
      ceil(extract(epoch from (
        v_request.notification_claim_expires_at - v_now
      )))::integer
    );
    return jsonb_build_object(
      'accepted', true,
      'claimed', false,
      'reason', 'lease_active',
      'alreadySent', false,
      'leadId', v_lead.id,
      'requestReference', v_request.request_reference,
      'requestNotificationStatus', v_request.notification_status,
      'leaseExpiresAt', v_request.notification_claim_expires_at,
      'attemptCount', v_request.notification_attempt_count,
      'retryAfterSeconds', v_retry_after,
      'rowVersion', v_lead.row_version
    );
  end if;

  v_claim_token := extensions.gen_random_uuid();
  update public.consultation_requests as request
  set notification_status = 'pending',
      notification_claim_token = v_claim_token,
      notification_claimed_at = v_now,
      notification_claim_expires_at = v_now + p_lease_seconds * interval '1 second',
      notification_attempt_count = case
        when request.notification_attempt_count < 2147483647
          then request.notification_attempt_count + 1
        else request.notification_attempt_count
      end
  where request.id = v_request.id
  returning * into v_request;

  select request.notification_status into strict v_latest_notification_status
  from public.consultation_requests as request
  where request.lead_id = p_lead_id
  order by request.submitted_at desc, request.created_at desc, request.id desc
  limit 1;

  update public.consultation_leads as lead
  set notification_status = v_latest_notification_status,
      updated_at = transaction_timestamp()
  where lead.id = p_lead_id
  returning * into v_lead;

  return jsonb_build_object(
    'accepted', true,
    'claimed', true,
    'reason', 'claimed',
    'alreadySent', false,
    'leadId', v_lead.id,
    'requestReference', v_request.request_reference,
    'claimToken', v_request.notification_claim_token,
    'requestNotificationStatus', v_request.notification_status,
    'leaseExpiresAt', v_request.notification_claim_expires_at,
    'attemptCount', v_request.notification_attempt_count,
    'retryAfterSeconds', 0,
    'rowVersion', v_lead.row_version
  );
end;
$$;

create or replace function public.complete_consultation_notification_claim(
  p_lead_id uuid,
  p_request_reference text,
  p_claim_token uuid,
  p_notification_status text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_request public.consultation_requests%rowtype;
  v_lead public.consultation_leads%rowtype;
  v_latest_notification_status text;
begin
  if p_lead_id is null or p_claim_token is null or
     p_request_reference is null or
     p_request_reference !~ '^(VC-[A-Za-z0-9_-]{6,116}|VQ-[A-Za-z0-9_-]{4,80})$' or
     p_notification_status not in ('sent', 'failed') then
    raise exception using errcode = '22023', message = 'Invalid notification completion.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('consultation-request:' || p_request_reference, 0)
  );

  select request.* into v_request
  from public.consultation_requests as request
  where request.lead_id = p_lead_id
    and request.request_reference = p_request_reference
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Consultation request not found.';
  end if;

  if v_request.notification_claim_token is distinct from p_claim_token then
    return jsonb_build_object(
      'accepted', false,
      'staleClaim', true,
      'leadId', v_request.lead_id,
      'requestReference', v_request.request_reference,
      'requestNotificationStatus', v_request.notification_status,
      'attemptCount', v_request.notification_attempt_count
    );
  end if;

  update public.consultation_requests as request
  set notification_status = p_notification_status,
      notification_claim_token = null,
      notification_claimed_at = null,
      notification_claim_expires_at = null
  where request.id = v_request.id
  returning * into v_request;

  -- Keep the same request -> lead order used by upsert and claim.
  select lead.* into strict v_lead
  from public.consultation_leads as lead
  where lead.id = p_lead_id
  for update;

  select request.notification_status into strict v_latest_notification_status
  from public.consultation_requests as request
  where request.lead_id = p_lead_id
  order by request.submitted_at desc, request.created_at desc, request.id desc
  limit 1;

  update public.consultation_leads as lead
  set notification_status = v_latest_notification_status,
      updated_at = transaction_timestamp()
  where lead.id = p_lead_id
  returning * into v_lead;

  insert into public.consultation_lead_history (
    lead_id, event_type, to_workflow_status, to_conversion_stage,
    note, actor_kind
  ) values (
    v_lead.id, 'notification_updated', v_lead.workflow_status,
    v_lead.conversion_stage,
    'Notification attempt ' || v_request.notification_attempt_count ||
      ' for ' || p_request_reference || ': ' || p_notification_status,
    'system'
  );

  return jsonb_build_object(
    'accepted', true,
    'staleClaim', false,
    'leadId', v_lead.id,
    'requestReference', v_request.request_reference,
    'requestNotificationStatus', v_request.notification_status,
    'notificationStatus', v_lead.notification_status,
    'attemptCount', v_request.notification_attempt_count,
    'rowVersion', v_lead.row_version
  );
end;
$$;

create or replace function public.set_consultation_notification_status(
  p_lead_id uuid,
  p_request_reference text,
  p_notification_status text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_lead public.consultation_leads%rowtype;
  v_request public.consultation_requests%rowtype;
  v_latest_notification_status text;
begin
  if p_lead_id is null or
     p_request_reference is null or
     p_request_reference !~ '^(VC-[A-Za-z0-9_-]{6,116}|VQ-[A-Za-z0-9_-]{4,80})$' or
     p_notification_status not in ('pending', 'sent', 'failed', 'unknown') then
    raise exception using errcode = '22023', message = 'Invalid notification update.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('consultation-request:' || p_request_reference, 0)
  );

  update public.consultation_requests as request
  set notification_status = p_notification_status,
      notification_claim_token = null,
      notification_claimed_at = null,
      notification_claim_expires_at = null
  where request.lead_id = p_lead_id
    and request.request_reference = p_request_reference
  returning * into v_request;

  if not found then
    raise exception using errcode = 'P0002', message = 'Consultation request not found.';
  end if;

  -- Keep the request -> lead lock order identical to upsert_consultation_lead.
  select lead.* into v_lead
  from public.consultation_leads as lead
  where lead.id = p_lead_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Consultation lead not found.';
  end if;

  -- A late notification completion for an older request must not overwrite the
  -- roll-up shown for a newer request on the same opportunity.
  select request.notification_status into strict v_latest_notification_status
  from public.consultation_requests as request
  where request.lead_id = p_lead_id
  order by request.submitted_at desc, request.created_at desc, request.id desc
  limit 1;

  update public.consultation_leads as lead
  set notification_status = v_latest_notification_status,
      updated_at = transaction_timestamp()
  where lead.id = p_lead_id
  returning * into v_lead;

  insert into public.consultation_lead_history (
    lead_id, event_type, to_workflow_status, to_conversion_stage,
    note, actor_kind
  ) values (
    v_lead.id, 'notification_updated', v_lead.workflow_status,
    v_lead.conversion_stage,
    'Notification status for ' || p_request_reference || ': ' || p_notification_status,
    'system'
  );

  return jsonb_build_object(
    'accepted', true,
    'leadId', v_lead.id,
    'requestReference', v_request.request_reference,
    'requestNotificationStatus', v_request.notification_status,
    'notificationStatus', v_lead.notification_status,
    'rowVersion', v_lead.row_version
  );
end;
$$;

create or replace function public.repair_consultation_request_attribution(
  p_request_reference text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_reference text := nullif(btrim(p_request_reference), '');
  v_request public.consultation_requests%rowtype;
  v_lead public.consultation_leads%rowtype;
  v_checkpoint_code text;
  v_placement_id uuid;
  v_session_key text;
  v_request_changed boolean := false;
  v_lead_changed boolean := false;
begin
  if v_reference is null or
     v_reference !~ '^(VC-[A-Za-z0-9_-]{6,116}|VQ-[A-Za-z0-9_-]{4,80})$' then
    raise exception using errcode = '22023', message = 'Invalid consultation request reference.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('consultation-request:' || v_reference, 0)
  );

  select request.* into v_request
  from public.consultation_requests as request
  where request.request_reference = v_reference
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Consultation request not found.';
  end if;

  select lead.* into strict v_lead
  from public.consultation_leads as lead
  where lead.id = v_request.lead_id
  for update;

  if v_request.source_kind <> 'mental_battery_checkpoint' then
    return jsonb_build_object(
      'accepted', true,
      'verified', v_request.attribution_verified,
      'leadId', v_lead.id,
      'requestReference', v_request.request_reference,
      'checkpointCode', v_request.checkpoint_code,
      'placementId', v_request.checkpoint_placement_id,
      'sessionId', v_request.checkpoint_session_key,
      'rowVersion', v_lead.row_version
    );
  end if;

  select checkpoint.code, attribution.placement_id,
         attribution.anonymous_session_id::text
  into v_checkpoint_code, v_placement_id, v_session_key
  from public.consultation_attributions as attribution
  join public.checkpoints as checkpoint on checkpoint.id = attribution.checkpoint_id
  where attribution.consultation_reference_id = v_reference;

  if not found then
    return jsonb_build_object(
      'accepted', true,
      'verified', false,
      'leadId', v_lead.id,
      'requestReference', v_request.request_reference,
      'checkpointCode', v_request.checkpoint_code,
      'placementId', v_request.checkpoint_placement_id,
      'sessionId', v_request.checkpoint_session_key,
      'rowVersion', v_lead.row_version
    );
  end if;

  v_request_changed :=
    not v_request.attribution_verified or
    v_request.checkpoint_code is distinct from v_checkpoint_code or
    v_request.checkpoint_placement_id is distinct from v_placement_id or
    v_request.checkpoint_session_key is distinct from v_session_key;

  if v_request_changed then
    update public.consultation_requests as request
    set checkpoint_code = v_checkpoint_code,
        checkpoint_placement_id = v_placement_id,
        checkpoint_session_key = v_session_key,
        attribution_verified = true
    where request.id = v_request.id
    returning * into v_request;
  end if;

  v_lead_changed :=
    v_lead.source_kind = 'mental_battery_checkpoint' and (
      not v_lead.attribution_verified or
      v_lead.checkpoint_code is distinct from v_checkpoint_code or
      v_lead.checkpoint_placement_id is distinct from v_placement_id or
      v_lead.checkpoint_session_key is distinct from v_session_key
    );

  if v_lead_changed then
    update public.consultation_leads as lead
    set checkpoint_code = v_checkpoint_code,
        checkpoint_placement_id = v_placement_id,
        checkpoint_session_key = v_session_key,
        attribution_verified = true,
        last_activity_at = transaction_timestamp(),
        row_version = lead.row_version + 1,
        updated_at = transaction_timestamp()
    where lead.id = v_lead.id
    returning * into v_lead;
  end if;

  if v_request_changed or v_lead_changed then
    insert into public.consultation_lead_history (
      lead_id, event_type, to_workflow_status, to_conversion_stage,
      note, actor_kind
    ) values (
      v_lead.id, 'details_enriched', v_lead.workflow_status,
      v_lead.conversion_stage, 'Mental Battery attribution verified.', 'system'
    );
  end if;

  return jsonb_build_object(
    'accepted', true,
    'verified', true,
    'leadId', v_lead.id,
    'requestReference', v_request.request_reference,
    'checkpointCode', v_checkpoint_code,
    'placementId', v_placement_id,
    'sessionId', v_session_key,
    'rowVersion', v_lead.row_version
  );
end;
$$;

create or replace function public.update_consultation_lead(
  p_lead_id uuid,
  p_expected_version integer,
  p_workflow_status text,
  p_conversion_stage text,
  p_note text,
  p_actor_reference text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_before public.consultation_leads%rowtype;
  v_after public.consultation_leads%rowtype;
  v_note text := nullif(btrim(p_note), '');
  v_before_rank integer;
  v_after_rank integer;
  v_event_type text;
begin
  if p_lead_id is null or p_expected_version is null or p_expected_version < 1 or
     p_workflow_status not in (
       'new', 'in_progress', 'waiting_on_client', 'closed_won',
       'closed_lost', 'closed_unknown', 'duplicate'
     ) or
     p_conversion_stage not in (
       'consultation_requested', 'consultation_booked', 'paid_therapy'
     ) or
     (p_conversion_stage = 'paid_therapy' and p_workflow_status <> 'closed_won') or
     (v_note is not null and char_length(v_note) > 500) or
     (p_actor_reference is not null and char_length(p_actor_reference) > 120) then
    raise exception using errcode = '22023', message = 'Invalid consultation update.';
  end if;

  select lead.* into v_before
  from public.consultation_leads as lead
  where lead.id = p_lead_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Consultation lead not found.';
  end if;

  if v_before.row_version <> p_expected_version then
    return jsonb_build_object(
      'accepted', false,
      'conflict', true,
      'leadId', v_before.id,
      'currentVersion', v_before.row_version
    );
  end if;

  v_before_rank := case v_before.conversion_stage
    when 'consultation_requested' then 1
    when 'consultation_booked' then 2
    else 3
  end;
  v_after_rank := case p_conversion_stage
    when 'consultation_requested' then 1
    when 'consultation_booked' then 2
    else 3
  end;
  if (
    v_after_rank < v_before_rank or
    (
      v_before.workflow_status <> p_workflow_status and
      (
        v_before.workflow_status in ('closed_won', 'closed_lost', 'closed_unknown', 'duplicate') or
        p_workflow_status in ('closed_won', 'closed_lost', 'closed_unknown', 'duplicate')
      )
    )
  ) and v_note is null then
    raise exception using
      errcode = '22023',
      message = 'A note is required when reversing a conversion or changing a terminal outcome.';
  end if;

  update public.consultation_leads as lead
  set
    workflow_status = p_workflow_status,
    conversion_stage = p_conversion_stage,
    booked_at = case
      when p_conversion_stage in ('consultation_booked', 'paid_therapy')
        then coalesce(lead.booked_at, transaction_timestamp())
      else null
    end,
    paid_therapy_at = case
      when p_conversion_stage = 'paid_therapy'
        then coalesce(lead.paid_therapy_at, transaction_timestamp())
      else null
    end,
    closed_at = case
      when p_workflow_status in ('closed_won', 'closed_lost', 'closed_unknown', 'duplicate')
        then coalesce(lead.closed_at, transaction_timestamp())
      else null
    end,
    close_reason = case
      when p_workflow_status in ('closed_lost', 'duplicate') and
           p_workflow_status <> lead.workflow_status then v_note
      when p_workflow_status in ('closed_lost', 'duplicate') then lead.close_reason
      else null
    end,
    admin_note = coalesce(v_note, lead.admin_note),
    last_activity_at = transaction_timestamp(),
    row_version = lead.row_version + 1,
    updated_at = transaction_timestamp()
  where lead.id = v_before.id and lead.row_version = p_expected_version
  returning * into v_after;

  if not found then
    return jsonb_build_object(
      'accepted', false,
      'conflict', true,
      'leadId', v_before.id
    );
  end if;

  v_event_type := case
    when v_before.conversion_stage <> v_after.conversion_stage then 'conversion_updated'
    when v_before.workflow_status <> v_after.workflow_status then 'workflow_updated'
    else 'note_updated'
  end;
  insert into public.consultation_lead_history (
    lead_id, event_type, from_workflow_status, to_workflow_status,
    from_conversion_stage, to_conversion_stage, note,
    actor_kind, actor_reference
  ) values (
    v_after.id, v_event_type, v_before.workflow_status, v_after.workflow_status,
    v_before.conversion_stage, v_after.conversion_stage, v_note,
    'admin', nullif(btrim(p_actor_reference), '')
  );

  return jsonb_build_object(
    'accepted', true,
    'conflict', false,
    'leadId', v_after.id,
    'workflowStatus', v_after.workflow_status,
    'conversionStage', v_after.conversion_stage,
    'bookedAt', v_after.booked_at,
    'paidTherapyAt', v_after.paid_therapy_at,
    'rowVersion', v_after.row_version,
    'updatedAt', v_after.updated_at
  );
end;
$$;

create or replace function public.get_consultation_manager(
  p_from timestamptz,
  p_to timestamptz,
  p_workflow_status text,
  p_conversion_stage text,
  p_source_kind text,
  p_search text,
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
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(lower(btrim(p_search)), '');
  v_result jsonb;
begin
  if v_from >= v_to or v_to > statement_timestamp() + interval '10 minutes' or
     v_to - v_from > interval '10 years' or
     (p_workflow_status is not null and p_workflow_status not in (
       'new', 'in_progress', 'waiting_on_client', 'closed_won',
       'closed_lost', 'closed_unknown', 'duplicate'
     )) or
     (p_conversion_stage is not null and p_conversion_stage not in (
       'consultation_requested', 'consultation_booked', 'paid_therapy'
     )) or
     (p_source_kind is not null and p_source_kind not in (
       'mental_battery_checkpoint', 'quiz', 'direct', 'therapist',
       'possibility_builder', 'website', 'other'
     )) or
     (v_search is not null and char_length(v_search) > 120) then
    raise exception using errcode = '22023', message = 'Invalid consultation manager query.';
  end if;

  with period_requests as (
    select request.*
    from public.consultation_requests as request
    where request.submitted_at >= v_from and request.submitted_at < v_to
  ),
  request_activity as (
    select
      request.lead_id,
      count(*)::integer as request_count,
      least(sum(request.notification_attempt_count), 2147483647)::integer
        as notification_attempt_count,
      max(request.submitted_at) as latest_request_at,
      bool_or(request.submitted_at >= v_from and request.submitted_at < v_to)
        as has_period_request,
      bool_or(
        request.source_kind = 'mental_battery_checkpoint' and
        not request.attribution_verified
      ) as has_pending_attribution
    from public.consultation_requests as request
    group by request.lead_id
  ),
  legacy_period_leads as (
    select lead.*
    from public.consultation_leads as lead
    where lead.submitted_at >= v_from and lead.submitted_at < v_to
      and not exists (
        select 1 from public.consultation_requests as request
        where request.lead_id = lead.id
      )
  ),
  period_opportunities as (
    select lead.*
    from public.consultation_leads as lead
    where lead.submitted_at >= v_from and lead.submitted_at < v_to
      and lead.workflow_status <> 'duplicate'
  ),
  queue_leads as (
    select
      lead.*,
      coalesce(activity.request_count, 0) as request_count,
      coalesce(activity.notification_attempt_count, 0) as notification_attempt_count,
      coalesce(activity.latest_request_at, lead.submitted_at) as latest_request_at,
      coalesce(
        activity.has_pending_attribution,
        lead.source_kind = 'mental_battery_checkpoint' and
          not lead.attribution_verified,
        false
      ) as attribution_pending,
      coalesce(
        activity.has_period_request,
        activity.lead_id is null and
          lead.submitted_at >= v_from and lead.submitted_at < v_to,
        false
      ) as in_selected_range
    from public.consultation_leads as lead
    left join request_activity as activity on activity.lead_id = lead.id
    where coalesce(activity.has_period_request, false)
       or (
         activity.lead_id is null and
         lead.submitted_at >= v_from and lead.submitted_at < v_to
       )
       or lead.workflow_status in ('new', 'in_progress', 'waiting_on_client')
  ),
  filtered as (
    select lead.*
    from queue_leads as lead
    where (p_workflow_status is null or lead.workflow_status = p_workflow_status)
      and (p_conversion_stage is null or lead.conversion_stage = p_conversion_stage)
      and (p_source_kind is null or lead.source_kind = p_source_kind)
      and (
        v_search is null or
        lower(coalesce(lead.first_name, '') || ' ' || coalesce(lead.last_name, '')) like '%' || v_search || '%' or
        lower(coalesce(lead.email, '')) like '%' || v_search || '%' or
        (
          char_length(regexp_replace(v_search, '[^0-9]', '', 'g')) >= 3 and
          regexp_replace(coalesce(lead.phone, ''), '[^0-9]', '', 'g') like '%' || regexp_replace(v_search, '[^0-9]', '', 'g') || '%'
        ) or
        lower(coalesce(lead.consultation_reference_id, '')) like '%' || v_search || '%' or
        lower(coalesce(lead.quiz_reference_id, '')) like '%' || v_search || '%'
      )
  ),
  paged as (
    select
      lead.*,
      case lead.workflow_status
        when 'new' then 0
        when 'in_progress' then 1
        when 'waiting_on_client' then 2
        else 3
      end as sort_priority
    from filtered as lead
    order by
      sort_priority,
      lead.last_activity_at desc,
      lead.id
    limit v_limit offset v_offset
  ),
  totals as (
    select
      (
        (select count(*) from period_requests) +
        (select count(*) from legacy_period_leads)
      )::integer as submissions,
      count(*)::integer as opportunities,
      count(*) filter (where workflow_status = 'new')::integer as new_opportunities,
      count(*) filter (where workflow_status in ('in_progress', 'waiting_on_client'))::integer as active_opportunities,
      count(*) filter (where booked_at is not null)::integer as booked,
      count(*) filter (where paid_therapy_at is not null)::integer as paid,
      count(*) filter (where workflow_status = 'closed_lost')::integer as lost,
      count(*) filter (where workflow_status = 'closed_unknown')::integer as unknown_outcome,
      (
        (select count(*) from period_requests as request
          where request.source_kind = 'mental_battery_checkpoint'
            and not request.attribution_verified) +
        (select count(*) from legacy_period_leads as lead
          where lead.source_kind = 'mental_battery_checkpoint'
            and not lead.attribution_verified)
      )::integer as pending_attribution
    from period_opportunities
  ),
  submission_source_counts as (
    select request.source_kind as source, count(*)::integer as submissions
    from period_requests as request
    group by request.source_kind
    union all
    select lead.source_kind as source, count(*)::integer as submissions
    from legacy_period_leads as lead
    group by lead.source_kind
  ),
  submission_sources as (
    select source, sum(submissions)::integer as submissions
    from submission_source_counts
    group by source
  ),
  opportunity_sources as (
    select
      lead.source_kind as source,
      count(*)::integer as opportunities,
      count(*) filter (where lead.booked_at is not null)::integer as booked,
      count(*) filter (where lead.paid_therapy_at is not null)::integer as paid
    from period_opportunities as lead
    group by lead.source_kind
  ),
  source_keys as (
    select source from submission_sources
    union
    select source from opportunity_sources
  ),
  source_rows as (
    select jsonb_build_object(
      'source', source.source,
      'submissions', coalesce(submission.submissions, 0),
      'opportunities', coalesce(opportunity.opportunities, 0),
      -- Backward-compatible alias; this now means unique opportunities.
      'requests', coalesce(opportunity.opportunities, 0),
      'booked', coalesce(opportunity.booked, 0),
      'paidTherapy', coalesce(opportunity.paid, 0),
      'bookingRate', case when coalesce(opportunity.opportunities, 0) = 0 then 0 else
        round(opportunity.booked::numeric * 10000 / opportunity.opportunities) / 100 end,
      'paidTherapyRate', case when coalesce(opportunity.booked, 0) = 0 then 0 else
        round(opportunity.paid::numeric * 10000 / opportunity.booked) / 100 end
    ) as item,
    coalesce(submission.submissions, 0) as volume,
    source.source
    from source_keys as source
    left join submission_sources as submission on submission.source = source.source
    left join opportunity_sources as opportunity on opportunity.source = source.source
  ),
  lead_rows as (
    select jsonb_build_object(
      'id', lead.id,
      'referenceId', coalesce(lead.consultation_reference_id, lead.quiz_reference_id),
      'consultationReferenceId', lead.consultation_reference_id,
      'quizReferenceId', lead.quiz_reference_id,
      'firstName', lead.first_name,
      'lastName', lead.last_name,
      'email', lead.email,
      'phone', lead.phone,
      'therapyType', lead.therapy_type,
      'preferredTherapist', lead.preferred_therapist,
      'preferredDays', lead.preferred_days,
      'preferredTime', lead.preferred_time,
      'coordinationDetails', lead.coordination_details,
      'source', lead.source_kind,
      'sourceDetail', lead.source_detail,
      'checkpointCode', lead.checkpoint_code,
      'checkpointPlacementId', lead.checkpoint_placement_id,
      'checkpointSessionId', lead.checkpoint_session_key,
      'attributionVerified', lead.attribution_verified and not lead.attribution_pending,
      'attributionPending', lead.attribution_pending,
      'funnelSessionId', lead.funnel_session_key,
      'utmSource', lead.utm_source,
      'utmMedium', lead.utm_medium,
      'utmCampaign', lead.utm_campaign,
      'utmContent', lead.utm_content,
      'referrerHost', lead.referrer_host,
      'workflowStatus', lead.workflow_status,
      'conversionStage', lead.conversion_stage,
      'bookedAt', lead.booked_at,
      'paidTherapyAt', lead.paid_therapy_at,
      'closeReason', lead.close_reason,
      'adminNote', lead.admin_note,
      'notificationStatus', lead.notification_status,
      'notificationAttemptCount', lead.notification_attempt_count,
      'submittedAt', lead.submitted_at,
      'latestRequestAt', lead.latest_request_at,
      'inSelectedRange', lead.in_selected_range,
      'lastActivityAt', lead.last_activity_at,
      'rowVersion', lead.row_version,
      'requestCount', lead.request_count,
      'history', coalesce((
        select jsonb_agg(
          history_row.item
          order by history_row.recorded_at desc, history_row.id desc
        )
        from (
          select
            history.id,
            history.recorded_at,
            jsonb_build_object(
              'id', history.id,
              'eventType', history.event_type,
              'fromWorkflowStatus', history.from_workflow_status,
              'toWorkflowStatus', history.to_workflow_status,
              'fromConversionStage', history.from_conversion_stage,
              'toConversionStage', history.to_conversion_stage,
              'note', history.note,
              'actorKind', history.actor_kind,
              'actorReference', history.actor_reference,
              'recordedAt', history.recorded_at
            ) as item
          from public.consultation_lead_history as history
          where history.lead_id = lead.id
          order by history.recorded_at desc, history.id desc
          limit 25
        ) as history_row
      ), '[]'::jsonb)
    ) as item, lead.sort_priority, lead.last_activity_at, lead.id
    from paged as lead
  )
  select jsonb_build_object(
    'generatedAt', statement_timestamp(),
    'range', jsonb_build_object('from', v_from, 'to', v_to),
    'kpis', jsonb_build_object(
      'submissions', total.submissions,
      'opportunities', total.opportunities,
      -- Compatibility aliases for previously deployed clients.
      'requests', total.opportunities,
      'newOpportunities', total.new_opportunities,
      'newRequests', total.new_opportunities,
      'activeOpportunities', total.active_opportunities,
      'activeRequests', total.active_opportunities,
      'booked', total.booked,
      'paidTherapy', total.paid,
      'lost', total.lost,
      'unknownOutcome', total.unknown_outcome,
      'pendingAttribution', total.pending_attribution,
      'opportunityToBookingRate', case when total.opportunities = 0 then 0 else round(total.booked::numeric * 10000 / total.opportunities) / 100 end,
      'requestToBookingRate', case when total.opportunities = 0 then 0 else round(total.booked::numeric * 10000 / total.opportunities) / 100 end,
      'bookingToPaidTherapyRate', case when total.booked = 0 then 0 else round(total.paid::numeric * 10000 / total.booked) / 100 end
    ),
    'totalCount', (select count(*)::integer from filtered),
    'openCarryoverCount', (
      select count(*)::integer from filtered as lead
      where not lead.in_selected_range
    ),
    'limit', v_limit,
    'offset', v_offset,
    'sources', coalesce((
      select jsonb_agg(source.item order by source.volume desc, source.source)
      from source_rows as source
    ), '[]'::jsonb),
    'leads', coalesce((
      select jsonb_agg(
        row.item
        order by row.sort_priority, row.last_activity_at desc, row.id
      )
      from lead_rows as row
    ), '[]'::jsonb)
  ) into v_result
  from totals as total;

  return v_result;
end;
$$;

create or replace function public.get_growth_dashboard(
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
  if v_from >= v_to or v_to > statement_timestamp() + interval '10 minutes' or
     v_to - v_from > interval '10 years' then
    raise exception using errcode = '22023', message = 'Invalid growth dashboard range.';
  end if;

  with range_sessions as (
    select
      session.*,
      (
        session.max_quiz_question > 0 or session.quiz_started or
        exists (
          select 1 from public.growth_funnel_events as event
          where event.session_id = session.id
            and event.event_name = 'quiz_page_viewed'
        )
      ) as quiz_visitor
    from public.growth_funnel_sessions as session
    where session.started_at >= v_from and session.started_at < v_to
  ),
  quiz_sessions as (
    select * from range_sessions where quiz_visitor
  ),
  quiz_attempts as (
    select attempt.*
    from public.growth_quiz_attempts as attempt
    join quiz_sessions as session on session.id = attempt.session_id
  ),
  quiz_lead_cohort as (
    -- A durable VQ reference is the authoritative evidence that the results
    -- access form was submitted. Prefer its immutable attempt link when one
    -- exists; retain the session-only fallback for pre-attempt records.
    select
      link.*,
      coalesce(attempt_session.session_key, link.funnel_session_key) as origin_session_key
    from public.quiz_lead_links as link
    left join public.growth_quiz_attempts as linked_attempt
      on linked_attempt.attempt_key = link.quiz_attempt_key
    left join public.growth_funnel_sessions as attempt_session
      on attempt_session.id = linked_attempt.session_id
    where exists (
      select 1
      from quiz_sessions as session
      where session.session_key = coalesce(
        attempt_session.session_key,
        link.funnel_session_key
      )
    )
  ),
  quiz_request_cohort as (
    -- consultation_requests has one durable row per request reference and is
    -- authoritative for deliberate submissions. The mutable lead supplies
    -- only staff-managed duplicate and conversion state.
    select
      request.*,
      lead.workflow_status,
      lead.booked_at,
      lead.paid_therapy_at,
      coalesce(
        quiz_link.origin_session_key,
        request.funnel_session_key,
        lead.funnel_session_key
      ) as origin_session_key
    from public.consultation_requests as request
    join public.consultation_leads as lead on lead.id = request.lead_id
    left join quiz_lead_cohort as quiz_link
      on quiz_link.reference_id = lead.quiz_reference_id
    where exists (
      select 1
      from quiz_sessions as session
      where session.session_key = coalesce(
        quiz_link.origin_session_key,
        request.funnel_session_key,
        lead.funnel_session_key
      )
    )
  ),
  quiz_opportunities as (
    select
      request.lead_id,
      min(request.origin_session_key) as origin_session_key,
      max(request.booked_at) as booked_at,
      max(request.paid_therapy_at) as paid_therapy_at
    from quiz_request_cohort as request
    where request.workflow_status <> 'duplicate'
    group by request.lead_id
  ),
  consultation_click_sessions as (
    select distinct event.session_id
    from public.growth_funnel_events as event
    join quiz_sessions as session on session.id = event.session_id
    where event.event_name = 'consultation_request_clicked'
  ),
  totals as (
    select
      (select count(*)::integer from range_sessions) as tracked_sessions,
      (select count(*)::integer from quiz_sessions) as quiz_visitors,
      (select count(*)::integer from quiz_attempts) as quiz_attempts,
      (select count(*)::integer from quiz_attempts where quiz_completed) as quiz_attempt_completions,
      (select count(*)::integer from quiz_sessions where quiz_started) as quiz_starts,
      (select count(*)::integer from quiz_sessions where quiz_completed) as quiz_completions,
      (select count(*)::integer from quiz_sessions where results_access_viewed) as results_access_views,
      (select count(*)::integer from quiz_lead_cohort) as quiz_leads,
      (select count(*)::integer from quiz_sessions where results_viewed) as results_viewed,
      (select count(*)::integer from quiz_sessions where therapist_match_viewed) as therapist_matches,
      (select count(*)::integer from consultation_click_sessions) as consultation_clicks,
      (select count(*)::integer from quiz_sessions where consultation_page_viewed) as consultation_page_views,
      (select count(*)::integer from quiz_sessions where consultation_max_step >= 1) as consultation_step_1,
      (select count(*)::integer from quiz_sessions where consultation_max_step >= 2) as consultation_step_2,
      (select count(*)::integer from quiz_request_cohort) as consultation_requests,
      (select count(*)::integer from quiz_request_cohort where workflow_status = 'duplicate') as duplicate_requests,
      (select count(*)::integer from quiz_opportunities) as consultation_opportunities,
      (select count(*)::integer from quiz_opportunities where booked_at is not null) as booked,
      (select count(*)::integer from quiz_opportunities where paid_therapy_at is not null) as paid
  ),
  quiz_intent_selections as (
    -- One current categorical selection per attempt. Backtracking can change
    -- Q19, so the newest accepted sequence is authoritative.
    select distinct on (event.quiz_attempt_key)
      event.quiz_attempt_key,
      event.quiz_intent
    from public.growth_funnel_events as event
    join quiz_attempts as attempt
      on attempt.attempt_key = event.quiz_attempt_key
    where event.event_name = 'quiz_intent_selected'
      and event.quiz_intent is not null
    order by event.quiz_attempt_key, event.sequence desc
  ),
  quiz_intent_values as (
    select * from (values
      ('ready_to_speak'::text, 1),
      ('brief_consultation'::text, 2),
      ('see_recommended_therapist'::text, 3),
      ('exploring'::text, 4)
    ) as value(intent, position)
  ),
  quiz_intent_rows as (
    select
      value.intent,
      value.position,
      count(selection.quiz_attempt_key)::integer as selections
    from quiz_intent_values as value
    left join quiz_intent_selections as selection
      on selection.quiz_intent = value.intent
    group by value.intent, value.position
  ),
  question_activity as (
    select
      event.quiz_attempt_key,
      event.quiz_question,
      bool_or(event.event_name = 'quiz_question_viewed') as viewed,
      bool_or(event.event_name = 'quiz_question_answered') as answered
    from public.growth_funnel_events as event
    join quiz_attempts as attempt
      on attempt.attempt_key = event.quiz_attempt_key
    where event.event_name in ('quiz_question_viewed', 'quiz_question_answered')
      and event.quiz_question is not null
    group by event.quiz_attempt_key, event.quiz_question
  ),
  question_rows as (
    select
      question.number,
      count(attempt.attempt_key)::integer as reached,
      count(attempt.attempt_key) filter (
        where coalesce(activity.answered, false)
      )::integer as answered,
      count(attempt.attempt_key) filter (
        where coalesce(nullif(attempt.last_quiz_question, 0), attempt.max_quiz_question) = question.number
          and not attempt.quiz_completed
          and (attempt.explicit_exit or attempt.last_seen_at < statement_timestamp() - interval '30 minutes')
      )::integer as exits,
      count(attempt.attempt_key) filter (
        where coalesce(nullif(attempt.last_quiz_question, 0), attempt.max_quiz_question) = question.number
          and not attempt.quiz_completed
          and (attempt.explicit_exit or attempt.last_seen_at < statement_timestamp() - interval '30 minutes')
          and not coalesce(activity.answered, false)
      )::integer as exits_before_answer,
      count(attempt.attempt_key) filter (
        where coalesce(nullif(attempt.last_quiz_question, 0), attempt.max_quiz_question) = question.number
          and not attempt.quiz_completed
          and (attempt.explicit_exit or attempt.last_seen_at < statement_timestamp() - interval '30 minutes')
          and coalesce(activity.answered, false)
      )::integer as exits_after_answer
    from generate_series(1, 19) as question(number)
    left join quiz_attempts as attempt
      on greatest(
        attempt.max_quiz_question,
        coalesce(nullif(attempt.last_quiz_question, 0), attempt.max_quiz_question)
      ) >= question.number
    left join question_activity as activity
      on activity.quiz_attempt_key = attempt.attempt_key
     and activity.quiz_question = question.number
    group by question.number
  ),
  question_json as (
    select jsonb_build_object(
      'questionNumber', row.number,
      'reached', row.reached,
      'answered', row.answered,
      'exits', row.exits,
      'exitsBeforeAnswer', row.exits_before_answer,
      'exitsAfterAnswer', row.exits_after_answer,
      'reachRate', case when total.quiz_attempts = 0 then 0 else round(row.reached::numeric * 10000 / total.quiz_attempts) / 100 end,
      'answerRate', case when row.reached = 0 then 0 else round(row.answered::numeric * 10000 / row.reached) / 100 end,
      'exitRate', case when row.reached = 0 then 0 else round(row.exits::numeric * 10000 / row.reached) / 100 end
    ) as item, row.number
    from question_rows as row cross join totals as total
  ),
  quiz_leads_by_session as (
    select
      lead.origin_session_key as session_key,
      count(*)::integer as quiz_leads
    from quiz_lead_cohort as lead
    group by lead.origin_session_key
  ),
  quiz_requests_by_session as (
    select
      request.origin_session_key as session_key,
      count(*)::integer as consultation_requests,
      count(*) filter (where request.workflow_status = 'duplicate')::integer as duplicate_requests,
      count(distinct request.lead_id) filter (
        where request.workflow_status <> 'duplicate'
      )::integer as consultation_opportunities,
      count(distinct request.lead_id) filter (
        where request.workflow_status <> 'duplicate' and request.booked_at is not null
      )::integer as booked,
      count(distinct request.lead_id) filter (
        where request.workflow_status <> 'duplicate' and request.paid_therapy_at is not null
      )::integer as paid
    from quiz_request_cohort as request
    group by request.origin_session_key
  ),
  source_base as (
    select
      session.id,
      session.session_key,
      coalesce(nullif(session.utm_source, ''),
        case when session.referrer_host is null or session.referrer_host = 'internal'
          then 'direct' else session.referrer_host end
      ) as source,
      coalesce(nullif(session.utm_medium, ''), 'none') as medium,
      coalesce(nullif(session.utm_campaign, ''), 'uncategorized') as campaign,
      session.quiz_started,
      session.quiz_completed,
      exists (
        select 1 from consultation_click_sessions as click
        where click.session_id = session.id
      ) as consultation_clicked
    from quiz_sessions as session
  ),
  source_rows as (
    select
      base.source,
      base.medium,
      base.campaign,
      count(distinct base.id)::integer as sessions,
      count(distinct base.id) filter (where base.quiz_started)::integer as quiz_starts,
      count(distinct base.id) filter (where base.quiz_completed)::integer as quiz_completions,
      coalesce(sum(lead.quiz_leads), 0)::integer as quiz_leads,
      count(distinct base.id) filter (where base.consultation_clicked)::integer as consultation_clicks,
      coalesce(sum(request.consultation_requests), 0)::integer as consultation_requests,
      coalesce(sum(request.duplicate_requests), 0)::integer as duplicate_requests,
      coalesce(sum(request.consultation_opportunities), 0)::integer as consultation_opportunities,
      coalesce(sum(request.booked), 0)::integer as booked,
      coalesce(sum(request.paid), 0)::integer as paid
    from source_base as base
    left join quiz_leads_by_session as lead
      on lead.session_key = base.session_key
    left join quiz_requests_by_session as request
      on request.session_key = base.session_key
    group by base.source, base.medium, base.campaign
  ),
  source_json as (
    select jsonb_build_object(
      'source', row.source,
      'medium', row.medium,
      'campaign', row.campaign,
      'sessions', row.sessions,
      'quizStarts', row.quiz_starts,
      'quizCompletions', row.quiz_completions,
      'quizLeads', row.quiz_leads,
      'consultationClicks', row.consultation_clicks,
      'consultationRequests', row.consultation_requests,
      'duplicateConsultationRequests', row.duplicate_requests,
      'consultationOpportunities', row.consultation_opportunities,
      'consultationBookings', row.booked,
      'paidTherapyConversions', row.paid,
      'quizCompletionRate', case when row.quiz_starts = 0 then 0 else round(row.quiz_completions::numeric * 10000 / row.quiz_starts) / 100 end,
      'requestRate', case when row.sessions = 0 then 0 else round(row.consultation_requests::numeric * 10000 / row.sessions) / 100 end,
      'bookingRate', case when row.consultation_opportunities = 0 then 0 else round(row.booked::numeric * 10000 / row.consultation_opportunities) / 100 end,
      'paidTherapyRate', case when row.booked = 0 then 0 else round(row.paid::numeric * 10000 / row.booked) / 100 end
    ) as item, row.sessions
    from source_rows as row
  ),
  recent_rows as (
    select jsonb_build_object(
      'sessionId', session.session_key,
      'startedAt', session.started_at,
      'lastSeenAt', session.last_seen_at,
      'lastStage', session.last_stage,
      'quizVersion', session.quiz_version,
      'maxQuizQuestion', session.max_quiz_question,
      'lastQuizQuestion', latest_attempt.last_quiz_question,
      'quizCompleted', session.quiz_completed,
      'consultationClicked', exists (
        select 1 from consultation_click_sessions as click
        where click.session_id = session.id
      ),
      'consultationSubmitted', exists (
        select 1 from quiz_request_cohort as request
        where request.origin_session_key = session.session_key
      ),
      'submissionReference', session.submission_reference,
      'therapistId', session.therapist_id,
      'quizIntent', coalesce(lead_link.intent, intent_event.quiz_intent),
      'recommendedTherapist', lead_link.recommended_therapist,
      'device', session.device_category,
      'source', session.utm_source,
      'medium', session.utm_medium,
      'campaign', session.utm_campaign
    ) as item, session.last_seen_at
    from quiz_sessions as session
    left join lateral (
      select link.intent, link.recommended_therapist
      from quiz_lead_cohort as link
      where link.origin_session_key = session.session_key
      order by link.consented_at desc, link.created_at desc
      limit 1
    ) as lead_link on true
    left join lateral (
      select attempt.last_quiz_question
      from quiz_attempts as attempt
      where attempt.session_id = session.id
      order by attempt.last_seen_at desc, attempt.created_at desc
      limit 1
    ) as latest_attempt on true
    left join lateral (
      select event.quiz_intent
      from public.growth_funnel_events as event
      where event.session_id = session.id
        and event.event_name = 'quiz_intent_selected'
        and event.quiz_intent is not null
      order by event.sequence desc
      limit 1
    ) as intent_event on true
    order by session.last_seen_at desc
    limit 100
  )
  select jsonb_build_object(
    'generatedAt', statement_timestamp(),
    'range', jsonb_build_object('from', v_from, 'to', v_to),
    'kpis', jsonb_build_object(
      'trackedSessions', total.tracked_sessions,
      'quizVisitors', total.quiz_visitors,
      'quizAttempts', total.quiz_attempts,
      'quizAttemptCompletions', total.quiz_attempt_completions,
      'quizStarts', total.quiz_starts,
      'quizCompletions', total.quiz_completions,
      'quizLeads', total.quiz_leads,
      'resultsViewed', total.results_viewed,
      'therapistMatchesViewed', total.therapist_matches,
      'consultationClicks', total.consultation_clicks,
      'consultationRequests', total.consultation_requests,
      'duplicateConsultationRequests', total.duplicate_requests,
      'consultationOpportunities', total.consultation_opportunities,
      'consultationBookings', total.booked,
      'paidTherapyConversions', total.paid,
      'quizCompletionRate', case when total.quiz_starts = 0 then 0 else round(total.quiz_completions::numeric * 10000 / total.quiz_starts) / 100 end,
      'quizAttemptCompletionRate', case when total.quiz_attempts = 0 then 0 else round(total.quiz_attempt_completions::numeric * 10000 / total.quiz_attempts) / 100 end,
      'quizToConsultationRate', case when total.quiz_visitors = 0 then 0 else round(total.consultation_requests::numeric * 10000 / total.quiz_visitors) / 100 end,
      'requestToBookingRate', case when total.consultation_opportunities = 0 then 0 else round(total.booked::numeric * 10000 / total.consultation_opportunities) / 100 end,
      'opportunityToBookingRate', case when total.consultation_opportunities = 0 then 0 else round(total.booked::numeric * 10000 / total.consultation_opportunities) / 100 end,
      'bookingToPaidTherapyRate', case when total.booked = 0 then 0 else round(total.paid::numeric * 10000 / total.booked) / 100 end
    ),
    'quizFunnel', jsonb_build_array(
      -- These are independent cohort signals, not a forced monotonic funnel.
      -- Every percentage therefore uses quiz visitors as its denominator.
      jsonb_build_object('key', 'quiz_visitors', 'label', 'Quiz visitors', 'count', total.quiz_visitors, 'conversionRate', case when total.quiz_visitors = 0 then 0 else 100 end),
      jsonb_build_object('key', 'quiz_starts', 'label', 'Quiz started', 'count', total.quiz_starts, 'conversionRate', case when total.quiz_visitors = 0 then 0 else round(total.quiz_starts::numeric * 10000 / total.quiz_visitors) / 100 end),
      jsonb_build_object('key', 'quiz_completions', 'label', '19 questions completed', 'count', total.quiz_completions, 'conversionRate', case when total.quiz_visitors = 0 then 0 else round(total.quiz_completions::numeric * 10000 / total.quiz_visitors) / 100 end),
      jsonb_build_object('key', 'results_access_viewed', 'label', 'Results access viewed', 'count', total.results_access_views, 'conversionRate', case when total.quiz_visitors = 0 then 0 else round(total.results_access_views::numeric * 10000 / total.quiz_visitors) / 100 end),
      jsonb_build_object('key', 'quiz_leads', 'label', 'Contact leads saved', 'count', total.quiz_leads, 'conversionRate', case when total.quiz_visitors = 0 then 0 else round(total.quiz_leads::numeric * 10000 / total.quiz_visitors) / 100 end),
      jsonb_build_object('key', 'results_viewed', 'label', 'Results viewed', 'count', total.results_viewed, 'conversionRate', case when total.quiz_visitors = 0 then 0 else round(total.results_viewed::numeric * 10000 / total.quiz_visitors) / 100 end),
      jsonb_build_object('key', 'consultation_clicks', 'label', 'Consultation CTA clicked', 'count', total.consultation_clicks, 'conversionRate', case when total.quiz_visitors = 0 then 0 else round(total.consultation_clicks::numeric * 10000 / total.quiz_visitors) / 100 end),
      jsonb_build_object('key', 'consultation_page_views', 'label', 'Consultation form opened', 'count', total.consultation_page_views, 'conversionRate', case when total.quiz_visitors = 0 then 0 else round(total.consultation_page_views::numeric * 10000 / total.quiz_visitors) / 100 end),
      jsonb_build_object('key', 'consultation_step_1', 'label', 'About you reached', 'count', total.consultation_step_1, 'conversionRate', case when total.quiz_visitors = 0 then 0 else round(total.consultation_step_1::numeric * 10000 / total.quiz_visitors) / 100 end),
      jsonb_build_object('key', 'consultation_step_2', 'label', 'Availability reached', 'count', total.consultation_step_2, 'conversionRate', case when total.quiz_visitors = 0 then 0 else round(total.consultation_step_2::numeric * 10000 / total.quiz_visitors) / 100 end),
      jsonb_build_object('key', 'consultation_requests', 'label', 'Request submissions (all)', 'count', total.consultation_requests, 'conversionRate', case when total.quiz_visitors = 0 then 0 else round(total.consultation_requests::numeric * 10000 / total.quiz_visitors) / 100 end),
      jsonb_build_object('key', 'consultation_opportunities', 'label', 'Unique opportunities', 'count', total.consultation_opportunities, 'conversionRate', case when total.quiz_visitors = 0 then 0 else round(total.consultation_opportunities::numeric * 10000 / total.quiz_visitors) / 100 end),
      jsonb_build_object('key', 'booked', 'label', 'Consultation booked', 'count', total.booked, 'conversionRate', case when total.quiz_visitors = 0 then 0 else round(total.booked::numeric * 10000 / total.quiz_visitors) / 100 end),
      jsonb_build_object('key', 'paid', 'label', 'Paid therapy', 'count', total.paid, 'conversionRate', case when total.quiz_visitors = 0 then 0 else round(total.paid::numeric * 10000 / total.quiz_visitors) / 100 end)
    ),
    'quizIntentMix', coalesce((
      select jsonb_agg(jsonb_build_object(
        'intent', row.intent,
        'selections', row.selections,
        'share', case
          when (select sum(item.selections) from quiz_intent_rows as item) = 0 then 0
          else round(row.selections::numeric * 10000 /
            (select sum(item.selections) from quiz_intent_rows as item)) / 100
        end,
        'attemptRate', case
          when total.quiz_attempts = 0 then 0
          else round(row.selections::numeric * 10000 / total.quiz_attempts) / 100
        end
      ) order by row.position)
      from quiz_intent_rows as row
    ), '[]'::jsonb),
    'quizQuestions', coalesce((
      select jsonb_agg(question.item order by question.number)
      from question_json as question
    ), '[]'::jsonb),
    'sources', coalesce((
      select jsonb_agg(source.item order by source.sessions desc)
      from source_json as source
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

-- The upgraded Mental Battery result has distinct consultation, matching and
-- browsing actions. Preserve the legacy aggregate event while allowing the
-- privacy-safe action names to be measured independently.
alter table public.funnel_events
  drop constraint funnel_events_name_allowed;
alter table public.funnel_events
  add constraint funnel_events_name_allowed check (
    event_name in (
      'landing_view',
      'checkin_started',
      'checkin_step_completed',
      'checkin_completed',
      'intent_result_only_selected',
      'intent_practical_suggestions_selected',
      'intent_explore_therapists_selected',
      'intent_talk_soon_selected',
      'result_viewed',
      'therapist_cta_clicked',
      'consultation_cta_clicked',
      'therapist_match_clicked',
      'therapist_browse_clicked',
      'consultation_started',
      'consultation_submitted',
      'external_booking_clicked'
    )
  );

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
    'intent_result_only_selected',
    'intent_practical_suggestions_selected',
    'intent_explore_therapists_selected',
    'intent_talk_soon_selected',
    'result_viewed',
    'therapist_cta_clicked',
    'consultation_cta_clicked',
    'therapist_match_clicked',
    'therapist_browse_clicked',
    'consultation_started',
    'external_booking_clicked'
  ) then
    raise exception using errcode = '22023', message = 'Event name is not allowed.';
  end if;
  if (
    p_event_name = 'checkin_step_completed' and
    (p_step_number is null or p_step_number not between 1 and 4)
  ) or (
    p_event_name <> 'checkin_step_completed' and p_step_number is not null
  ) then
    raise exception using errcode = '22023', message = 'Invalid event step.';
  end if;

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

create or replace function public.get_checkpoint_action_metrics(
  p_from timestamptz,
  p_to timestamptz,
  p_checkpoint_code text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_result jsonb;
begin
  if p_from is null or p_to is null or p_from >= p_to or
     p_to > statement_timestamp() + interval '10 minutes' or
     p_to - p_from > interval '10 years' or
     (p_checkpoint_code is not null and p_checkpoint_code !~ '^VMH-(0[1-9]|10)$') then
    raise exception using errcode = '22023', message = 'Invalid checkpoint action range.';
  end if;

  with cohort_sessions as (
    select session.*, checkpoint.code
    from public.funnel_sessions as session
    join public.checkpoints as checkpoint on checkpoint.id = session.checkpoint_id
    where session.started_at >= p_from and session.started_at < p_to
      and (p_checkpoint_code is null or checkpoint.code = p_checkpoint_code)
  ),
  session_signals as (
    select
      session.id as session_id,
      session.checkpoint_id,
      session.placement_id,
      session.started_at,
      session.code,
      coalesce(bool_or(event.event_name in (
        'consultation_cta_clicked', 'therapist_cta_clicked'
      )), false) as consultation_cta,
      coalesce(bool_or(event.event_name = 'therapist_match_clicked'), false) as therapist_match,
      coalesce(bool_or(event.event_name = 'therapist_browse_clicked'), false) as therapist_browse,
      intent.action_intent
    from cohort_sessions as session
    left join public.funnel_events as event on event.session_id = session.id
    left join lateral (
      select case selected.event_name
        when 'intent_result_only_selected' then 'result_only'
        when 'intent_practical_suggestions_selected' then 'practical_suggestions'
        when 'intent_explore_therapists_selected' then 'explore_therapists'
        when 'intent_talk_soon_selected' then 'talk_soon'
      end as action_intent
      from public.funnel_events as selected
      where selected.session_id = session.id
        and selected.event_name in (
          'intent_result_only_selected',
          'intent_practical_suggestions_selected',
          'intent_explore_therapists_selected',
          'intent_talk_soon_selected'
        )
      order by selected.occurred_at desc, selected.id desc
      limit 1
    ) as intent on true
    group by
      session.id, session.checkpoint_id, session.placement_id,
      session.started_at, session.code, intent.action_intent
  ),
  checkpoint_rows as (
    select code, count(*) filter (where consultation_cta)::integer as clicks
    from session_signals group by code
  ),
  placement_rows as (
    select placement_id, count(*) filter (where consultation_cta)::integer as clicks
    from session_signals group by placement_id
  ),
  daily_rows as (
    select (started_at at time zone 'America/Toronto')::date as day,
           count(*) filter (where consultation_cta)::integer as clicks
    from session_signals group by day
  ),
  weekday_rows as (
    select extract(dow from started_at at time zone 'America/Toronto')::integer as day_index,
           count(*) filter (where consultation_cta)::integer as clicks
    from session_signals group by day_index
  ),
  totals as (
    select
      count(*)::integer as sessions,
      count(*) filter (where consultation_cta)::integer as consultation_cta,
      count(*) filter (where therapist_match)::integer as therapist_match,
      count(*) filter (where therapist_browse)::integer as therapist_browse,
      count(*) filter (
        where consultation_cta or therapist_match or therapist_browse
      )::integer as any_action,
      count(*) filter (where action_intent is not null)::integer as intent_selections
    from session_signals
  ),
  intent_values as (
    select * from (values
      ('result_only', 1),
      ('practical_suggestions', 2),
      ('explore_therapists', 3),
      ('talk_soon', 4)
    ) as value(intent, position)
  ),
  intent_rows as (
    select
      value.intent,
      value.position,
      count(signal.session_id) filter (
        where signal.action_intent = value.intent
      )::integer as selections
    from intent_values as value
    left join session_signals as signal on true
    group by value.intent, value.position
  )
  select jsonb_build_object(
    'total', total.consultation_cta,
    'cohortSessions', total.sessions,
    'resultActions', jsonb_build_array(
      jsonb_build_object(
        'key', 'consultation_cta',
        'count', total.consultation_cta,
        'sessionRate', case when total.sessions = 0 then 0 else round(total.consultation_cta::numeric * 10000 / total.sessions) / 100 end
      ),
      jsonb_build_object(
        'key', 'therapist_match',
        'count', total.therapist_match,
        'sessionRate', case when total.sessions = 0 then 0 else round(total.therapist_match::numeric * 10000 / total.sessions) / 100 end
      ),
      jsonb_build_object(
        'key', 'therapist_browse',
        'count', total.therapist_browse,
        'sessionRate', case when total.sessions = 0 then 0 else round(total.therapist_browse::numeric * 10000 / total.sessions) / 100 end
      ),
      jsonb_build_object(
        'key', 'any_action',
        'count', total.any_action,
        'sessionRate', case when total.sessions = 0 then 0 else round(total.any_action::numeric * 10000 / total.sessions) / 100 end
      )
    ),
    'intentMix', coalesce((select jsonb_agg(jsonb_build_object(
      'intent', row.intent,
      'count', row.selections,
      'share', case when total.intent_selections = 0 then 0 else round(row.selections::numeric * 10000 / total.intent_selections) / 100 end,
      'sessionRate', case when total.sessions = 0 then 0 else round(row.selections::numeric * 10000 / total.sessions) / 100 end
    ) order by row.position) from intent_rows as row), '[]'::jsonb),
    'checkpoints', coalesce((select jsonb_agg(jsonb_build_object(
      'code', row.code, 'count', row.clicks
    ) order by row.code) from checkpoint_rows as row), '[]'::jsonb),
    'placements', coalesce((select jsonb_agg(jsonb_build_object(
      'id', row.placement_id, 'count', row.clicks
    )) from placement_rows as row), '[]'::jsonb),
    'daily', coalesce((select jsonb_agg(jsonb_build_object(
      'date', row.day, 'count', row.clicks
    ) order by row.day) from daily_rows as row), '[]'::jsonb),
    'dayOfWeek', coalesce((select jsonb_agg(jsonb_build_object(
      'dayIndex', row.day_index, 'count', row.clicks
    ) order by row.day_index) from weekday_rows as row), '[]'::jsonb)
  ) into v_result
  from totals as total;

  return v_result;
end;
$$;

-- Preserve every historical VMH consultation reference. Contact fields remain
-- null until a current request or an explicit operational backfill enriches it.
insert into public.consultation_leads (
  consultation_reference_id,
  source_kind,
  source_detail,
  checkpoint_code,
  checkpoint_placement_id,
  checkpoint_session_key,
  attribution_verified,
  workflow_status,
  conversion_stage,
  booked_at,
  closed_at,
  notification_status,
  submitted_at,
  last_activity_at
)
select
  attribution.consultation_reference_id,
  'mental_battery_checkpoint',
  'legacy_checkpoint_attribution',
  checkpoint.code,
  attribution.placement_id,
  attribution.anonymous_session_id::text,
  true,
  case attribution.status
    when 'contacted' then 'in_progress'
    when 'scheduled' then 'in_progress'
    -- The legacy status did not prove booking or paid-therapy conversion.
    when 'closed' then 'closed_unknown'
    when 'not_a_fit' then 'closed_lost'
    else 'new'
  end,
  case when attribution.status = 'scheduled'
    then 'consultation_booked' else 'consultation_requested' end,
  case when attribution.status = 'scheduled'
    then attribution.updated_at else null end,
  case when attribution.status in ('closed', 'not_a_fit')
    then attribution.updated_at else null end,
  'unknown',
  attribution.submitted_at,
  attribution.updated_at
from public.consultation_attributions as attribution
join public.checkpoints as checkpoint on checkpoint.id = attribution.checkpoint_id
on conflict (consultation_reference_id) do nothing;

insert into public.consultation_lead_history (
  lead_id, event_type, to_workflow_status, to_conversion_stage,
  note, actor_kind, recorded_at
)
select
  lead.id, 'created', lead.workflow_status, lead.conversion_stage,
  'Imported from the existing anonymous checkpoint attribution.',
  'system', lead.created_at
from public.consultation_leads as lead
where lead.source_detail = 'legacy_checkpoint_attribution'
  and not exists (
    select 1 from public.consultation_lead_history as history
    where history.lead_id = lead.id
  );

alter table public.growth_funnel_sessions enable row level security;
alter table public.growth_quiz_attempts enable row level security;
alter table public.growth_funnel_events enable row level security;
alter table public.quiz_lead_links enable row level security;
alter table public.quiz_result_submissions enable row level security;
alter table public.quiz_result_email_deliveries enable row level security;
alter table public.consultation_leads enable row level security;
alter table public.consultation_requests enable row level security;
alter table public.consultation_lead_history enable row level security;

revoke all on table public.growth_funnel_sessions from public, anon, authenticated, service_role;
revoke all on table public.growth_quiz_attempts from public, anon, authenticated, service_role;
revoke all on table public.growth_funnel_events from public, anon, authenticated, service_role;
revoke all on table public.quiz_lead_links from public, anon, authenticated, service_role;
revoke all on table public.quiz_result_submissions from public, anon, authenticated, service_role;
revoke all on table public.quiz_result_email_deliveries from public, anon, authenticated, service_role;
revoke all on table public.consultation_leads from public, anon, authenticated, service_role;
revoke all on table public.consultation_requests from public, anon, authenticated, service_role;
revoke all on table public.consultation_lead_history from public, anon, authenticated, service_role;

revoke all on function public.ingest_growth_funnel_events(text, timestamptz, jsonb)
  from public, anon, authenticated;
revoke all on function public.record_quiz_lead_link(text, text, text, text, text, text, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.claim_quiz_result_submission(text, text, text, integer)
  from public, anon, authenticated;
revoke all on function public.complete_quiz_result_submission_storage(text, uuid, text, integer)
  from public, anon, authenticated;
revoke all on function public.claim_quiz_result_email_delivery(text, text, boolean, integer)
  from public, anon, authenticated;
revoke all on function public.complete_quiz_result_email_delivery(text, text, uuid, text)
  from public, anon, authenticated;
revoke all on function public.upsert_consultation_lead(
  text, text, text, text, text, text, text, text, text, text, text, text,
  text, text, timestamptz, text, text, text, uuid, text, text, text, text,
  text, text, text, text, timestamptz
) from public, anon, authenticated;
revoke all on function public.set_consultation_notification_status(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.claim_consultation_notification(uuid, text, integer)
  from public, anon, authenticated;
revoke all on function public.complete_consultation_notification_claim(uuid, text, uuid, text)
  from public, anon, authenticated;
revoke all on function public.repair_consultation_request_attribution(text)
  from public, anon, authenticated;
revoke all on function public.update_consultation_lead(uuid, integer, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.get_consultation_manager(
  timestamptz, timestamptz, text, text, text, text, integer, integer
) from public, anon, authenticated;
revoke all on function public.get_growth_dashboard(timestamptz, timestamptz)
  from public, anon, authenticated;
revoke all on function public.get_checkpoint_action_metrics(timestamptz, timestamptz, text)
  from public, anon, authenticated;

grant execute on function public.ingest_growth_funnel_events(text, timestamptz, jsonb)
  to service_role;
grant execute on function public.record_quiz_lead_link(text, text, text, text, text, text, text, timestamptz)
  to service_role;
grant execute on function public.claim_quiz_result_submission(text, text, text, integer)
  to service_role;
grant execute on function public.complete_quiz_result_submission_storage(text, uuid, text, integer)
  to service_role;
grant execute on function public.claim_quiz_result_email_delivery(text, text, boolean, integer)
  to service_role;
grant execute on function public.complete_quiz_result_email_delivery(text, text, uuid, text)
  to service_role;
grant execute on function public.upsert_consultation_lead(
  text, text, text, text, text, text, text, text, text, text, text, text,
  text, text, timestamptz, text, text, text, uuid, text, text, text, text,
  text, text, text, text, timestamptz
) to service_role;
grant execute on function public.set_consultation_notification_status(uuid, text, text)
  to service_role;
grant execute on function public.claim_consultation_notification(uuid, text, integer)
  to service_role;
grant execute on function public.complete_consultation_notification_claim(uuid, text, uuid, text)
  to service_role;
grant execute on function public.repair_consultation_request_attribution(text)
  to service_role;
grant execute on function public.update_consultation_lead(uuid, integer, text, text, text, text)
  to service_role;
grant execute on function public.get_consultation_manager(
  timestamptz, timestamptz, text, text, text, text, integer, integer
) to service_role;
grant execute on function public.get_growth_dashboard(timestamptz, timestamptz)
  to service_role;
grant execute on function public.get_checkpoint_action_metrics(timestamptz, timestamptz, text)
  to service_role;

commit;

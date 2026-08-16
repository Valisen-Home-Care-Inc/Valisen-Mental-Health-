import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isConsultationConversionStage,
  isConsultationSourceKind,
  isConsultationWorkflowStatus,
  sourceKindFromDetail,
} from "@/lib/consultationCrm";
import {
  QUIZ_QUESTION_LABELS,
  formatGrowthStage,
  quizQuestionLabel,
} from "@/lib/growth/dashboard";

describe("growth CRM contracts", () => {
  it("maps trusted sources without trusting a quiz-looking query string", () => {
    expect(
      sourceKindFromDetail("quiz_result", { quizVerified: true }),
    ).toBe("quiz");
    expect(sourceKindFromDetail("quiz_result")).toBe("website");
    expect(
      sourceKindFromDetail("anything", { checkpoint: true }),
    ).toBe("mental_battery_checkpoint");
    expect(sourceKindFromDetail("possibility_result")).toBe(
      "possibility_builder",
    );
  });

  it("allows only the explicit workflow, conversion, and source values", () => {
    expect(isConsultationWorkflowStatus("waiting_on_client")).toBe(true);
    expect(isConsultationWorkflowStatus("paid")).toBe(false);
    expect(isConsultationConversionStage("paid_therapy")).toBe(true);
    expect(isConsultationConversionStage("jane_clicked")).toBe(false);
    expect(isConsultationSourceKind("quiz")).toBe(true);
    expect(isConsultationSourceKind("meta")).toBe(false);
  });

  it("labels all 19 quiz screens and preserves answered exit detail", () => {
    expect(QUIZ_QUESTION_LABELS).toHaveLength(19);
    expect(quizQuestionLabel(1)).toContain("What brought you here");
    expect(quizQuestionLabel(18)).toBe("Q18 · Safety check");
    expect(quizQuestionLabel(19)).toContain("Preferred next step");
    expect(formatGrowthStage("quiz_question_8_answered")).toContain(
      "answered",
    );
  });

  it("reserves completed CRM language for an actual final-form submission", () => {
    const dashboard = readFileSync(
      join(process.cwd(), "components/checkpoints/admin/QuizDashboardClient.tsx"),
      "utf8",
    );

    expect(dashboard).toContain('label: "Questions finished"');
    expect(dashboard).toContain('label: "Completed submissions"');
    expect(dashboard).toContain("session.submissionReference ?");
    expect(dashboard).toContain("Final form not submitted");
    expect(dashboard).not.toContain('active={session.quizCompleted} activeLabel="Completed"');
  });
});

describe("unified growth CRM migration", () => {
  const migration = readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/20260810000000_unified_growth_crm.sql",
    ),
    "utf8",
  );

  it("keeps anonymous analytics and consented contact data in separate tables", () => {
    expect(migration).toContain("create table public.growth_funnel_events");
    expect(migration).toContain("create table public.consultation_leads");

    const anonymousTable = migration.slice(
      migration.indexOf("create table public.growth_funnel_events"),
      migration.indexOf("create index growth_funnel_events_session_occurred_idx"),
    );
    expect(anonymousTable).not.toMatch(
      /\n\s+(first_name|last_name|email|phone|quiz_answers|score|safety_response)\s/i,
    );
  });

  it("enforces RLS and service-role-only RPC access", () => {
    for (const table of [
      "growth_funnel_sessions",
      "growth_quiz_attempts",
      "growth_funnel_events",
      "quiz_lead_links",
      "quiz_result_submissions",
      "quiz_result_email_deliveries",
      "consultation_requests",
      "consultation_leads",
      "consultation_requests",
      "consultation_lead_history",
    ]) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security;`,
      );
      expect(migration).toContain(
        `revoke all on table public.${table} from public, anon, authenticated, service_role;`,
      );
    }
    expect(migration).not.toMatch(/grant\s+(select|insert|update|delete).*\s+to\s+(anon|authenticated)/i);
    expect(migration).toContain(
      "grant execute on function public.update_consultation_lead",
    );
  });

  it("makes bookings and paid therapy staff-confirmed CRM milestones", () => {
    expect(migration).toContain("'consultation_booked', 'paid_therapy'");
    expect(migration).toContain("p_expected_version integer");
    expect(migration).toContain("create table public.consultation_lead_history");
    expect(migration).toContain(
      "A note is required when reversing a conversion or changing a terminal outcome.",
    );
    expect(migration).toContain(
      "(v_note is not null and char_length(v_note) > 500)",
    );
  });

  it("guards request identity while allowing safe pre-delivery corrections", () => {
    const consultationFunction = migration.slice(
      migration.indexOf("create or replace function public.upsert_consultation_lead"),
      migration.indexOf("create or replace function public.set_consultation_notification_status"),
    );
    expect(consultationFunction).toContain("pg_advisory_xact_lock");
    expect(consultationFunction).toContain("consultation-request:");
    expect(consultationFunction).toContain("consultation-lead-client:");
    expect(consultationFunction).toContain("consultation-lead-quiz:");
    expect(consultationFunction).toContain(
      "Request reference was reused with different consultation data.",
    );
    expect(consultationFunction).toContain("v_snapshot_refresh");
    expect(consultationFunction).toContain(
      "v_request.notification_status = 'sent'",
    );
    expect(consultationFunction).toContain(
      "v_request.notification_claim_expires_at > statement_timestamp()",
    );
    expect(consultationFunction).toContain(
      "Retry details refreshed before notification delivery",
    );
    expect(consultationFunction).not.toContain(
      "on conflict (request_reference) do update",
    );
  });

  it("uses a fenced notification lease across server instances", () => {
    expect(migration).toContain("notification_claim_token uuid");
    expect(migration).toContain("notification_claim_expires_at timestamptz");
    expect(migration).toContain(
      "notification_attempt_count integer not null default 0",
    );

    const claimFunction = migration.slice(
      migration.indexOf("create or replace function public.claim_consultation_notification"),
      migration.indexOf("create or replace function public.complete_consultation_notification_claim"),
    );
    expect(claimFunction).toContain("pg_advisory_xact_lock");
    expect(claimFunction).toContain("'reason', 'lease_active'");
    expect(claimFunction).toContain("notification_attempt_count + 1");
    expect(claimFunction.indexOf("from public.consultation_requests")).toBeLessThan(
      claimFunction.indexOf("from public.consultation_leads"),
    );

    const completionFunction = migration.slice(
      migration.indexOf("create or replace function public.complete_consultation_notification_claim"),
      migration.indexOf("create or replace function public.set_consultation_notification_status"),
    );
    expect(completionFunction).toContain(
      "v_request.notification_claim_token is distinct from p_claim_token",
    );
    expect(completionFunction).toContain("'staleClaim', true");
    expect(completionFunction).toContain(
      "notification_claim_token = null",
    );
    expect(migration).toContain(
      "grant execute on function public.claim_consultation_notification(uuid, text, integer)",
    );
    expect(migration).toContain(
      "grant execute on function public.complete_consultation_notification_claim(uuid, text, uuid, text)",
    );
  });

  it("allocates one durable quiz identity and fences Sheet plus email side effects", () => {
    expect(migration).toContain(
      "create table public.quiz_result_submissions",
    );
    expect(migration).toContain(
      "client_submission_id text not null unique",
    );
    expect(migration).toContain("reference_id text not null unique");
    expect(migration).toContain("payload_hash text not null");
    expect(migration).toContain(
      "create table public.quiz_result_email_deliveries",
    );
    expect(migration).toContain(
      "primary key (submission_id, delivery_kind)",
    );

    const storageClaim = migration.slice(
      migration.indexOf(
        "create or replace function public.claim_quiz_result_submission",
      ),
      migration.indexOf(
        "create or replace function public.complete_quiz_result_submission_storage",
      ),
    );
    expect(storageClaim).toContain("quiz-result-submission:");
    expect(storageClaim).toContain("pg_advisory_xact_lock");
    expect(storageClaim).toContain("'reason', 'already_ready'");
    expect(storageClaim).toContain("'reason', 'lease_active'");
    expect(storageClaim).toContain(
      "Quiz submission identifier was reused with different result data.",
    );

    const emailClaim = migration.slice(
      migration.indexOf(
        "create or replace function public.claim_quiz_result_email_delivery",
      ),
      migration.indexOf(
        "create or replace function public.complete_quiz_result_email_delivery",
      ),
    );
    expect(emailClaim).toContain("quiz-result-email:");
    expect(emailClaim).toContain("p_known_sent");
    expect(emailClaim).toContain("'reason', 'already_sent'");
    expect(emailClaim).toContain("'reason', 'lease_active'");

    const emailCompletion = migration.slice(
      migration.indexOf(
        "create or replace function public.complete_quiz_result_email_delivery",
      ),
      migration.indexOf(
        "create or replace function public.upsert_consultation_lead",
      ),
    );
    expect(emailCompletion).toContain(
      "v_delivery.claim_token is distinct from p_claim_token",
    );
    expect(emailCompletion).toContain("'staleClaim', true");
    expect(migration).toContain(
      "grant execute on function public.claim_quiz_result_submission(text, text, text, integer)",
    );
    expect(migration).toContain(
      "grant execute on function public.claim_quiz_result_email_delivery(text, text, boolean, integer)",
    );
  });

  it("snapshots and repairs exact Mental Battery attribution", () => {
    expect(migration).toContain(
      "create or replace function public.repair_consultation_request_attribution",
    );
    expect(migration).toContain("attribution_verified boolean not null default false");
    expect(migration).toContain(
      "Checkpoint attribution does not match the recorded consultation.",
    );
    expect(migration).toContain(
      "grant execute on function public.repair_consultation_request_attribution(text)",
    );
  });

  it("keeps notification completion scoped to the exact request", () => {
    const notificationFunction = migration.slice(
      migration.indexOf("create or replace function public.set_consultation_notification_status"),
      migration.indexOf("create or replace function public.repair_consultation_request_attribution"),
    );
    expect(notificationFunction).toContain(
      "request.request_reference = p_request_reference",
    );
    expect(
      notificationFunction.indexOf("update public.consultation_requests"),
    ).toBeLessThan(
      notificationFunction.indexOf("select lead.* into v_lead"),
    );
    expect(notificationFunction).toContain(
      "order by request.submitted_at desc, request.created_at desc, request.id desc",
    );
    expect(notificationFunction).not.toContain("row_version = lead.row_version + 1");
    expect(notificationFunction).toContain(
      "'Notification status for ' || p_request_reference",
    );
  });

  it("separates raw submissions from unique opportunities in the manager", () => {
    const managerFunction = migration.slice(
      migration.indexOf("create or replace function public.get_consultation_manager"),
      migration.indexOf("create or replace function public.get_growth_dashboard"),
    );
    expect(managerFunction).toContain("with period_requests as");
    expect(managerFunction).toContain("period_opportunities as");
    expect(managerFunction).toContain("legacy_period_leads as");
    expect(managerFunction).toContain("'submissions', total.submissions");
    expect(managerFunction).toContain("'opportunities', total.opportunities");
    expect(managerFunction).toContain("'openCarryoverCount'");
    expect(managerFunction).toContain(
      "order by row.sort_priority, row.last_activity_at desc, row.id",
    );
  });

  it("does not classify an ambiguous legacy close as a win", () => {
    expect(migration).toContain("when 'closed' then 'closed_unknown'");
    expect(migration).not.toContain("when 'closed' then 'closed_won'");
  });

  it("keeps the original quiz funnel session authoritative through consultation", () => {
    const quizLinkFunction = migration.slice(
      migration.indexOf("create or replace function public.record_quiz_lead_link"),
      migration.indexOf("create or replace function public.upsert_consultation_lead"),
    );
    expect(quizLinkFunction).toContain(
      "set funnel_session_key = coalesce(public.quiz_lead_links.funnel_session_key, excluded.funnel_session_key)",
    );

    const consultationFunction = migration.slice(
      migration.indexOf("create or replace function public.upsert_consultation_lead"),
      migration.indexOf("create or replace function public.set_consultation_notification_status"),
    );
    expect(consultationFunction).toMatch(
      /if v_funnel_session is null and v_quiz_reference is not null then\s+select link\.funnel_session_key into v_funnel_session\s+from public\.quiz_lead_links as link\s+where link\.reference_id = v_quiz_reference;/,
    );
  });

  it("defines reliable exit accounting without claiming browser-close certainty", () => {
    expect(migration).toContain("explicit_exit boolean not null default false");
    expect(migration).toContain("interval '30 minutes'");
    expect(migration).toContain("generate_series(1, 19)");
    expect(migration).toContain("last_quiz_question smallint not null default 0");
    expect(migration).toContain(
      "event.event_name in ('quiz_question_viewed', 'quiz_question_answered')",
    );
    expect(migration).toContain("'exitsBeforeAnswer', row.exits_before_answer");
    expect(migration).toContain("'exitsAfterAnswer', row.exits_after_answer");
    expect(migration).toMatch(
      /nullif\(attempt\.last_quiz_question, 0\), attempt\.max_quiz_question/,
    );
  });

  it("uses durable lead and request records with explicit raw and opportunity definitions", () => {
    const dashboard = migration.slice(
      migration.indexOf("create or replace function public.get_growth_dashboard"),
      migration.indexOf("-- The upgraded Mental Battery result"),
    );
    expect(dashboard).toContain("from public.quiz_lead_links as link");
    expect(dashboard).toContain("from public.consultation_requests as request");
    expect(dashboard).toContain("where request.workflow_status <> 'duplicate'");
    expect(dashboard).toContain("'duplicateConsultationRequests'");
    expect(dashboard).toContain("'consultationOpportunities'");
    expect(dashboard).toContain("'Request submissions (all)'");
    expect(dashboard).toContain("'Unique opportunities'");
    expect(dashboard).toMatch(
      /'opportunityToBookingRate'[\s\S]*total\.consultation_opportunities/,
    );
    expect(dashboard).toMatch(
      /'quiz_starts'[\s\S]*total\.quiz_starts[\s\S]*total\.quiz_visitors/,
    );
  });

  it("cohorts VMH result actions by session start and deduplicates legacy CTA shadows", () => {
    const actions = migration.slice(
      migration.indexOf("create or replace function public.get_checkpoint_action_metrics"),
      migration.indexOf("-- Preserve every historical VMH consultation reference"),
    );
    expect(actions).toContain(
      "session.started_at >= p_from and session.started_at < p_to",
    );
    expect(actions).not.toContain("event.occurred_at >= p_from");
    expect(actions).toContain(
      "coalesce(bool_or(event.event_name in (",
    );
    expect(actions).toContain("'consultation_cta_clicked', 'therapist_cta_clicked'");
    expect(actions).toContain("'cohortSessions', total.sessions");
    expect(actions).toContain("'resultActions'");
    expect(actions).toContain("'intentMix'");
  });

  it("enforces privacy-safe quiz and VMH intent categories in SQL", () => {
    for (const intent of [
      "ready_to_speak",
      "brief_consultation",
      "see_recommended_therapist",
      "exploring",
    ]) {
      expect(migration).toContain(`'${intent}'`);
    }
    expect(migration).toContain("growth_funnel_events_quiz_intent_shape");
    expect(migration).toContain(
      "event_name <> 'quiz_intent_selected' and quiz_intent is null",
    );
    expect(migration).toContain("'intent_result_only_selected'");
    expect(migration).toContain("'intent_talk_soon_selected'");
    expect(migration).toContain("'quizIntentMix'");
  });

  it("rejects idempotency collisions when any stored payload field changes", () => {
    for (const field of [
      "occurred_at",
      "path",
      "page",
      "stage",
      "quiz_question",
      "quiz_attempt_key",
      "quiz_intent",
      "funnel_step",
      "cta_placement",
      "therapist_id",
      "submission_reference",
      "finder_used",
      "funnel_completed",
      "elapsed_ms",
    ]) {
      expect(migration).toContain(
        `v_existing.${field} is distinct from`,
      );
    }
  });
});

describe("quiz submission recovery migration", () => {
  const migration = readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/20260812000000_quiz_submission_recovery.sql",
    ),
    "utf8",
  );

  it("atomically snapshots submitted fields with the fenced VQ claim", () => {
    expect(migration).toContain(
      "create or replace function public.claim_quiz_result_submission_v2",
    );
    expect(migration).toContain("p_answers ? 'safety'");
    expect(migration).toContain("snapshot_captured_at");
    expect(migration).toContain("first_name = coalesce");
    expect(migration).toContain("email = coalesce");
    expect(migration).toContain("phone = coalesce");
  });

  it("records failed storage and exposes a protected operator queue", () => {
    expect(migration).toContain(
      "create or replace function public.record_quiz_result_submission_failure",
    );
    expect(migration).toContain("failure_alert_status");
    expect(migration).toContain(
      "create or replace function public.get_quiz_submission_recovery_queue",
    );
    expect(migration).toContain("where submission.sheet_status <> 'ready'");
    expect(migration).toContain(
      "grant execute on function public.get_quiz_submission_recovery_queue(integer)",
    );
    expect(migration).not.toMatch(
      /grant\s+(select|insert|update|delete).*\s+to\s+(anon|authenticated)/i,
    );
  });

  it("allows eventual funnel linkage instead of rejecting a saved lead", () => {
    const linkFunction = migration.slice(
      migration.indexOf(
        "create or replace function public.record_quiz_lead_link",
      ),
    );
    expect(linkFunction).not.toContain("Quiz funnel session not found.");
    expect(linkFunction).not.toContain(
      "Quiz attempt does not belong to the funnel session.",
    );
  });
});

describe("quiz CRM record-store follow-up migration", () => {
  const migration = readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/20260813000000_quiz_crm_record_store.sql",
    ),
    "utf8",
  );

  it("is safe after an earlier recovery rollout and installs the CRM payload operations", () => {
    expect(migration).toContain(
      "add column if not exists submission_token_hash text",
    );
    expect(migration).toContain("add column if not exists lead_record jsonb");
    expect(migration).toContain(
      "create or replace function public.save_quiz_lead_record",
    );
    expect(migration).toContain(
      "create or replace function public.get_quiz_lead_record",
    );
    expect(migration).toContain(
      "create or replace function public.patch_quiz_lead_record",
    );
    expect(migration).toContain("v_answers ? 'safety'");
    expect(migration).toContain(
      "grant execute on function public.save_quiz_lead_record",
    );
  });
});

describe("quiz tester classification migration", () => {
  const migration = readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/20260814000000_quiz_test_data_flags.sql",
    ),
    "utf8",
  );

  it("propagates an internal tester flag and excludes it at dashboard cohort roots", () => {
    expect(migration).toContain("create table public.growth_test_identities");
    expect(migration).toContain("create or replace function public.set_quiz_test_flag");
    expect(migration).toContain("create or replace function public.get_quiz_test_candidates");
    expect(migration).toContain("and not session.is_test");
    expect(migration).toContain("and not request.is_test");
    expect(migration).toContain("where not lead.is_test");
    expect(migration).toContain("quiz_result_submission_test_identity");
    expect(migration).toContain("consultation_lead_test_identity");
  });

  it("keeps tester identities and flag operations service-role-only", () => {
    expect(migration).toContain(
      "alter table public.growth_test_identities enable row level security;",
    );
    expect(migration).toContain(
      "revoke all on table public.growth_test_identities from public, anon, authenticated, service_role;",
    );
    expect(migration).toContain(
      "grant execute on function public.set_quiz_test_flag(text, text, boolean, text) to service_role;",
    );
    expect(migration).not.toMatch(
      /grant\s+(select|insert|update|delete).*\s+to\s+(anon|authenticated)/i,
    );
  });
});

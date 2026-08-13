import type { CampaignAttribution } from "@/lib/campaignAttribution";
import type {
  ConsultationConversionStage,
  ConsultationManagerData,
  ConsultationSourceKind,
  ConsultationWorkflowStatus,
} from "@/lib/consultationCrm";
import type { GrowthDashboardData } from "@/lib/growth/dashboard";
import type { QuizSubmissionRecoveryData } from "@/lib/growth/quizSubmissionRecovery";
import type { FunnelEventRecord } from "@/lib/server/funnelEventStore";
import { callSupabaseRpc } from "@/lib/server/supabaseServer";
import { QUIZ_VERSION } from "@/lib/quiz";

export async function persistGrowthFunnelEventBatch(
  sessionId: string,
  sessionStartedAt: string,
  events: FunnelEventRecord[],
): Promise<{ accepted: boolean; acceptedEvents: number }> {
  return callSupabaseRpc("ingest_growth_funnel_events", {
    p_session_key: sessionId,
    p_session_started_at: sessionStartedAt,
    p_events: events.map((event) =>
      event.page === "quiz" ? { ...event, quizVersion: QUIZ_VERSION } : event,
    ),
  });
}

export async function fetchGrowthDashboard(
  from: string,
  to: string,
): Promise<GrowthDashboardData> {
  return callSupabaseRpc<GrowthDashboardData>(
    "get_growth_dashboard",
    { p_from: from, p_to: to },
    15_000,
  );
}

export async function recordQuizLeadLink(input: {
  referenceId: string;
  funnelSessionId?: string;
  quizAttemptId?: string;
  quizVersion: string;
  scoringVersion: string;
  intent?: string;
  recommendedTherapist?: string;
  consentedAt: string;
}): Promise<void> {
  await callSupabaseRpc("record_quiz_lead_link", {
    p_reference_id: input.referenceId,
    p_funnel_session_key: input.funnelSessionId ?? null,
    p_quiz_attempt_key: input.quizAttemptId ?? null,
    p_quiz_version: input.quizVersion,
    p_scoring_version: input.scoringVersion,
    p_intent: input.intent ?? null,
    p_recommended_therapist: input.recommendedTherapist ?? null,
    p_consented_at: input.consentedAt,
  });
}

export type QuizResultStorageClaimResult = {
  accepted: boolean;
  claimed: boolean;
  reason: "claimed" | "already_ready" | "lease_active";
  clientSubmissionId: string;
  referenceId: string;
  storageStatus: "pending" | "ready" | "failed";
  sheetRowNumber?: number;
  claimToken?: string;
  leaseExpiresAt?: string;
  attemptCount: number;
  retryAfterSeconds: number;
};

export async function claimQuizResultSubmission(input: {
  clientSubmissionId: string;
  payloadHash: string;
  existingReferenceId?: string;
  leaseSeconds?: number;
  snapshot: {
    firstName: string;
    email: string;
    phone: string;
    consentedAt: string;
    privacyText: string;
    privacyTextVersion: string;
    quizVersion: string;
    scoringVersion: string;
    answers: Record<string, unknown>;
    outcome: Record<string, unknown>;
    resultCategory: string;
    scoreBand: string;
    match: Record<string, unknown>;
    recommendedTherapistSlug?: string;
    recommendedTherapistName?: string;
    intent: string;
    attribution: Record<string, unknown>;
  };
}): Promise<QuizResultStorageClaimResult> {
  return callSupabaseRpc<QuizResultStorageClaimResult>(
    "claim_quiz_result_submission_v2",
    {
      p_client_submission_id: input.clientSubmissionId,
      p_payload_hash: input.payloadHash,
      p_existing_reference_id: input.existingReferenceId ?? null,
      p_lease_seconds: input.leaseSeconds ?? 300,
      p_first_name: input.snapshot.firstName,
      p_email: input.snapshot.email,
      p_phone: input.snapshot.phone,
      p_consented_at: input.snapshot.consentedAt,
      p_privacy_text: input.snapshot.privacyText,
      p_privacy_text_version: input.snapshot.privacyTextVersion,
      p_quiz_version: input.snapshot.quizVersion,
      p_scoring_version: input.snapshot.scoringVersion,
      p_answers: input.snapshot.answers,
      p_outcome: input.snapshot.outcome,
      p_result_category: input.snapshot.resultCategory,
      p_score_band: input.snapshot.scoreBand,
      p_match: input.snapshot.match,
      p_recommended_therapist_slug:
        input.snapshot.recommendedTherapistSlug ?? null,
      p_recommended_therapist_name:
        input.snapshot.recommendedTherapistName ?? null,
      p_intent: input.snapshot.intent,
      p_attribution: input.snapshot.attribution,
    },
  );
}

export type QuizResultStorageFailureResult = {
  accepted: boolean;
  staleClaim: boolean;
  clientSubmissionId: string;
  referenceId: string;
  storageStatus: "pending" | "ready" | "failed";
  attemptCount: number;
  alertRequired: boolean;
  alertAttemptCount: number;
};

export async function recordQuizResultSubmissionFailure(input: {
  clientSubmissionId: string;
  claimToken: string;
  failureStage: string;
  failureCode: string;
}): Promise<QuizResultStorageFailureResult> {
  return callSupabaseRpc<QuizResultStorageFailureResult>(
    "record_quiz_result_submission_failure",
    {
      p_client_submission_id: input.clientSubmissionId,
      p_claim_token: input.claimToken,
      p_failure_stage: input.failureStage,
      p_failure_code: input.failureCode,
    },
  );
}

export async function completeQuizResultFailureAlert(
  clientSubmissionId: string,
  status: "sent" | "failed",
): Promise<void> {
  await callSupabaseRpc("complete_quiz_result_failure_alert", {
    p_client_submission_id: clientSubmissionId,
    p_alert_status: status,
  });
}

export async function fetchQuizSubmissionRecoveryQueue(
  limit = 100,
): Promise<QuizSubmissionRecoveryData> {
  return callSupabaseRpc<QuizSubmissionRecoveryData>(
    "get_quiz_submission_recovery_queue",
    { p_limit: limit },
    15_000,
  );
}

export type QuizResultStorageCompletionResult = {
  accepted: boolean;
  staleClaim: boolean;
  clientSubmissionId: string;
  referenceId: string;
  storageStatus: "ready" | "failed" | "pending";
  sheetRowNumber?: number;
  attemptCount: number;
};

export async function completeQuizResultSubmissionStorage(input: {
  clientSubmissionId: string;
  claimToken: string;
  status: "ready" | "failed";
  sheetRowNumber?: number;
}): Promise<QuizResultStorageCompletionResult> {
  return callSupabaseRpc<QuizResultStorageCompletionResult>(
    "complete_quiz_result_submission_storage",
    {
      p_client_submission_id: input.clientSubmissionId,
      p_claim_token: input.claimToken,
      p_storage_status: input.status,
      p_sheet_row_number: input.sheetRowNumber ?? null,
    },
  );
}

export type QuizResultEmailDeliveryKind =
  | "internal_results"
  | "visitor_results";

export type QuizResultEmailClaimResult = {
  accepted: boolean;
  claimed: boolean;
  reason: "claimed" | "already_sent" | "lease_active";
  alreadySent: boolean;
  referenceId: string;
  deliveryKind: QuizResultEmailDeliveryKind;
  deliveryStatus: "pending" | "sent" | "failed";
  claimToken?: string;
  leaseExpiresAt?: string;
  attemptCount: number;
  retryAfterSeconds: number;
};

export async function claimQuizResultEmailDelivery(input: {
  referenceId: string;
  deliveryKind: QuizResultEmailDeliveryKind;
  knownSent: boolean;
  leaseSeconds?: number;
}): Promise<QuizResultEmailClaimResult> {
  return callSupabaseRpc<QuizResultEmailClaimResult>(
    "claim_quiz_result_email_delivery",
    {
      p_reference_id: input.referenceId,
      p_delivery_kind: input.deliveryKind,
      p_known_sent: input.knownSent,
      p_lease_seconds: input.leaseSeconds ?? 300,
    },
  );
}

export type QuizResultEmailCompletionResult = {
  accepted: boolean;
  staleClaim: boolean;
  referenceId: string;
  deliveryKind: QuizResultEmailDeliveryKind;
  deliveryStatus: "sent" | "failed" | "pending";
  attemptCount: number;
  sentAt?: string;
};

export async function completeQuizResultEmailDelivery(input: {
  referenceId: string;
  deliveryKind: QuizResultEmailDeliveryKind;
  claimToken: string;
  status: "sent" | "failed";
}): Promise<QuizResultEmailCompletionResult> {
  return callSupabaseRpc<QuizResultEmailCompletionResult>(
    "complete_quiz_result_email_delivery",
    {
      p_reference_id: input.referenceId,
      p_delivery_kind: input.deliveryKind,
      p_claim_token: input.claimToken,
      p_delivery_status: input.status,
    },
  );
}

export type ConsultationLeadRecordInput = {
  consultationReferenceId?: string;
  quizReferenceId?: string;
  clientSubmissionId?: string;
  firstName: string;
  lastName?: string;
  email: string;
  phone: string;
  therapyType?: string;
  preferredTherapist?: string;
  preferredDays?: string;
  preferredTime?: string;
  coordinationDetails?: string;
  consentText: string;
  consentVersion: string;
  consentedAt: string;
  sourceKind: ConsultationSourceKind;
  sourceDetail?: string;
  checkpointCode?: string;
  checkpointPlacementId?: string;
  checkpointSessionId?: string;
  funnelSessionId?: string;
  attribution?: CampaignAttribution;
  referrerHost?: string;
  notificationStatus: "pending" | "sent" | "failed" | "unknown";
  submittedAt: string;
};

export type ConsultationLeadRecordResult = {
  accepted: boolean;
  created: boolean;
  leadId: string;
  referenceId: string;
  consultationReferenceId?: string | null;
  quizReferenceId?: string | null;
  requestNotificationStatus: "pending" | "sent" | "failed" | "unknown";
  rowVersion: number;
};

export async function upsertConsultationLead(
  input: ConsultationLeadRecordInput,
): Promise<ConsultationLeadRecordResult> {
  return callSupabaseRpc("upsert_consultation_lead", {
    p_consultation_reference_id: input.consultationReferenceId ?? null,
    p_quiz_reference_id: input.quizReferenceId ?? null,
    p_client_submission_id: input.clientSubmissionId ?? null,
    p_first_name: input.firstName,
    p_last_name: input.lastName ?? null,
    p_email: input.email,
    p_phone: input.phone,
    p_therapy_type: input.therapyType ?? null,
    p_preferred_therapist: input.preferredTherapist ?? null,
    p_preferred_days: input.preferredDays ?? null,
    p_preferred_time: input.preferredTime ?? null,
    p_coordination_details: input.coordinationDetails ?? null,
    p_consent_text: input.consentText,
    p_consent_version: input.consentVersion,
    p_consented_at: input.consentedAt,
    p_source_kind: input.sourceKind,
    p_source_detail: input.sourceDetail ?? null,
    p_checkpoint_code: input.checkpointCode ?? null,
    p_checkpoint_placement_id: input.checkpointPlacementId ?? null,
    p_checkpoint_session_key: input.checkpointSessionId ?? null,
    p_funnel_session_key: input.funnelSessionId ?? null,
    p_utm_source: input.attribution?.source ?? null,
    p_utm_medium: input.attribution?.medium ?? null,
    p_utm_campaign: input.attribution?.campaign ?? null,
    p_utm_content: input.attribution?.content ?? null,
    p_referrer_host: input.referrerHost ?? null,
    p_notification_status: input.notificationStatus,
    p_submitted_at: input.submittedAt,
  });
}

export async function setConsultationNotificationStatus(
  leadId: string,
  requestReference: string,
  status: "pending" | "sent" | "failed" | "unknown",
): Promise<void> {
  await callSupabaseRpc("set_consultation_notification_status", {
    p_lead_id: leadId,
    p_request_reference: requestReference,
    p_notification_status: status,
  });
}

export type ConsultationNotificationClaimResult = {
  accepted: boolean;
  claimed: boolean;
  reason: "claimed" | "already_sent" | "lease_active";
  alreadySent: boolean;
  leadId: string;
  requestReference: string;
  claimToken?: string;
  requestNotificationStatus: "pending" | "sent" | "failed" | "unknown";
  leaseExpiresAt?: string;
  attemptCount: number;
  retryAfterSeconds: number;
  rowVersion: number;
};

export async function claimConsultationNotification(
  leadId: string,
  requestReference: string,
  leaseSeconds = 300,
): Promise<ConsultationNotificationClaimResult> {
  return callSupabaseRpc<ConsultationNotificationClaimResult>(
    "claim_consultation_notification",
    {
      p_lead_id: leadId,
      p_request_reference: requestReference,
      p_lease_seconds: leaseSeconds,
    },
  );
}

export type ConsultationNotificationCompletionResult = {
  accepted: boolean;
  staleClaim: boolean;
  leadId: string;
  requestReference: string;
  requestNotificationStatus: "sent" | "failed" | "pending" | "unknown";
  notificationStatus?: "sent" | "failed" | "pending" | "unknown";
  attemptCount: number;
  rowVersion?: number;
};

export async function completeConsultationNotificationClaim(
  leadId: string,
  requestReference: string,
  claimToken: string,
  status: "sent" | "failed",
): Promise<ConsultationNotificationCompletionResult> {
  return callSupabaseRpc<ConsultationNotificationCompletionResult>(
    "complete_consultation_notification_claim",
    {
      p_lead_id: leadId,
      p_request_reference: requestReference,
      p_claim_token: claimToken,
      p_notification_status: status,
    },
  );
}

export type ConsultationAttributionRepairResult = {
  accepted: boolean;
  verified: boolean;
  leadId: string;
  requestReference: string;
  checkpointCode?: string | null;
  placementId?: string | null;
  sessionId?: string | null;
  rowVersion: number;
};

export async function repairConsultationRequestAttribution(
  requestReference: string,
): Promise<ConsultationAttributionRepairResult> {
  return callSupabaseRpc<ConsultationAttributionRepairResult>(
    "repair_consultation_request_attribution",
    { p_request_reference: requestReference },
  );
}

export async function fetchConsultationManager(input: {
  from: string;
  to: string;
  workflowStatus?: ConsultationWorkflowStatus;
  conversionStage?: ConsultationConversionStage;
  source?: ConsultationSourceKind;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<ConsultationManagerData> {
  return callSupabaseRpc<ConsultationManagerData>(
    "get_consultation_manager",
    {
      p_from: input.from,
      p_to: input.to,
      p_workflow_status: input.workflowStatus ?? null,
      p_conversion_stage: input.conversionStage ?? null,
      p_source_kind: input.source ?? null,
      p_search: input.search ?? null,
      p_limit: input.limit ?? 50,
      p_offset: input.offset ?? 0,
    },
    15_000,
  );
}

export type ConsultationLeadUpdateResult = {
  accepted: boolean;
  conflict: boolean;
  leadId: string;
  currentVersion?: number;
  workflowStatus?: ConsultationWorkflowStatus;
  conversionStage?: ConsultationConversionStage;
  bookedAt?: string | null;
  paidTherapyAt?: string | null;
  rowVersion?: number;
  updatedAt?: string;
};

export async function updateConsultationLead(input: {
  leadId: string;
  expectedVersion: number;
  workflowStatus: ConsultationWorkflowStatus;
  conversionStage: ConsultationConversionStage;
  note?: string;
  actorReference?: string;
}): Promise<ConsultationLeadUpdateResult> {
  return callSupabaseRpc("update_consultation_lead", {
    p_lead_id: input.leadId,
    p_expected_version: input.expectedVersion,
    p_workflow_status: input.workflowStatus,
    p_conversion_stage: input.conversionStage,
    p_note: input.note ?? null,
    p_actor_reference: input.actorReference ?? "shared-admin-session",
  });
}

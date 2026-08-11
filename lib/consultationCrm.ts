export const CONSULTATION_WORKFLOW_STATUSES = [
  "new",
  "in_progress",
  "waiting_on_client",
  "closed_won",
  "closed_lost",
  "closed_unknown",
  "duplicate",
] as const;

export type ConsultationWorkflowStatus =
  (typeof CONSULTATION_WORKFLOW_STATUSES)[number];

export const CONSULTATION_CONVERSION_STAGES = [
  "consultation_requested",
  "consultation_booked",
  "paid_therapy",
] as const;

export type ConsultationConversionStage =
  (typeof CONSULTATION_CONVERSION_STAGES)[number];

export const CONSULTATION_SOURCE_KINDS = [
  "mental_battery_checkpoint",
  "quiz",
  "direct",
  "therapist",
  "possibility_builder",
  "website",
  "other",
] as const;

export const CONSULTATION_SOURCE_DETAILS = [
  "direct",
  "website",
  "therapist_profile",
  "therapist_card",
  "profile_card",
  "directory_mobile",
  "directory_help",
  "finder_result",
  "finder_mobile",
  "finder_help",
  "comparison",
  "possibility_result",
  "possibility_mobile",
  "possibility_help",
  "quiz_result",
  "quiz_results_email",
  "mental_battery_checkpoint",
  "legacy_intake",
  "legacy_booking",
] as const;

export type ConsultationSourceDetail =
  (typeof CONSULTATION_SOURCE_DETAILS)[number];

export type ConsultationSourceKind =
  (typeof CONSULTATION_SOURCE_KINDS)[number];

export type ConsultationLead = {
  id: string;
  referenceId: string;
  consultationReferenceId?: string | null;
  quizReferenceId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  therapyType?: string | null;
  preferredTherapist?: string | null;
  preferredDays?: string | null;
  preferredTime?: string | null;
  coordinationDetails?: string | null;
  source: ConsultationSourceKind;
  sourceDetail?: string | null;
  checkpointCode?: string | null;
  checkpointPlacementId?: string | null;
  checkpointSessionId?: string | null;
  attributionVerified?: boolean;
  attributionPending?: boolean;
  funnelSessionId?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  referrerHost?: string | null;
  workflowStatus: ConsultationWorkflowStatus;
  conversionStage: ConsultationConversionStage;
  bookedAt?: string | null;
  paidTherapyAt?: string | null;
  closeReason?: string | null;
  adminNote?: string | null;
  notificationStatus: "pending" | "sent" | "failed" | "unknown";
  notificationAttemptCount?: number;
  submittedAt: string;
  latestRequestAt?: string | null;
  inSelectedRange?: boolean;
  lastActivityAt: string;
  rowVersion: number;
  requestCount?: number;
  history?: ConsultationLeadHistoryEntry[];
};

export type ConsultationLeadHistoryEntry = {
  id: string;
  eventType: string;
  fromWorkflowStatus?: ConsultationWorkflowStatus | null;
  toWorkflowStatus?: ConsultationWorkflowStatus | null;
  fromConversionStage?: ConsultationConversionStage | null;
  toConversionStage?: ConsultationConversionStage | null;
  note?: string | null;
  actorKind: "system" | "admin";
  actorReference?: string | null;
  recordedAt: string;
};

export type ConsultationManagerKpis = {
  submissions: number;
  opportunities: number;
  requests: number;
  newOpportunities: number;
  newRequests: number;
  activeOpportunities: number;
  activeRequests: number;
  booked: number;
  paidTherapy: number;
  lost: number;
  unknownOutcome: number;
  pendingAttribution: number;
  opportunityToBookingRate: number;
  requestToBookingRate: number;
  bookingToPaidTherapyRate: number;
};

export type ConsultationSourceMetric = {
  source: ConsultationSourceKind;
  submissions: number;
  opportunities: number;
  requests: number;
  booked: number;
  paidTherapy: number;
  bookingRate: number;
  paidTherapyRate: number;
};

export type ConsultationManagerData = {
  generatedAt: string;
  range: { from: string; to: string };
  kpis: ConsultationManagerKpis;
  totalCount: number;
  openCarryoverCount: number;
  limit: number;
  offset: number;
  sources: ConsultationSourceMetric[];
  leads: ConsultationLead[];
};

export type ConsultationLeadUpdate = {
  workflowStatus: ConsultationWorkflowStatus;
  conversionStage: ConsultationConversionStage;
  note?: string;
  expectedVersion: number;
};

export const WORKFLOW_STATUS_LABELS: Record<
  ConsultationWorkflowStatus,
  string
> = {
  new: "New",
  in_progress: "In progress",
  waiting_on_client: "Waiting on client",
  closed_won: "Closed · converted",
  closed_lost: "Closed · not converted",
  closed_unknown: "Closed · outcome unknown",
  duplicate: "Duplicate",
};

export const CONVERSION_STAGE_LABELS: Record<
  ConsultationConversionStage,
  string
> = {
  consultation_requested: "Consultation requested",
  consultation_booked: "Consultation booked",
  paid_therapy: "Paid therapy",
};

export const SOURCE_KIND_LABELS: Record<ConsultationSourceKind, string> = {
  mental_battery_checkpoint: "Mental Battery",
  quiz: "Therapist quiz",
  direct: "Direct",
  therapist: "Therapist page",
  possibility_builder: "Possibility Builder",
  website: "Website",
  other: "Other",
};

export function isConsultationWorkflowStatus(
  value: unknown,
): value is ConsultationWorkflowStatus {
  return (
    typeof value === "string" &&
    (CONSULTATION_WORKFLOW_STATUSES as readonly string[]).includes(value)
  );
}

export function isConsultationConversionStage(
  value: unknown,
): value is ConsultationConversionStage {
  return (
    typeof value === "string" &&
    (CONSULTATION_CONVERSION_STAGES as readonly string[]).includes(value)
  );
}

export function isConsultationSourceKind(
  value: unknown,
): value is ConsultationSourceKind {
  return (
    typeof value === "string" &&
    (CONSULTATION_SOURCE_KINDS as readonly string[]).includes(value)
  );
}

export function sourceKindFromDetail(
  source: string,
  options: { quizVerified?: boolean; checkpoint?: boolean } = {},
): ConsultationSourceKind {
  if (options.checkpoint) return "mental_battery_checkpoint";
  if (options.quizVerified) return "quiz";
  if (source === "direct") return "direct";
  if (
    [
      "therapist_profile",
      "therapist_card",
      "profile_card",
      "directory_mobile",
      "directory_help",
      "finder_result",
      "finder_mobile",
      "finder_help",
      "comparison",
    ].includes(source)
  ) return "therapist";
  if (["possibility_result", "possibility_mobile", "possibility_help"].includes(source)) {
    return "possibility_builder";
  }
  if (source) return "website";
  return "other";
}

export function isConsultationSourceDetail(
  value: unknown,
): value is ConsultationSourceDetail {
  return (
    typeof value === "string" &&
    (CONSULTATION_SOURCE_DETAILS as readonly string[]).includes(value)
  );
}

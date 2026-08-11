import {
  isConsultationConversionStage,
  isConsultationWorkflowStatus,
  type ConsultationLeadUpdate,
} from "@/lib/consultationCrm";

const UPDATE_KEYS = new Set([
  "workflowStatus",
  "conversionStage",
  "expectedVersion",
  "note",
]);

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function parseConsultationLeadUpdate(
  input: unknown,
): { value?: ConsultationLeadUpdate; error?: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { error: "Invalid consultation update." };
  }

  const candidate = input as Record<string, unknown>;
  if (
    Object.keys(candidate).some((key) => !UPDATE_KEYS.has(key)) ||
    !Object.hasOwn(candidate, "workflowStatus") ||
    !Object.hasOwn(candidate, "conversionStage") ||
    !Object.hasOwn(candidate, "expectedVersion")
  ) {
    return { error: "Invalid consultation update fields." };
  }
  if (!isConsultationWorkflowStatus(candidate.workflowStatus)) {
    return { error: "Choose a valid workflow status." };
  }
  if (!isConsultationConversionStage(candidate.conversionStage)) {
    return { error: "Choose a valid conversion stage." };
  }
  if (
    typeof candidate.expectedVersion !== "number" ||
    !Number.isSafeInteger(candidate.expectedVersion) ||
    candidate.expectedVersion < 1 ||
    candidate.expectedVersion > 2_147_483_647
  ) {
    return { error: "The consultation record version is invalid." };
  }
  if (candidate.note !== undefined && typeof candidate.note !== "string") {
    return { error: "The update note must be text." };
  }
  if (
    candidate.conversionStage === "paid_therapy" &&
    candidate.workflowStatus !== "closed_won"
  ) {
    return {
      error: "Paid therapy must use the converted workflow outcome.",
    };
  }

  const note = typeof candidate.note === "string"
    ? candidate.note
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
        .replace(/\r\n?/g, "\n")
        .trim()
    : "";
  if (note.length > 500) {
    return { error: "The update note must be 500 characters or fewer." };
  }

  return {
    value: {
      workflowStatus: candidate.workflowStatus,
      conversionStage: candidate.conversionStage,
      expectedVersion: candidate.expectedVersion,
      ...(note ? { note } : {}),
    },
  };
}

export type ValidatedMoveCheckpoint = {
  partnerName: string;
  locationName: string;
  locationNotes?: string;
  effectiveAt: string;
};

const MOVE_KEYS = new Set([
  "partnerName",
  "locationName",
  "locationNotes",
  "effectiveAt",
]);

function cleanSingleLine(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanNotes(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n?/g, "\n")
    .trim()
    .slice(0, 500);
}

export function parseMoveCheckpointInput(
  input: unknown,
  now = new Date(),
): { value?: ValidatedMoveCheckpoint; error?: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { error: "Invalid placement request." };
  }
  const candidate = input as Record<string, unknown>;
  if (Object.keys(candidate).some((key) => !MOVE_KEYS.has(key))) {
    return { error: "Invalid placement request fields." };
  }
  const partnerName = cleanSingleLine(candidate.partnerName, 120);
  const locationName = cleanSingleLine(candidate.locationName, 160);
  const locationNotes = cleanNotes(candidate.locationNotes);
  if (!partnerName || !locationName) {
    return { error: "Partner and location names are required." };
  }
  if (typeof candidate.effectiveAt !== "string") {
    return { error: "An effective date is required." };
  }
  const effectiveAt = new Date(candidate.effectiveAt);
  const earliest = now.getTime() - 5 * 60 * 1000;
  const latest = now.getTime() + 366 * 24 * 60 * 60 * 1000;
  if (
    Number.isNaN(effectiveAt.getTime()) ||
    effectiveAt.getTime() < earliest ||
    effectiveAt.getTime() > latest
  ) {
    return {
      error:
        "Effective time must be between five minutes ago and one year from now.",
    };
  }
  return {
    value: {
      partnerName,
      locationName,
      ...(locationNotes ? { locationNotes } : {}),
      effectiveAt: effectiveAt.toISOString(),
    },
  };
}

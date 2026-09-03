import {
  GOOGLE_ADS_EVENT_NAMES,
  GOOGLE_ADS_CTA_PLACEMENTS,
  GOOGLE_ADS_FORM_FIELD_IDS,
  GOOGLE_ADS_TARGET_TYPES,
  GOOGLE_ADS_TRACKED_PATHS,
  GOOGLE_ADS_JOURNEY_MAX_AGE_MS,
  confirmedConsultationReferenceIsValid,
  googleAdsEventIdIsValid,
  googleAdsSessionIdIsValid,
  isGoogleAdsSectionId,
  type GoogleAdsEventName,
  type GoogleAdsTargetType,
} from "@/lib/googleAdsJourney";

const MAX_SESSION_AGE_MS = GOOGLE_ADS_JOURNEY_MAX_AGE_MS;
const MAX_FUTURE_SKEW_MS = 10 * 60 * 1000;
const MAX_EVENT_SEQUENCE = 1_000_000;
const MAX_ELAPSED_MS = MAX_SESSION_AGE_MS;
const EVENT_BEFORE_SESSION_TOLERANCE_MS = 5 * 60 * 1000;

/**
 * Client clocks drift. A batch reports the browser's own send time so the
 * server can rebase every timestamp before validating it; without this, a
 * phone whose clock is fifteen minutes ahead would have every event rejected.
 */
export const GOOGLE_ADS_CLOCK_SKEW_TOLERANCE_MS = 60_000;
const MAX_CLOCK_SKEW_MS = 366 * 24 * 60 * 60 * 1000;

const TOP_LEVEL_KEYS = new Set([
  "sessionId",
  "sessionStartedAt",
  "landingPath",
  "events",
  "sentAt",
]);

const EVENT_KEYS = new Set([
  "eventId",
  "sequence",
  "occurredAt",
  "event",
  "path",
  "sectionId",
  "targetType",
  "targetPath",
  "targetId",
  "ctaPlacement",
  "therapistId",
  "engagedMs",
  "scrollDepth",
  "formStep",
  "submissionReference",
  "elapsedMs",
  "deviceCategory",
  "utmSource",
  "utmMedium",
  "utmCampaign",
  "utmContent",
  "googleClickIdPresent",
  "referrerHost",
]);

const EVENT_NAMES = new Set<string>(GOOGLE_ADS_EVENT_NAMES);
const CTA_PLACEMENTS = new Set<string>(GOOGLE_ADS_CTA_PLACEMENTS);
const TARGET_TYPES = new Set<string>(GOOGLE_ADS_TARGET_TYPES);
const TRACKED_PATHS = new Set<string>(GOOGLE_ADS_TRACKED_PATHS);
const FORM_FIELD_IDS = new Set<string>(GOOGLE_ADS_FORM_FIELD_IDS);
const CLICK_EVENTS = new Set<GoogleAdsEventName>([
  "internal_link_clicked",
  "control_clicked",
  "consultation_cta_clicked",
  "phone_clicked",
  "email_clicked",
  "therapist_profile_clicked",
  "quiz_clicked",
  "external_link_clicked",
]);
const CONSULTATION_PATHS = new Set([
  "/consultation",
  "/book-consultation",
  "/get-matched",
  "/intake",
]);
const SCROLL_DEPTHS = new Set([25, 50, 75, 100]);
const DEVICE_CATEGORIES = new Set(["mobile", "tablet", "desktop"]);

export type GoogleAdsDeviceCategory = "mobile" | "tablet" | "desktop";

export type GoogleAdsEventRecord = {
  eventId: string;
  sequence: number;
  occurredAt: string;
  event: GoogleAdsEventName;
  path: string;
  sectionId?: string;
  targetType?: GoogleAdsTargetType;
  targetPath?: string;
  targetId?: string;
  ctaPlacement?: string;
  therapistId?: string;
  engagedMs?: number;
  scrollDepth?: 25 | 50 | 75 | 100;
  formStep?: 1 | 2;
  submissionReference?: string;
  elapsedMs: number;
  deviceCategory: GoogleAdsDeviceCategory;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  googleClickIdPresent: boolean;
  referrerHost?: string;
};

export type GoogleAdsEventBatch = {
  sessionId: string;
  sessionStartedAt: string;
  landingPath: string;
  events: GoogleAdsEventRecord[];
};

export type GoogleAdsEventBatchResult = {
  batch: GoogleAdsEventBatch | null;
  /** Individually invalid events that were dropped instead of failing the batch. */
  rejectedEvents: number;
  /** Milliseconds added to every client timestamp (0 when within tolerance). */
  clockSkewMs: number;
};

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.length ? value : undefined;
}

function isTrackedPath(value: unknown): value is string {
  return typeof value === "string" && TRACKED_PATHS.has(value);
}

/**
 * Campaign values are identifiers, not a free-text field. Invalid values are
 * discarded rather than rejecting the anonymous event batch, so a malformed
 * UTM cannot become storage and also cannot break the visitor journey.
 */
function safeCampaignDimension(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (
    !normalized ||
    normalized.length > 120 ||
    /[@/?#&=\\]/.test(normalized) ||
    !/^[\p{L}\p{N}][\p{L}\p{N} ._~:+()\[\]-]*$/u.test(normalized)
  ) {
    return undefined;
  }
  return normalized;
}

function safeReferrerHost(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (
    normalized.length < 1 ||
    normalized.length > 120 ||
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,62})\.)*[a-z0-9](?:[a-z0-9-]{0,62})$/.test(
      normalized,
    )
  ) {
    return undefined;
  }
  return normalized;
}

function validTargetShape(event: GoogleAdsEventRecord): boolean {
  const hasTarget = Boolean(
    event.targetType || event.targetPath || event.targetId,
  );
  if (
    !CLICK_EVENTS.has(event.event) &&
    event.event !== "form_field_focused" &&
    event.event !== "consultation_validation_failed"
  ) {
    return !hasTarget;
  }

  switch (event.event) {
    case "internal_link_clicked":
      return (
        event.targetType === "navigation" &&
        Boolean(event.targetPath) &&
        !event.targetId
      );
    case "control_clicked":
      return (
        event.targetType === "button" &&
        (event.targetId === "button" || event.targetId === "submit") &&
        !event.targetPath
      );
    case "consultation_cta_clicked":
      return (
        event.targetType === "consultation" &&
        Boolean(event.targetPath && CONSULTATION_PATHS.has(event.targetPath)) &&
        !event.targetId
      );
    case "phone_clicked":
      return event.targetType === "phone" && !event.targetPath && !event.targetId;
    case "email_clicked":
      return event.targetType === "email" && !event.targetPath && !event.targetId;
    case "therapist_profile_clicked":
      return (
        event.targetType === "therapist" &&
        Boolean(event.targetPath?.startsWith("/therapists/")) &&
        event.therapistId === event.targetPath?.slice("/therapists/".length) &&
        !event.targetId
      );
    case "quiz_clicked":
      return event.targetType === "quiz" && event.targetPath === "/quiz" && !event.targetId;
    case "external_link_clicked":
      return event.targetType === "external" && !event.targetPath && !event.targetId;
    case "form_field_focused":
      return (
        event.path === "/consultation" &&
        event.targetType === "form_field" &&
        Boolean(event.targetId && FORM_FIELD_IDS.has(event.targetId)) &&
        !event.targetPath
      );
    case "consultation_validation_failed":
      return (
        !hasTarget ||
        (event.targetType === "form_field" &&
          Boolean(event.targetId && FORM_FIELD_IDS.has(event.targetId)) &&
          !event.targetPath)
      );
    default:
      return false;
  }
}

function validEventSpecificShape(event: GoogleAdsEventRecord): boolean {
  if (event.event === "section_viewed" && !event.sectionId) return false;
  if (event.event === "engagement_ping") {
    if (!event.engagedMs || event.engagedMs > 60_000) return false;
  } else if (event.engagedMs !== undefined) {
    return false;
  }
  if (event.event === "scroll_depth_reached") {
    if (!event.scrollDepth) return false;
  } else if (event.scrollDepth !== undefined) {
    return false;
  }
  if (event.event === "consultation_step_viewed") {
    if (!event.formStep) return false;
  } else if (
    event.formStep !== undefined &&
    ![
      "form_started",
      "consultation_validation_failed",
      "consultation_submitted",
    ].includes(event.event)
  ) {
    return false;
  }
  if (
    [
      "form_started",
      "form_field_focused",
      "consultation_step_viewed",
      "consultation_validation_failed",
      "consultation_submitted",
    ].includes(event.event) &&
    event.path !== "/consultation"
  ) {
    return false;
  }
  if (event.event === "thank_you_viewed" && event.path !== "/thank-you") {
    return false;
  }
  if (
    event.submissionReference !== undefined &&
    event.event !== "consultation_submitted"
  ) {
    return false;
  }
  if (event.ctaPlacement !== undefined && !CLICK_EVENTS.has(event.event)) {
    return false;
  }
  if (
    event.therapistId !== undefined &&
    event.event !== "therapist_profile_clicked"
  ) {
    return false;
  }
  return validTargetShape(event);
}

export function parseGoogleAdsEvent(input: unknown): GoogleAdsEventRecord | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  if (Object.keys(raw).some((key) => !EVENT_KEYS.has(key))) return null;

  const occurredTime =
    typeof raw.occurredAt === "string" ? Date.parse(raw.occurredAt) : NaN;
  const eventName = typeof raw.event === "string" ? raw.event : "";
  const targetType = optionalText(raw.targetType);
  const targetPath = optionalText(raw.targetPath);
  const targetId = optionalText(raw.targetId);
  const sectionId = optionalText(raw.sectionId);
  const ctaPlacement = optionalText(raw.ctaPlacement);
  const therapistId = optionalText(raw.therapistId);
  const submissionReference = optionalText(raw.submissionReference);
  const deviceCategory = optionalText(raw.deviceCategory);
  const utmSource = safeCampaignDimension(raw.utmSource);
  const utmMedium = safeCampaignDimension(raw.utmMedium);
  const utmCampaign = safeCampaignDimension(raw.utmCampaign);
  const utmContent = safeCampaignDimension(raw.utmContent);
  const referrerHost = safeReferrerHost(raw.referrerHost);
  const now = Date.now();

  if (
    !googleAdsEventIdIsValid(raw.eventId) ||
    typeof raw.sequence !== "number" ||
    !Number.isInteger(raw.sequence) ||
    raw.sequence < 1 ||
    raw.sequence > MAX_EVENT_SEQUENCE ||
    !Number.isFinite(occurredTime) ||
    occurredTime < now - MAX_SESSION_AGE_MS - 5 * 60 * 1000 ||
    occurredTime > now + MAX_FUTURE_SKEW_MS ||
    !EVENT_NAMES.has(eventName) ||
    !isTrackedPath(raw.path) ||
    (sectionId !== undefined && !isGoogleAdsSectionId(sectionId)) ||
    (targetType !== undefined && !TARGET_TYPES.has(targetType)) ||
    (targetPath !== undefined && !isTrackedPath(targetPath)) ||
    (targetId !== undefined &&
      !FORM_FIELD_IDS.has(targetId) &&
      targetId !== "button" &&
      targetId !== "submit") ||
    (ctaPlacement !== undefined &&
      !CTA_PLACEMENTS.has(ctaPlacement)) ||
    (therapistId !== undefined &&
      (therapistId.length > 80 || !/^[a-z0-9-]+$/.test(therapistId))) ||
    (raw.engagedMs !== undefined &&
      (typeof raw.engagedMs !== "number" ||
        !Number.isInteger(raw.engagedMs) ||
        raw.engagedMs < 1 ||
        raw.engagedMs > 60_000)) ||
    (raw.scrollDepth !== undefined &&
      (typeof raw.scrollDepth !== "number" ||
        !SCROLL_DEPTHS.has(raw.scrollDepth))) ||
    (raw.formStep !== undefined &&
      (typeof raw.formStep !== "number" ||
        !Number.isInteger(raw.formStep) ||
        (raw.formStep !== 1 && raw.formStep !== 2))) ||
    (submissionReference !== undefined &&
      !confirmedConsultationReferenceIsValid(submissionReference)) ||
    typeof raw.elapsedMs !== "number" ||
    !Number.isInteger(raw.elapsedMs) ||
    raw.elapsedMs < 0 ||
    raw.elapsedMs > MAX_ELAPSED_MS ||
    !deviceCategory ||
    !DEVICE_CATEGORIES.has(deviceCategory) ||
    typeof raw.googleClickIdPresent !== "boolean"
  ) {
    return null;
  }

  const parsed: GoogleAdsEventRecord = {
    eventId: raw.eventId,
    sequence: raw.sequence,
    occurredAt: new Date(occurredTime).toISOString(),
    event: eventName as GoogleAdsEventName,
    path: raw.path,
    ...(sectionId ? { sectionId } : {}),
    ...(targetType ? { targetType: targetType as GoogleAdsTargetType } : {}),
    ...(targetPath ? { targetPath } : {}),
    ...(targetId ? { targetId } : {}),
    ...(ctaPlacement ? { ctaPlacement } : {}),
    ...(therapistId ? { therapistId } : {}),
    ...(raw.engagedMs !== undefined ? { engagedMs: raw.engagedMs as number } : {}),
    ...(raw.scrollDepth !== undefined
      ? { scrollDepth: raw.scrollDepth as 25 | 50 | 75 | 100 }
      : {}),
    ...(raw.formStep !== undefined
      ? { formStep: raw.formStep as 1 | 2 }
      : {}),
    ...(submissionReference ? { submissionReference } : {}),
    elapsedMs: raw.elapsedMs,
    deviceCategory: deviceCategory as GoogleAdsDeviceCategory,
    ...(utmSource ? { utmSource } : {}),
    ...(utmMedium ? { utmMedium } : {}),
    ...(utmCampaign ? { utmCampaign } : {}),
    ...(utmContent ? { utmContent } : {}),
    googleClickIdPresent: raw.googleClickIdPresent,
    ...(referrerHost ? { referrerHost } : {}),
  };
  return validEventSpecificShape(parsed) ? parsed : null;
}

type ParsedEnvelope = {
  sessionId: string;
  sessionStart: number;
  landingPath: string;
  events: unknown[];
  sentAt?: number;
};

function parseEnvelope(
  input: unknown,
  maximumEvents: number,
  now: number,
): ParsedEnvelope | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  if (Object.keys(raw).some((key) => !TOP_LEVEL_KEYS.has(key))) return null;
  const sessionStart =
    typeof raw.sessionStartedAt === "string"
      ? Date.parse(raw.sessionStartedAt)
      : NaN;
  if (
    !googleAdsSessionIdIsValid(raw.sessionId) ||
    !Number.isFinite(sessionStart) ||
    sessionStart < now - MAX_SESSION_AGE_MS ||
    sessionStart > now + MAX_FUTURE_SKEW_MS ||
    !isTrackedPath(raw.landingPath) ||
    !Array.isArray(raw.events) ||
    raw.events.length < 1 ||
    raw.events.length > maximumEvents ||
    (raw.sentAt !== undefined &&
      (typeof raw.sentAt !== "number" || !Number.isFinite(raw.sentAt)))
  ) {
    return null;
  }
  return {
    sessionId: raw.sessionId,
    sessionStart,
    landingPath: raw.landingPath,
    events: raw.events,
    sentAt: typeof raw.sentAt === "number" ? raw.sentAt : undefined,
  };
}

/** Strict form: any invalid event rejects the whole batch. */
export function parseGoogleAdsEventBatch(
  input: unknown,
  maximumEvents = 20,
): GoogleAdsEventBatch | null {
  const envelope = parseEnvelope(input, maximumEvents, Date.now());
  if (!envelope) return null;

  const events = envelope.events.map(parseGoogleAdsEvent);
  if (events.some((event) => event === null)) return null;
  const parsedEvents = events as GoogleAdsEventRecord[];
  if (
    new Set(parsedEvents.map((event) => event.eventId)).size !==
      parsedEvents.length ||
    new Set(parsedEvents.map((event) => event.sequence)).size !==
      parsedEvents.length ||
    parsedEvents.some(
      (event) =>
        Date.parse(event.occurredAt) <
        envelope.sessionStart - EVENT_BEFORE_SESSION_TOLERANCE_MS,
    )
  ) {
    return null;
  }

  return {
    sessionId: envelope.sessionId,
    sessionStartedAt: new Date(envelope.sessionStart).toISOString(),
    landingPath: envelope.landingPath,
    events: parsedEvents,
  };
}

function rebaseEvent(
  input: unknown,
  skewMs: number,
  sessionStart: number,
): unknown {
  if (!skewMs || !input || typeof input !== "object" || Array.isArray(input)) {
    return input;
  }
  const raw = input as Record<string, unknown>;
  const occurredTime =
    typeof raw.occurredAt === "string" ? Date.parse(raw.occurredAt) : NaN;
  if (!Number.isFinite(occurredTime)) return input;
  const adjusted = occurredTime + skewMs;
  return {
    ...raw,
    occurredAt: new Date(adjusted).toISOString(),
    elapsedMs: Math.max(0, Math.min(MAX_ELAPSED_MS, Math.round(adjusted - sessionStart))),
  };
}

/**
 * Tolerant form used by the live endpoint. One malformed event no longer
 * discards the twenty valid ones queued beside it (and with them the whole
 * session), and client clock drift is corrected before validation.
 */
export function parseGoogleAdsEventBatchLenient(
  input: unknown,
  maximumEvents = 20,
  now = Date.now(),
): GoogleAdsEventBatchResult {
  const envelope = parseEnvelope(input, maximumEvents, now);
  if (!envelope) return { batch: null, rejectedEvents: 0, clockSkewMs: 0 };

  let clockSkewMs = 0;
  if (envelope.sentAt !== undefined) {
    const skew = now - envelope.sentAt;
    if (
      Math.abs(skew) > GOOGLE_ADS_CLOCK_SKEW_TOLERANCE_MS &&
      Math.abs(skew) <= MAX_CLOCK_SKEW_MS
    ) {
      clockSkewMs = Math.round(skew);
    }
  }

  const seenIds = new Set<string>();
  const seenSequences = new Set<number>();
  const events: GoogleAdsEventRecord[] = [];
  let rejectedEvents = 0;
  for (const candidate of envelope.events) {
    const parsed = parseGoogleAdsEvent(
      rebaseEvent(candidate, clockSkewMs, envelope.sessionStart),
    );
    if (
      !parsed ||
      seenIds.has(parsed.eventId) ||
      seenSequences.has(parsed.sequence) ||
      Date.parse(parsed.occurredAt) <
        envelope.sessionStart - EVENT_BEFORE_SESSION_TOLERANCE_MS
    ) {
      rejectedEvents += 1;
      continue;
    }
    seenIds.add(parsed.eventId);
    seenSequences.add(parsed.sequence);
    events.push(parsed);
  }
  if (!events.length) return { batch: null, rejectedEvents, clockSkewMs };

  return {
    batch: {
      sessionId: envelope.sessionId,
      sessionStartedAt: new Date(envelope.sessionStart).toISOString(),
      landingPath: envelope.landingPath,
      events,
    },
    rejectedEvents,
    clockSkewMs,
  };
}

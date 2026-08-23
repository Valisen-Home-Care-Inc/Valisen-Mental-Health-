"use client";

import { type CampaignAttribution } from "@/lib/campaignAttribution";
import {
  GOOGLE_ADS_PENDING_STORAGE_KEY,
  GOOGLE_ADS_SESSION_STORAGE_KEY,
  GOOGLE_ADS_THANK_YOU_STORAGE_KEY,
  GOOGLE_ADS_IDLE_TIMEOUT_MS,
  GOOGLE_ADS_JOURNEY_MAX_AGE_MS,
  captureGoogleAdsJourneyFromUrl,
  canonicalizeGoogleAdsPath,
  confirmedConsultationReferenceIsValid,
  getGoogleAdsJourneyToken,
  googleAdsEventIdIsValid,
  googleAdsSessionIdIsValid,
  isGoogleAdsJourneyActive,
  parseGoogleAdsJourneyBrowserClaim,
  type GoogleAdsEventName,
  type GoogleAdsCtaPlacement,
  type GoogleAdsFormFieldId,
  type GoogleAdsTargetType,
} from "@/lib/googleAdsJourney";

const ENDPOINT = "/api/google-ads/events";
const SESSION_VERSION = 1;
const THANK_YOU_VERSION = 1;
const MAX_SESSION_AGE_MS = GOOGLE_ADS_JOURNEY_MAX_AGE_MS;
const THANK_YOU_MAX_AGE_MS = 60 * 60 * 1000;
const MAX_QUEUE = 300;
const MAX_BATCH = 20;
const FLUSH_DELAY_MS = 650;
const MAX_RETRY_DELAY_MS = 30_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 8_000;

type GoogleAdsSessionState = {
  version: 1;
  id: string;
  startedAt: string;
  lastActivityAt: string;
  sequence: number;
  landingPath: string;
  attribution: CampaignAttribution;
  googleClickIdPresent: boolean;
  deviceCategory: "mobile" | "tablet" | "desktop";
  referrerHost?: string;
  journeyStartedRecorded: boolean;
  journeyToken: string;
};

export type GoogleAdsEventProperties = {
  path?: string;
  sectionId?: string;
  targetType?: GoogleAdsTargetType;
  targetPath?: string;
  targetId?: GoogleAdsFormFieldId | "button" | "submit";
  ctaPlacement?: GoogleAdsCtaPlacement;
  therapistId?: string;
  engagedMs?: number;
  scrollDepth?: 25 | 50 | 75 | 100;
  formStep?: 1 | 2;
  submissionReference?: string;
};

type QueuedGoogleAdsEvent = {
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
  scrollDepth?: number;
  formStep?: number;
  submissionReference?: string;
  elapsedMs: number;
  deviceCategory: "mobile" | "tablet" | "desktop";
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  googleClickIdPresent: boolean;
  referrerHost?: string;
};

type GoogleAdsThankYouMarker = {
  version: 1;
  confirmedAt: number;
  conversionId: string;
  conversionEmitted: boolean;
  sessionId: string;
};

type DataLayerWindow = Window & {
  dataLayer?: unknown[];
};

let state: GoogleAdsSessionState | null = null;
let queue: QueuedGoogleAdsEvent[] = [];
let hydrated = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushInFlight: Promise<boolean> | null = null;
let conversionEmittedInMemory = false;
let consecutiveFlushFailures = 0;

function randomId(prefix: "gas" | "gae"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

function deviceCategory(): "mobile" | "tablet" | "desktop" {
  if (window.matchMedia("(max-width: 639px)").matches) return "mobile";
  if (window.matchMedia("(max-width: 1023px)").matches) return "tablet";
  return "desktop";
}

function safeReferrerHost(): string | undefined {
  if (!document.referrer) return undefined;
  try {
    const host = new URL(document.referrer).hostname.toLowerCase().slice(0, 120);
    return host || undefined;
  } catch {
    return undefined;
  }
}

function validState(value: unknown): value is GoogleAdsSessionState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<GoogleAdsSessionState>;
  const startedAt = Date.parse(candidate.startedAt || "");
  const lastActivityAt = Date.parse(candidate.lastActivityAt || "");
  return (
    candidate.version === SESSION_VERSION &&
    googleAdsSessionIdIsValid(candidate.id) &&
    Number.isInteger(candidate.sequence) &&
    Number(candidate.sequence) >= 0 &&
    Number.isFinite(startedAt) &&
    startedAt >= Date.now() - MAX_SESSION_AGE_MS &&
    startedAt <= Date.now() + 10 * 60 * 1000 &&
    Number.isFinite(lastActivityAt) &&
    lastActivityAt >= startedAt &&
    lastActivityAt >= Date.now() - GOOGLE_ADS_IDLE_TIMEOUT_MS &&
    lastActivityAt <= Date.now() + 10 * 60 * 1000 &&
    typeof candidate.landingPath === "string" &&
    typeof candidate.attribution === "object" &&
    candidate.attribution !== null &&
    typeof candidate.googleClickIdPresent === "boolean" &&
    ["mobile", "tablet", "desktop"].includes(candidate.deviceCategory || "") &&
    typeof candidate.journeyStartedRecorded === "boolean" &&
    typeof candidate.journeyToken === "string" &&
    parseGoogleAdsJourneyBrowserClaim(candidate.journeyToken)?.sessionId ===
      candidate.id
  );
}

function persistState() {
  if (!state) return;
  try {
    window.sessionStorage.setItem(
      GOOGLE_ADS_SESSION_STORAGE_KEY,
      JSON.stringify(state),
    );
  } catch {
    // A memory-only ads session is still useful and never blocks navigation.
  }
}

function persistQueue() {
  if (!state) return;
  try {
    window.sessionStorage.setItem(
      GOOGLE_ADS_PENDING_STORAGE_KEY,
      JSON.stringify({ sessionId: state.id, events: queue }),
    );
  } catch {
    // Tracking failure must never affect the visitor journey.
  }
}

function hydrateQueue() {
  if (hydrated || !state) return;
  hydrated = true;
  try {
    const parsed = JSON.parse(
      window.sessionStorage.getItem(GOOGLE_ADS_PENDING_STORAGE_KEY) || "null",
    ) as { sessionId?: unknown; events?: unknown } | null;
    if (parsed?.sessionId !== state.id || !Array.isArray(parsed.events)) return;
    queue = parsed.events.filter(
      (event): event is QueuedGoogleAdsEvent =>
        Boolean(
          event &&
            typeof event === "object" &&
            googleAdsEventIdIsValid(
              (event as QueuedGoogleAdsEvent).eventId,
            ),
        ),
    );
  } catch {
    queue = [];
  }
}

function getOrCreateState(): GoogleAdsSessionState | null {
  if (typeof window === "undefined") return null;
  if (!isGoogleAdsJourneyActive()) {
    state = null;
    queue = [];
    hydrated = false;
    return null;
  }
  const journeyToken = captureGoogleAdsJourneyFromUrl() || getGoogleAdsJourneyToken();
  const claim = parseGoogleAdsJourneyBrowserClaim(journeyToken);
  if (!journeyToken || !claim) return null;
  if (state && validState(state) && state.id === claim.sessionId) return state;
  if (state) {
    state = null;
    queue = [];
    hydrated = false;
  }
  try {
    const parsed = JSON.parse(
      window.sessionStorage.getItem(GOOGLE_ADS_SESSION_STORAGE_KEY) || "null",
    );
    if (validState(parsed) && parsed.id === claim.sessionId) state = parsed;
  } catch {
    state = null;
  }
  if (!state) {
    state = {
      version: SESSION_VERSION,
      id: claim.sessionId,
      startedAt: claim.startedAt,
      lastActivityAt: new Date().toISOString(),
      sequence: 0,
      landingPath: claim.landingPath,
      attribution: claim.attribution,
      googleClickIdPresent: claim.googleClickIdPresent,
      deviceCategory: deviceCategory(),
      referrerHost: safeReferrerHost(),
      journeyStartedRecorded: false,
      journeyToken,
    };
    queue = [];
    hydrated = true;
    persistState();
    persistQueue();
  } else {
    hydrateQueue();
  }
  return state;
}

function scheduleFlush(delayMs = FLUSH_DELAY_MS) {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushGoogleAdsEvents();
  }, Math.max(FLUSH_DELAY_MS, Math.min(MAX_RETRY_DELAY_MS, delayMs)));
}

function retryDelay(response?: Response): number {
  const retryAfter = response?.headers.get("retry-after");
  if (retryAfter && /^\d{1,4}$/.test(retryAfter)) {
    return Math.min(MAX_RETRY_DELAY_MS, Number(retryAfter) * 1_000);
  }
  return Math.min(
    MAX_RETRY_DELAY_MS,
    1_000 * 2 ** Math.min(5, consecutiveFlushFailures),
  );
}

export function startGoogleAdsTracking(): string | undefined {
  const session = getOrCreateState();
  if (!session) return undefined;
  if (!session.journeyStartedRecorded) {
    session.journeyStartedRecorded = true;
    persistState();
    recordGoogleAdsEvent("journey_started");
  }
  return session.id;
}

export function getGoogleAdsSessionId(): string | undefined {
  return getOrCreateState()?.id;
}

export function getGoogleAdsCampaignAttribution(): CampaignAttribution {
  return getOrCreateState()?.attribution || {};
}

export function recordGoogleAdsEvent(
  event: GoogleAdsEventName,
  properties: GoogleAdsEventProperties = {},
): void {
  const session = getOrCreateState();
  if (!session) return;
  session.sequence += 1;
  session.lastActivityAt = new Date().toISOString();
  persistState();
  const attribution = session.attribution;
  const queued: QueuedGoogleAdsEvent = {
    eventId: randomId("gae"),
    sequence: session.sequence,
    occurredAt: new Date().toISOString(),
    event,
    path: canonicalizeGoogleAdsPath(
      properties.path || window.location.pathname,
    ),
    sectionId: properties.sectionId,
    targetType: properties.targetType,
    targetPath: properties.targetPath
      ? canonicalizeGoogleAdsPath(properties.targetPath)
      : undefined,
    targetId: properties.targetId,
    ctaPlacement: properties.ctaPlacement,
    therapistId: properties.therapistId,
    engagedMs: properties.engagedMs,
    scrollDepth: properties.scrollDepth,
    formStep: properties.formStep,
    submissionReference: confirmedConsultationReferenceIsValid(
      properties.submissionReference,
    )
      ? properties.submissionReference
      : undefined,
    elapsedMs: Math.max(0, Date.now() - Date.parse(session.startedAt)),
    deviceCategory: session.deviceCategory,
    utmSource: attribution.source,
    utmMedium: attribution.medium,
    utmCampaign: attribution.campaign,
    utmContent: attribution.content,
    googleClickIdPresent: session.googleClickIdPresent,
    referrerHost: session.referrerHost,
  };
  queue.push(queued);
  if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
  persistQueue();
  scheduleFlush();
}

export async function flushGoogleAdsEvents(
  useBeacon = false,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
): Promise<boolean> {
  const session = getOrCreateState();
  if (!session) return false;
  hydrateQueue();
  if (!queue.length) return true;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (flushInFlight) return flushInFlight;
  const events = queue.slice(0, MAX_BATCH);
  const body = JSON.stringify({
    journeyToken: session.journeyToken,
    sessionId: session.id,
    sessionStartedAt: session.startedAt,
    landingPath: session.landingPath,
    events,
  });

  if (useBeacon && navigator.sendBeacon) {
    const handedOff = navigator.sendBeacon(
      ENDPOINT,
      new Blob([body], { type: "application/json" }),
    );
    if (handedOff) {
      // Keep the idempotent batch until a normal request confirms persistence.
      persistQueue();
      return true;
    }
  }

  flushInFlight = (async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      Math.max(250, Math.min(15_000, timeoutMs)),
    );
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        keepalive: true,
        signal: controller.signal,
        body,
      });
      if (
        response.ok ||
        [400, 403, 404, 413, 415, 422].includes(response.status)
      ) {
        const acknowledged = new Set(events.map((item) => item.eventId));
        queue = queue.filter((item) => !acknowledged.has(item.eventId));
        persistQueue();
        consecutiveFlushFailures = 0;
        if (queue.length) scheduleFlush();
        return response.ok;
      }
      consecutiveFlushFailures += 1;
      scheduleFlush(retryDelay(response));
      return false;
    } catch {
      consecutiveFlushFailures += 1;
      scheduleFlush(retryDelay());
      return false;
    } finally {
      window.clearTimeout(timeout);
      flushInFlight = null;
    }
  })();
  return flushInFlight;
}

function googleTagCommand(..._values: unknown[]): IArguments {
  return arguments;
}

export function markGoogleAdsThankYouConfirmed(conversionId: string): boolean {
  if (typeof window === "undefined") return false;
  if (!/^gac-[a-f0-9]{32}$/.test(conversionId)) return false;
  const sessionId = getGoogleAdsSessionId();
  if (!sessionId) return false;
  const marker: GoogleAdsThankYouMarker = {
    version: THANK_YOU_VERSION,
    confirmedAt: Date.now(),
    conversionId,
    conversionEmitted: false,
    sessionId,
  };
  try {
    window.sessionStorage.setItem(
      GOOGLE_ADS_THANK_YOU_STORAGE_KEY,
      JSON.stringify(marker),
    );
  } catch {
    // The atomic server claim remains authoritative when storage is disabled.
  }
  const target = window as DataLayerWindow;
  target.dataLayer = target.dataLayer || [];
  target.dataLayer.push(
    googleTagCommand("consent", "default", {
      ad_storage: "denied",
      analytics_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      wait_for_update: 500,
    }),
  );
  target.dataLayer.push({
    analytics_context: "google_ads_conversion_only",
    event: "vmh_google_ads_conversion_context",
    vmh_conversion_only: true,
    vmh_traffic_channel: "google_ads",
  });
  window.dispatchEvent(new Event("valisen:google-ads-conversion-confirmed"));
  return true;
}

function readThankYouMarker(): GoogleAdsThankYouMarker | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(
      window.sessionStorage.getItem(GOOGLE_ADS_THANK_YOU_STORAGE_KEY) || "null",
    ) as Partial<GoogleAdsThankYouMarker> | null;
    if (
      parsed?.version !== THANK_YOU_VERSION ||
      typeof parsed.confirmedAt !== "number" ||
      typeof parsed.conversionId !== "string" ||
      !/^gac-[a-f0-9]{32}$/.test(parsed.conversionId) ||
      typeof parsed.conversionEmitted !== "boolean" ||
      !googleAdsSessionIdIsValid(parsed.sessionId) ||
      parsed.sessionId !== getGoogleAdsSessionId() ||
      parsed.confirmedAt < Date.now() - THANK_YOU_MAX_AGE_MS ||
      parsed.confirmedAt > Date.now() + 10_000
    ) {
      return null;
    }
    return parsed as GoogleAdsThankYouMarker;
  } catch {
    return null;
  }
}

export function hasConfirmedGoogleAdsThankYou(): boolean {
  return Boolean(readThankYouMarker());
}

/** True only during the one render that is allowed to load conversion tags. */
export function hasPendingGoogleAdsConversionSignal(): boolean {
  const marker = readThankYouMarker();
  return Boolean(marker && !marker.conversionEmitted);
}

/**
 * Emits one neutral conversion signal. It contains no lead reference, contact
 * fields, intake answers, therapist, or clinical information.
 */
export function emitGoogleAdsConversionOnce(): boolean {
  if (conversionEmittedInMemory) return false;
  const marker = readThankYouMarker();
  if (!marker) return false;
  if (marker?.conversionEmitted) return false;
  conversionEmittedInMemory = true;
  if (marker) {
    marker.conversionEmitted = true;
    try {
      window.sessionStorage.setItem(
        GOOGLE_ADS_THANK_YOU_STORAGE_KEY,
        JSON.stringify(marker),
      );
    } catch {
      // The in-memory guard covers this confirmed document load.
    }
  }
  const target = window as DataLayerWindow;
  target.dataLayer = target.dataLayer || [];
  target.dataLayer.push({
    event: "google_ads_consultation_conversion",
    transaction_id: marker.conversionId,
    vmh_conversion_id: marker.conversionId,
  });
  return true;
}

export function resetGoogleAdsTrackingForTests(): void {
  state = null;
  queue = [];
  hydrated = false;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  flushInFlight = null;
  conversionEmittedInMemory = false;
  consecutiveFlushFailures = 0;
}

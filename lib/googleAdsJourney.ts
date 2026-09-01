import { TRACKED_PUBLIC_PATHS } from "@/lib/funnelPath";
import {
  captureGoogleAdsClickAttribution,
  clearStoredGoogleAdsClickAttribution,
} from "@/lib/campaignAttribution";

export const GOOGLE_ADS_ENTRY_PREFIX = "/google-ads";
export const GOOGLE_ADS_ENTRY_FRAGMENT_KEY = "vmh_ga";
export const GOOGLE_ADS_CONVERSION_FRAGMENT_KEY = "vmh_gc";
export const GOOGLE_ADS_CLEAR_FRAGMENT_KEY = "vmh_gx";
export const GOOGLE_ADS_CLICK_FRAGMENT_PREFIX = "vmh_";
export const GOOGLE_ADS_JOURNEY_STORAGE_KEY =
  "valisen:google-ads-journey-proof:v1";
export const GOOGLE_ADS_CONVERSION_STORAGE_KEY =
  "valisen:google-ads-conversion-proof:v1";
export const GOOGLE_ADS_SESSION_STORAGE_KEY = "valisen:google-ads-session:v2";
export const GOOGLE_ADS_PENDING_STORAGE_KEY = "valisen:google-ads-pending:v2";
export const GOOGLE_ADS_THANK_YOU_STORAGE_KEY =
  "valisen:google-ads-thank-you:v2";
export const GOOGLE_ADS_INTERNAL_NAVIGATION_STORAGE_KEY =
  "valisen:google-ads-internal-navigation:v1";
export const GOOGLE_ADS_INTERNAL_NAVIGATION_MAX_AGE_MS = 15_000;
export const GOOGLE_ADS_IDLE_TIMEOUT_MS = 30 * 60 * 1_000;
export const GOOGLE_ADS_JOURNEY_MAX_AGE_MS = 12 * 60 * 60 * 1_000;

export const GOOGLE_ADS_EVENT_NAMES = [
  "journey_started",
  "page_viewed",
  "page_exited",
  "section_viewed",
  "engagement_ping",
  "scroll_depth_reached",
  "internal_link_clicked",
  "control_clicked",
  "consultation_cta_clicked",
  "phone_clicked",
  "email_clicked",
  "therapist_profile_clicked",
  "quiz_clicked",
  "external_link_clicked",
  "form_started",
  "form_field_focused",
  "consultation_step_viewed",
  "consultation_validation_failed",
  "consultation_submitted",
  "thank_you_viewed",
] as const;

export type GoogleAdsEventName = (typeof GOOGLE_ADS_EVENT_NAMES)[number];

export const GOOGLE_ADS_TARGET_TYPES = [
  "navigation",
  "consultation",
  "phone",
  "email",
  "therapist",
  "quiz",
  "external",
  "button",
  "form_field",
] as const;

export type GoogleAdsTargetType = (typeof GOOGLE_ADS_TARGET_TYPES)[number];

export const GOOGLE_ADS_CTA_PLACEMENTS = [
  "navigation",
  "footer",
  "form",
  "main",
] as const;

export type GoogleAdsCtaPlacement =
  (typeof GOOGLE_ADS_CTA_PLACEMENTS)[number];

export const GOOGLE_ADS_FORM_FIELD_IDS = [
  "first-name",
  "last-name",
  "email",
  "phone",
  "therapy-type",
  "preferred-therapist",
  "additional-info",
  "availability",
  "consent",
] as const;

export type GoogleAdsFormFieldId =
  (typeof GOOGLE_ADS_FORM_FIELD_IDS)[number];

const EXTRA_GOOGLE_ADS_PATHS = [
  "/welcome",
  "/thank-you",
] as const;

export const GOOGLE_ADS_TRACKED_PATHS = [
  ...TRACKED_PUBLIC_PATHS,
  ...EXTRA_GOOGLE_ADS_PATHS,
] as const;

const GOOGLE_ADS_TRACKED_PATH_SET = new Set<string>(GOOGLE_ADS_TRACKED_PATHS);
const GOOGLE_ADS_ENTRY_TARGET_SET = new Set<string>(
  GOOGLE_ADS_TRACKED_PATHS.filter(
    (path) =>
      ![
        "/sitewide",
        "/thank-you",
        "/consultation",
        "/book-consultation",
        "/get-matched",
        "/intake",
        "/quiz",
      ].includes(path),
  ),
);
const GOOGLE_ADS_ENTRY_ALIASES: Readonly<Record<string, string>> = {
  general: "/welcome",
  anxiety: "/welcome",
  depression: "/welcome",
  couples: "/welcome",
  mandarin: "/therapists/dayong-quan",
  arabic: "/therapists/meryem-ibrahim",
};
const CRISIS_PHONE_NUMBERS = new Set(["988", "6137226914"]);

/**
 * Converts `/google-ads/...` path segments into a closed, safe landing path.
 * The entry route never accepts a query-provided redirect destination.
 */
export function googleAdsEntryTarget(
  segments: readonly string[] | undefined,
): string | null {
  if (!segments?.length) return "/welcome";
  if (segments?.length === 1) {
    const alias = GOOGLE_ADS_ENTRY_ALIASES[segments[0].toLowerCase()];
    if (alias) return alias;
  }
  const target = `/${segments.join("/")}`;
  return GOOGLE_ADS_ENTRY_TARGET_SET.has(target) ? target : null;
}

export type GoogleAdsJourneyBrowserClaim = {
  attribution: {
    source?: string;
    medium?: string;
    campaign?: string;
    content?: string;
  };
  expiresAt: number;
  googleClickIdPresent: boolean;
  landingPath: string;
  sessionId: string;
  startedAt: string;
};

function decodeBrowserTokenPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  try {
    const encoded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=");
    const bytes = Uint8Array.from(atob(padded), (character) =>
      character.charCodeAt(0),
    );
    return JSON.parse(new TextDecoder().decode(bytes)) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}

export function parseGoogleAdsJourneyBrowserClaim(
  token: unknown,
  now = Date.now(),
): GoogleAdsJourneyBrowserClaim | null {
  if (typeof token !== "string" || token.length > 2_500) return null;
  const payload = decodeBrowserTokenPayload(token);
  if (
    !payload ||
    payload.sub !== "google-ads-main-domain-journey" ||
    !googleAdsSessionIdIsValid(payload.session) ||
    typeof payload.landing !== "string" ||
    canonicalizeGoogleAdsPath(payload.landing) !== payload.landing ||
    typeof payload.click !== "boolean" ||
    !Number.isSafeInteger(payload.started) ||
    !Number.isSafeInteger(payload.exp)
  ) {
    return null;
  }
  const expiresAt = Number(payload.exp) * 1_000;
  const startedAt = Number(payload.started) * 1_000;
  if (
    expiresAt <= now ||
    expiresAt > now + GOOGLE_ADS_JOURNEY_MAX_AGE_MS + 60_000 ||
    startedAt > now + 60_000 ||
    startedAt < now - GOOGLE_ADS_JOURNEY_MAX_AGE_MS
  ) {
    return null;
  }
  const dimension = (value: unknown): string | undefined => {
    if (typeof value !== "string") return undefined;
    const cleaned = value
      .replace(/[\u0000-\u001F\u007F]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);
    return cleaned || undefined;
  };
  return {
    attribution: {
      source: dimension(payload.source),
      medium: dimension(payload.medium),
      campaign: dimension(payload.campaign),
      content: dimension(payload.content),
    },
    expiresAt,
    googleClickIdPresent: payload.click,
    landingPath: payload.landing,
    sessionId: payload.session,
    startedAt: new Date(startedAt).toISOString(),
  };
}

function stripGoogleAdsEntryFragment(url: URL): void {
  const fragment = new URLSearchParams(url.hash.slice(1));
  fragment.delete(GOOGLE_ADS_ENTRY_FRAGMENT_KEY);
  fragment.delete(GOOGLE_ADS_CLEAR_FRAGMENT_KEY);
  for (const key of ["gclid", "gbraid", "wbraid"]) {
    fragment.delete(`${GOOGLE_ADS_CLICK_FRAGMENT_PREFIX}${key}`);
    url.searchParams.delete(key);
  }
  const remaining = fragment.toString();
  window.history.replaceState(
    window.history.state,
    "",
    `${url.pathname}${url.search}${remaining ? `#${remaining}` : ""}`,
  );
}

export function clearGoogleAdsBrowserState(): void {
  if (typeof window === "undefined") return;
  try {
    for (const key of [
      GOOGLE_ADS_JOURNEY_STORAGE_KEY,
      GOOGLE_ADS_CONVERSION_STORAGE_KEY,
      GOOGLE_ADS_SESSION_STORAGE_KEY,
      GOOGLE_ADS_PENDING_STORAGE_KEY,
      GOOGLE_ADS_THANK_YOU_STORAGE_KEY,
      GOOGLE_ADS_INTERNAL_NAVIGATION_STORAGE_KEY,
    ]) {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // A storage-disabled browser already has no durable journey state.
  }
  clearStoredGoogleAdsClickAttribution();
}

function internalNavigationPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    let pathname = new URL(value, "https://placeholder.invalid").pathname;
    if (pathname.length > 1 && pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }
    return GOOGLE_ADS_TRACKED_PATH_SET.has(pathname) ? pathname : null;
  } catch {
    return null;
  }
}

/**
 * Marks an imminent same-tab hard navigation. Some private-browser modes
 * suppress `document.referrer` even for same-origin transitions, so the next
 * document needs a short-lived, destination-bound signal to distinguish the
 * click from a fresh address-bar visit.
 */
export function stageGoogleAdsInternalNavigation(
  destinationPath: unknown,
  now = Date.now(),
): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.sessionStorage.removeItem(
      GOOGLE_ADS_INTERNAL_NAVIGATION_STORAGE_KEY,
    );
  } catch {
    return false;
  }
  const path = internalNavigationPath(destinationPath);
  if (!path || !Number.isFinite(now)) return false;
  try {
    window.sessionStorage.setItem(
      GOOGLE_ADS_INTERNAL_NAVIGATION_STORAGE_KEY,
      JSON.stringify({ version: 1, path, createdAt: now }),
    );
    return true;
  } catch {
    return false;
  }
}

/** Consumes the one-shot marker before deciding whether a referrerless load is direct. */
export function consumeGoogleAdsInternalNavigation(
  destinationPath: unknown,
  now = Date.now(),
): boolean {
  if (typeof window === "undefined") return false;
  const path = internalNavigationPath(destinationPath);
  try {
    const raw = window.sessionStorage.getItem(
      GOOGLE_ADS_INTERNAL_NAVIGATION_STORAGE_KEY,
    );
    window.sessionStorage.removeItem(
      GOOGLE_ADS_INTERNAL_NAVIGATION_STORAGE_KEY,
    );
    if (!raw || !path || !Number.isFinite(now)) return false;
    const marker = JSON.parse(raw) as {
      version?: unknown;
      path?: unknown;
      createdAt?: unknown;
    };
    return (
      marker.version === 1 &&
      marker.path === path &&
      typeof marker.createdAt === "number" &&
      marker.createdAt <= now + 1_000 &&
      marker.createdAt >= now - GOOGLE_ADS_INTERNAL_NAVIGATION_MAX_AGE_MS
    );
  } catch {
    return false;
  }
}

function signedReceiptLooksValid(value: unknown, maximumLength: number): value is string {
  return (
    typeof value === "string" &&
    value.length >= 100 &&
    value.length <= maximumLength &&
    /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)
  );
}

export function googleAdsThankYouUrl(conversionReceipt: unknown): string | null {
  if (!signedReceiptLooksValid(conversionReceipt, 1_500)) return null;
  return `/thank-you#${new URLSearchParams({
    [GOOGLE_ADS_CONVERSION_FRAGMENT_KEY]: conversionReceipt,
  }).toString()}`;
}

/** Reads a per-tab conversion receipt and removes it before any tag can load. */
export function consumeGoogleAdsConversionReceiptFromUrl(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const url = new URL(window.location.href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  const receipt = fragment.get(GOOGLE_ADS_CONVERSION_FRAGMENT_KEY);
  if (receipt !== null) {
    fragment.delete(GOOGLE_ADS_CONVERSION_FRAGMENT_KEY);
    const remaining = fragment.toString();
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${remaining ? `#${remaining}` : ""}`,
    );
    const sessionId = activeGoogleAdsSessionId();
    try {
      if (sessionId && signedReceiptLooksValid(receipt, 1_500)) {
        window.sessionStorage.setItem(
          GOOGLE_ADS_CONVERSION_STORAGE_KEY,
          JSON.stringify({ receipt, sessionId, storedAt: Date.now() }),
        );
      } else {
        window.sessionStorage.removeItem(GOOGLE_ADS_CONVERSION_STORAGE_KEY);
      }
    } catch {
      return signedReceiptLooksValid(receipt, 1_500) ? receipt : undefined;
    }
  }
  try {
    const parsed = JSON.parse(
      window.sessionStorage.getItem(GOOGLE_ADS_CONVERSION_STORAGE_KEY) || "null",
    ) as { receipt?: unknown; sessionId?: unknown; storedAt?: unknown } | null;
    if (
      !parsed ||
      parsed.sessionId !== activeGoogleAdsSessionId() ||
      !signedReceiptLooksValid(parsed.receipt, 1_500) ||
      typeof parsed.storedAt !== "number" ||
      parsed.storedAt < Date.now() - 15 * 60 * 1_000 ||
      parsed.storedAt > Date.now() + 10_000
    ) {
      window.sessionStorage.removeItem(GOOGLE_ADS_CONVERSION_STORAGE_KEY);
      return undefined;
    }
    return parsed.receipt;
  } catch {
    return receipt && signedReceiptLooksValid(receipt, 1_500)
      ? receipt
      : undefined;
  }
}

export function clearGoogleAdsConversionReceipt(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(GOOGLE_ADS_CONVERSION_STORAGE_KEY);
  } catch {
    // The receipt still expires cryptographically after fifteen minutes.
  }
}

/** Moves the server-signed entry proof into per-tab storage before tags load. */
export function captureGoogleAdsJourneyFromUrl(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const url = new URL(window.location.href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  if (fragment.get(GOOGLE_ADS_CLEAR_FRAGMENT_KEY) === "1") {
    clearGoogleAdsBrowserState();
    stripGoogleAdsEntryFragment(url);
    return undefined;
  }
  const candidate = fragment.get(GOOGLE_ADS_ENTRY_FRAGMENT_KEY);
  if (candidate !== null) {
    const claim = parseGoogleAdsJourneyBrowserClaim(candidate);
    try {
      if (claim) {
        window.sessionStorage.setItem(GOOGLE_ADS_JOURNEY_STORAGE_KEY, candidate);
        const clickParams = new URLSearchParams();
        for (const key of ["gclid", "gbraid", "wbraid"] as const) {
          const value =
            fragment.get(`${GOOGLE_ADS_CLICK_FRAGMENT_PREFIX}${key}`) ||
            url.searchParams.get(key);
          if (value) clickParams.set(key, value);
        }
        captureGoogleAdsClickAttribution(clickParams.toString(), true);
      } else {
        window.sessionStorage.removeItem(GOOGLE_ADS_JOURNEY_STORAGE_KEY);
      }
    } catch {
      // A storage-disabled browser degrades to the ordinary, unlinked funnel.
    }
    stripGoogleAdsEntryFragment(url);
    return claim ? candidate : undefined;
  }
  return readStoredGoogleAdsJourneyToken();
}

function readStoredGoogleAdsJourneyToken(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const token = window.sessionStorage.getItem(GOOGLE_ADS_JOURNEY_STORAGE_KEY);
    if (!parseGoogleAdsJourneyBrowserClaim(token)) {
      if (token) window.sessionStorage.removeItem(GOOGLE_ADS_JOURNEY_STORAGE_KEY);
      return undefined;
    }
    return token || undefined;
  } catch {
    return undefined;
  }
}

export function getGoogleAdsJourneyToken(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const fragment = new URLSearchParams((window.location.hash || "").slice(1));
  return fragment.has(GOOGLE_ADS_ENTRY_FRAGMENT_KEY)
    ? captureGoogleAdsJourneyFromUrl()
    : readStoredGoogleAdsJourneyToken();
}

export function activeGoogleAdsSessionId(): string | undefined {
  const claim = parseGoogleAdsJourneyBrowserClaim(getGoogleAdsJourneyToken());
  if (claim && storedGoogleAdsJourneyIsIdle(claim.sessionId)) {
    clearGoogleAdsBrowserState();
    return undefined;
  }
  return claim?.sessionId;
}

function storedGoogleAdsJourneyIsIdle(sessionId: string): boolean {
  try {
    const raw = window.sessionStorage.getItem(GOOGLE_ADS_SESSION_STORAGE_KEY);
    if (!raw) return false;
    const stored = JSON.parse(raw) as {
      id?: unknown;
      lastActivityAt?: unknown;
    };
    if (stored.id !== sessionId) return false;
    const lastActivityAt = Date.parse(
      typeof stored.lastActivityAt === "string" ? stored.lastActivityAt : "",
    );
    return (
      !Number.isFinite(lastActivityAt) ||
      lastActivityAt < Date.now() - GOOGLE_ADS_IDLE_TIMEOUT_MS ||
      lastActivityAt > Date.now() + 10 * 60 * 1_000
    );
  } catch {
    return true;
  }
}

/**
 * Browser-only, non-authoritative channel hint. Server endpoints additionally
 * verify the matching purpose-bound HMAC receipt on every request.
 */
export function isGoogleAdsJourneyActive(): boolean {
  return Boolean(activeGoogleAdsSessionId());
}

export function canonicalizeGoogleAdsPath(value: unknown): string {
  if (typeof value !== "string") return "/sitewide";
  let pathname = value.trim();
  try {
    pathname = new URL(pathname, "https://placeholder.invalid").pathname;
  } catch {
    return "/sitewide";
  }
  if (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }
  return GOOGLE_ADS_TRACKED_PATH_SET.has(pathname)
    ? pathname
    : "/sitewide";
}

export function isGoogleAdsFormFieldId(
  value: unknown,
): value is GoogleAdsFormFieldId {
  return (
    typeof value === "string" &&
    (GOOGLE_ADS_FORM_FIELD_IDS as readonly string[]).includes(value)
  );
}

export function googleAdsSectionId(index: number): string {
  const safeIndex = Math.max(1, Math.min(999, Math.floor(index)));
  return `section-${String(safeIndex).padStart(2, "0")}`;
}

export function isGoogleAdsSectionId(value: unknown): value is string {
  return typeof value === "string" && /^section-(?:0[1-9]|[1-9][0-9]{1,2})$/.test(value);
}

export function isCrisisPhoneHref(href: string): boolean {
  if (!href.toLowerCase().startsWith("tel:")) return false;
  const rawDigits = href.slice(4).replace(/\D/g, "");
  const digits = rawDigits.length === 11 && rawDigits.startsWith("1")
    ? rawDigits.slice(1)
    : rawDigits;
  return CRISIS_PHONE_NUMBERS.has(digits);
}

export function googleAdsSessionIdIsValid(value: unknown): value is string {
  return typeof value === "string" && /^gas-[A-Za-z0-9-]{16,90}$/.test(value);
}

export function googleAdsEventIdIsValid(value: unknown): value is string {
  return typeof value === "string" && /^gae-[A-Za-z0-9-]{16,90}$/.test(value);
}

export function confirmedConsultationReferenceIsValid(
  value: unknown,
): value is string {
  return typeof value === "string" && /^VC-[A-Za-z0-9_-]{6,36}$/.test(value);
}

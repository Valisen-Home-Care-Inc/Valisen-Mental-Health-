import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import {
  GOOGLE_ADS_JOURNEY_MAX_AGE_MS,
  canonicalizeGoogleAdsPath,
  googleAdsSessionIdIsValid,
} from "@/lib/googleAdsJourney";
import {
  campaignAttributionFromSearch,
  googleAdsClickAttributionFromSearch,
  type CampaignAttribution,
} from "@/lib/campaignAttribution";
import { safeGoogleAdsCampaignIdentifier } from "@/lib/googleAdsEntry";

export const GOOGLE_ADS_JOURNEY_TTL_SECONDS =
  GOOGLE_ADS_JOURNEY_MAX_AGE_MS / 1_000;

const TOKEN_VERSION = "v1";
const TOKEN_SUBJECT = "google-ads-main-domain-journey";
const MIN_SECRET_BYTES = 32;

type JourneyPayload = {
  campaign?: string;
  click: boolean;
  content?: string;
  exp: number;
  iat: number;
  landing: string;
  medium?: string;
  nonce: string;
  session: string;
  source?: string;
  started: number;
  sub: typeof TOKEN_SUBJECT;
};

export type VerifiedGoogleAdsJourney = {
  attribution: CampaignAttribution;
  expiresAt: number;
  googleClickIdPresent: boolean;
  landingPath: string;
  sessionId: string;
  startedAt: string;
};

function usableSecret(secret: string | undefined): secret is string {
  return Boolean(
    secret &&
      Buffer.byteLength(secret, "utf8") >= MIN_SECRET_BYTES &&
      Buffer.byteLength(secret, "utf8") <= 1_024,
  );
}

function decodeCanonical(value: string, min: number, max: number): Buffer | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const decoded = Buffer.from(value, "base64url");
    return decoded.byteLength >= min &&
      decoded.byteLength <= max &&
      decoded.toString("base64url") === value
      ? decoded
      : null;
  } catch {
    return null;
  }
}

function signature(unsigned: string, secret: string): Buffer {
  return createHmac("sha256", secret)
    .update(`${TOKEN_SUBJECT}\0${unsigned}`)
    .digest();
}

function cleanDimension(value: unknown): string | undefined {
  return safeGoogleAdsCampaignIdentifier(value);
}

function canonicalPayload(payload: JourneyPayload): JourneyPayload {
  return {
    ...(payload.campaign ? { campaign: payload.campaign } : {}),
    click: payload.click,
    ...(payload.content ? { content: payload.content } : {}),
    exp: payload.exp,
    iat: payload.iat,
    landing: payload.landing,
    ...(payload.medium ? { medium: payload.medium } : {}),
    nonce: payload.nonce,
    session: payload.session,
    ...(payload.source ? { source: payload.source } : {}),
    started: payload.started,
    sub: TOKEN_SUBJECT,
  };
}

export function createGoogleAdsJourney(input: {
  landingPath: string;
  search: string;
  now?: number;
}): { claim: VerifiedGoogleAdsJourney; token: string } | null {
  const secret = process.env.GOOGLE_ADS_CONVERSION_SECRET;
  const now = input.now ?? Date.now();
  const issued = Math.floor(now / 1_000);
  const landing = canonicalizeGoogleAdsPath(input.landingPath);
  if (!usableSecret(secret) || landing === "/sitewide") return null;

  const attribution = campaignAttributionFromSearch(input.search);
  const googleClickIdPresent =
    Object.keys(googleAdsClickAttributionFromSearch(input.search)).length > 0;
  const sessionId = `gas-${randomUUID()}`;
  const payload = canonicalPayload({
    campaign: cleanDimension(attribution.campaign),
    click: googleClickIdPresent,
    content: cleanDimension(attribution.content),
    exp: issued + GOOGLE_ADS_JOURNEY_TTL_SECONDS,
    iat: issued,
    landing,
    medium: cleanDimension(attribution.medium),
    nonce: randomBytes(16).toString("base64url"),
    session: sessionId,
    source: cleanDimension(attribution.source),
    started: issued,
    sub: TOKEN_SUBJECT,
  });
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const unsigned = `${TOKEN_VERSION}.${encoded}`;
  const token = `${unsigned}.${signature(unsigned, secret).toString("base64url")}`;
  return {
    claim: {
      attribution,
      expiresAt: payload.exp * 1_000,
      googleClickIdPresent,
      landingPath: landing,
      sessionId,
      startedAt: new Date(issued * 1_000).toISOString(),
    },
    token,
  };
}

export function verifyGoogleAdsJourneyToken(
  token: unknown,
  now = Date.now(),
): VerifiedGoogleAdsJourney | null {
  const secret = process.env.GOOGLE_ADS_CONVERSION_SECRET;
  if (!usableSecret(secret) || typeof token !== "string" || token.length > 2_500) {
    return null;
  }
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) return null;
  const payloadBytes = decodeCanonical(parts[1], 2, 1_800);
  const supplied = decodeCanonical(parts[2], 32, 32);
  if (!payloadBytes || !supplied) return null;
  const expected = signature(`${TOKEN_VERSION}.${parts[1]}`, secret);
  if (!timingSafeEqual(supplied, expected)) return null;

  try {
    const raw = JSON.parse(payloadBytes.toString("utf8")) as Record<
      string,
      unknown
    >;
    const allowed = new Set([
      "campaign",
      "click",
      "content",
      "exp",
      "iat",
      "landing",
      "medium",
      "nonce",
      "session",
      "source",
      "started",
      "sub",
    ]);
    if (Object.keys(raw).some((key) => !allowed.has(key))) return null;
    if (
      raw.sub !== TOKEN_SUBJECT ||
      typeof raw.click !== "boolean" ||
      !Number.isSafeInteger(raw.exp) ||
      !Number.isSafeInteger(raw.iat) ||
      !Number.isSafeInteger(raw.started) ||
      typeof raw.nonce !== "string" ||
      !decodeCanonical(raw.nonce, 16, 16) ||
      !googleAdsSessionIdIsValid(raw.session) ||
      typeof raw.landing !== "string" ||
      canonicalizeGoogleAdsPath(raw.landing) !== raw.landing
    ) {
      return null;
    }
    const issued = Number(raw.iat);
    const expires = Number(raw.exp);
    const started = Number(raw.started);
    const nowSeconds = Math.floor(now / 1_000);
    if (
      expires !== issued + GOOGLE_ADS_JOURNEY_TTL_SECONDS ||
      issued !== started ||
      issued > nowSeconds + 60 ||
      expires <= nowSeconds
    ) {
      return null;
    }
    const attribution: CampaignAttribution = {
      source: cleanDimension(raw.source),
      medium: cleanDimension(raw.medium),
      campaign: cleanDimension(raw.campaign),
      content: cleanDimension(raw.content),
    };
    return {
      attribution,
      expiresAt: expires * 1_000,
      googleClickIdPresent: raw.click,
      landingPath: raw.landing,
      sessionId: raw.session,
      startedAt: new Date(started * 1_000).toISOString(),
    };
  } catch {
    return null;
  }
}

export function hasQualifiedGoogleAdsEntry(search: string): boolean {
  if (Object.keys(googleAdsClickAttributionFromSearch(search)).length > 0) {
    return true;
  }
  const attribution = campaignAttributionFromSearch(search);
  const source = attribution.source?.trim().toLowerCase();
  const medium = attribution.medium
    ?.trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  return (
    source === "google" &&
    Boolean(medium && ["cpc", "ppc", "paidsearch", "paid"].includes(medium))
  );
}

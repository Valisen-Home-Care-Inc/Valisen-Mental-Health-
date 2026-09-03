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
import {
  GOOGLE_ADS_CLICK_ATTRIBUTION_MAX_LENGTH,
  decodeGoogleAdsClickAttribution,
  encodeGoogleAdsClickAttribution,
  hasGoogleAdsClickSignal,
  safeGoogleAdsCampaignIdentifier,
  type GoogleAdsValueTrackAttribution,
} from "@/lib/googleAdsEntry";

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
  /** Signed, compact click attribution (campaign, ad group, keyword, ...). */
  vt?: string;
};

export type VerifiedGoogleAdsJourney = {
  attribution: CampaignAttribution;
  expiresAt: number;
  googleClickIdPresent: boolean;
  landingPath: string;
  sessionId: string;
  startedAt: string;
  valueTrack?: GoogleAdsValueTrackAttribution;
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
    ...(payload.vt ? { vt: payload.vt } : {}),
  };
}

export function createGoogleAdsJourney(input: {
  landingPath: string;
  search: string;
  now?: number;
  valueTrack?: GoogleAdsValueTrackAttribution;
}): { claim: VerifiedGoogleAdsJourney; token: string } | null {
  const secret = process.env.GOOGLE_ADS_CONVERSION_SECRET;
  const now = input.now ?? Date.now();
  const issued = Math.floor(now / 1_000);
  const landing = canonicalizeGoogleAdsPath(input.landingPath);
  if (!usableSecret(secret) || landing === "/sitewide") return null;

  const rawAttribution = campaignAttributionFromSearch(input.search);
  const googleClickIdPresent =
    Object.keys(googleAdsClickAttributionFromSearch(input.search)).length > 0;
  const sessionId = `gas-${randomUUID()}`;
  const encodedValueTrack = input.valueTrack
    ? encodeGoogleAdsClickAttribution(input.valueTrack)
    : undefined;
  const payload = canonicalPayload({
    campaign: cleanDimension(rawAttribution.campaign),
    click: googleClickIdPresent,
    content: cleanDimension(rawAttribution.content),
    exp: issued + GOOGLE_ADS_JOURNEY_TTL_SECONDS,
    iat: issued,
    landing,
    medium: cleanDimension(rawAttribution.medium),
    nonce: randomBytes(16).toString("base64url"),
    session: sessionId,
    source: cleanDimension(rawAttribution.source),
    started: issued,
    sub: TOKEN_SUBJECT,
    vt: encodedValueTrack,
  });
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const unsigned = `${TOKEN_VERSION}.${encoded}`;
  const token = `${unsigned}.${signature(unsigned, secret).toString("base64url")}`;
  // The claim mirrors exactly what verification will later return, so a
  // server-side seed and the first event batch always carry identical values.
  const attribution: CampaignAttribution = {
    ...(payload.source ? { source: payload.source } : {}),
    ...(payload.medium ? { medium: payload.medium } : {}),
    ...(payload.campaign ? { campaign: payload.campaign } : {}),
    ...(payload.content ? { content: payload.content } : {}),
  };
  const valueTrack = decodeGoogleAdsClickAttribution(encodedValueTrack) ?? undefined;
  return {
    claim: {
      attribution,
      expiresAt: payload.exp * 1_000,
      googleClickIdPresent,
      landingPath: landing,
      sessionId,
      startedAt: new Date(issued * 1_000).toISOString(),
      ...(valueTrack ? { valueTrack } : {}),
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
      "vt",
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
      canonicalizeGoogleAdsPath(raw.landing) !== raw.landing ||
      (raw.vt !== undefined &&
        (typeof raw.vt !== "string" ||
          raw.vt.length > GOOGLE_ADS_CLICK_ATTRIBUTION_MAX_LENGTH))
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
    const valueTrack = decodeGoogleAdsClickAttribution(raw.vt) ?? undefined;
    return {
      attribution,
      expiresAt: expires * 1_000,
      googleClickIdPresent: raw.click,
      landingPath: raw.landing,
      sessionId: raw.session,
      startedAt: new Date(started * 1_000).toISOString(),
      ...(valueTrack ? { valueTrack } : {}),
    };
  } catch {
    return null;
  }
}

export function hasQualifiedGoogleAdsEntry(search: string): boolean {
  if (hasGoogleAdsClickSignal(search)) return true;
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

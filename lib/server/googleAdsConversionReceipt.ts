import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import {
  confirmedConsultationReferenceIsValid,
  googleAdsSessionIdIsValid,
} from "@/lib/googleAdsJourney";

export const GOOGLE_ADS_CONVERSION_TTL_SECONDS = 15 * 60;

const TOKEN_VERSION = "v1";
const TOKEN_SUBJECT = "google-ads-consultation";
const MIN_SECRET_BYTES = 32;

type ReceiptPayload = {
  exp: number;
  iat: number;
  nonce: string;
  referenceId: string;
  sessionId: string;
  sub: typeof TOKEN_SUBJECT;
};

export type GoogleAdsConversionReceipt = {
  referenceId: string;
  sessionId: string;
};

export type VerifiedGoogleAdsConversionReceipt =
  GoogleAdsConversionReceipt & {
    nonceHash: string;
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
  return createHmac("sha256", secret).update(unsigned).digest();
}

export function isGoogleAdsConversionReceiptConfigured(
  secret = process.env.GOOGLE_ADS_CONVERSION_SECRET,
): boolean {
  return usableSecret(secret);
}

export function createGoogleAdsConversionReceipt(
  input: GoogleAdsConversionReceipt,
  options: { now?: number; secret?: string; nonce?: string } = {},
): string | null {
  const secret = options.secret ?? process.env.GOOGLE_ADS_CONVERSION_SECRET;
  if (
    !usableSecret(secret) ||
    !googleAdsSessionIdIsValid(input.sessionId) ||
    !confirmedConsultationReferenceIsValid(input.referenceId)
  ) {
    return null;
  }
  const issuedAt = Math.floor((options.now ?? Date.now()) / 1_000);
  const nonce = options.nonce ?? randomBytes(16).toString("base64url");
  if (!decodeCanonical(nonce, 16, 16)) return null;
  const payload: ReceiptPayload = {
    exp: issuedAt + GOOGLE_ADS_CONVERSION_TTL_SECONDS,
    iat: issuedAt,
    nonce,
    referenceId: input.referenceId,
    sessionId: input.sessionId,
    sub: TOKEN_SUBJECT,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const unsigned = `${TOKEN_VERSION}.${encoded}`;
  return `${unsigned}.${signature(unsigned, secret).toString("base64url")}`;
}

export function verifyGoogleAdsConversionReceipt(
  token: unknown,
  options: { now?: number; secret?: string } = {},
): VerifiedGoogleAdsConversionReceipt | null {
  const secret = options.secret ?? process.env.GOOGLE_ADS_CONVERSION_SECRET;
  if (!usableSecret(secret) || typeof token !== "string" || token.length > 1_500) {
    return null;
  }
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) return null;
  const supplied = decodeCanonical(parts[2], 32, 32);
  const payloadBytes = decodeCanonical(parts[1], 2, 768);
  if (!supplied || !payloadBytes) return null;
  const expected = signature(`${TOKEN_VERSION}.${parts[1]}`, secret);
  if (!timingSafeEqual(supplied, expected)) return null;
  try {
    const value = JSON.parse(payloadBytes.toString("utf8")) as Record<
      string,
      unknown
    >;
    if (
      Object.keys(value).sort().join(",") !==
        "exp,iat,nonce,referenceId,sessionId,sub" ||
      value.sub !== TOKEN_SUBJECT ||
      !Number.isSafeInteger(value.iat) ||
      !Number.isSafeInteger(value.exp) ||
      typeof value.nonce !== "string" ||
      !decodeCanonical(value.nonce, 16, 16) ||
      !googleAdsSessionIdIsValid(value.sessionId) ||
      !confirmedConsultationReferenceIsValid(value.referenceId)
    ) {
      return null;
    }
    const issuedAt = value.iat as number;
    const expiresAt = value.exp as number;
    const now = Math.floor((options.now ?? Date.now()) / 1_000);
    if (
      expiresAt !== issuedAt + GOOGLE_ADS_CONVERSION_TTL_SECONDS ||
      issuedAt > now + 60 ||
      expiresAt <= now
    ) {
      return null;
    }
    return {
      nonceHash: createHash("sha256")
        .update(value.nonce as string, "utf8")
        .digest("hex"),
      referenceId: value.referenceId as string,
      sessionId: value.sessionId as string,
    };
  } catch {
    return null;
  }
}

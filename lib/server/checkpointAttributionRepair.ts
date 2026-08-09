import { createHmac, timingSafeEqual } from "node:crypto";
import {
  CHECKPOINT_CONSULTATION_SOURCE,
  parseCheckpointConsultationAttribution,
  type CheckpointConsultationAttribution,
} from "@/lib/checkpoints/consultationAttribution";
import { persistCheckpointConsultation } from "@/lib/server/checkpointRepository";

export const CHECKPOINT_ATTRIBUTION_REPAIR_TTL_SECONDS = 30 * 60;

const TOKEN_VERSION = "v1";
const MINIMUM_SECRET_BYTES = 32;
const MAXIMUM_SECRET_BYTES = 1_024;
const MAXIMUM_TOKEN_LENGTH = 1_024;
const REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{5,119}$/;
const RETRY_DELAYS_MS = [0, 150, 450] as const;

type RepairTokenPayload = {
  checkpointCode: string;
  exp: number;
  iat: number;
  referenceId: string;
  sessionId: string;
};

export type CheckpointAttributionRepairClaim = {
  attribution: CheckpointConsultationAttribution;
  expiresAt: number;
  referenceId: string;
};

export type CheckpointAttributionPersistence = {
  saved: boolean;
  placementId: string;
};

function usableSecret(secret: string | undefined): secret is string {
  if (!secret) return false;
  const length = Buffer.byteLength(secret, "utf8");
  return length >= MINIMUM_SECRET_BYTES && length <= MAXIMUM_SECRET_BYTES;
}

export function isCheckpointAttributionRepairConfigured(
  secret = process.env.CHECKPOINT_ATTRIBUTION_REPAIR_SECRET,
): boolean {
  return usableSecret(secret);
}

function decodeCanonicalBase64Url(
  value: string,
  minimumBytes: number,
  maximumBytes: number,
): Buffer | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const decoded = Buffer.from(value, "base64url");
    if (
      decoded.byteLength < minimumBytes ||
      decoded.byteLength > maximumBytes ||
      decoded.toString("base64url") !== value
    ) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

function signature(unsignedToken: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(unsignedToken).digest();
}

function validPayload(value: unknown): value is RepairTokenPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  if (
    Object.keys(payload).sort().join(",") !==
    "checkpointCode,exp,iat,referenceId,sessionId"
  ) {
    return false;
  }
  return Boolean(
    REFERENCE_PATTERN.test(String(payload.referenceId ?? "")) &&
      Number.isSafeInteger(payload.iat) &&
      Number.isSafeInteger(payload.exp) &&
      parseCheckpointConsultationAttribution({
        source: CHECKPOINT_CONSULTATION_SOURCE,
        checkpointCode: payload.checkpointCode,
        sessionId: payload.sessionId,
      }),
  );
}

export function createCheckpointAttributionRepairToken(
  input: {
    attribution: CheckpointConsultationAttribution;
    referenceId: string;
  },
  options: { now?: number; secret?: string } = {},
): string | null {
  const secret = options.secret ?? process.env.CHECKPOINT_ATTRIBUTION_REPAIR_SECRET;
  if (!usableSecret(secret) || !REFERENCE_PATTERN.test(input.referenceId)) return null;
  const attribution = parseCheckpointConsultationAttribution(input.attribution);
  if (!attribution) return null;

  const issuedAt = Math.floor((options.now ?? Date.now()) / 1_000);
  const payload: RepairTokenPayload = {
    checkpointCode: attribution.checkpointCode,
    exp: issuedAt + CHECKPOINT_ATTRIBUTION_REPAIR_TTL_SECONDS,
    iat: issuedAt,
    referenceId: input.referenceId,
    sessionId: attribution.sessionId,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const unsignedToken = `${TOKEN_VERSION}.${encodedPayload}`;
  return `${unsignedToken}.${signature(unsignedToken, secret).toString("base64url")}`;
}

export function verifyCheckpointAttributionRepairToken(
  token: unknown,
  options: { now?: number; secret?: string } = {},
): CheckpointAttributionRepairClaim | null {
  const secret = options.secret ?? process.env.CHECKPOINT_ATTRIBUTION_REPAIR_SECRET;
  if (
    !usableSecret(secret) ||
    typeof token !== "string" ||
    token.length < 1 ||
    token.length > MAXIMUM_TOKEN_LENGTH
  ) {
    return null;
  }
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) return null;

  const suppliedSignature = decodeCanonicalBase64Url(parts[2], 32, 32);
  if (!suppliedSignature) return null;
  const unsignedToken = `${TOKEN_VERSION}.${parts[1]}`;
  const expectedSignature = signature(unsignedToken, secret);
  if (!timingSafeEqual(suppliedSignature, expectedSignature)) return null;

  const payloadBytes = decodeCanonicalBase64Url(parts[1], 2, 512);
  if (!payloadBytes) return null;
  try {
    const payload = JSON.parse(payloadBytes.toString("utf8")) as unknown;
    if (!validPayload(payload)) return null;
    const issuedAt = payload.iat as number;
    const expiresAt = payload.exp as number;
    const nowSeconds = Math.floor((options.now ?? Date.now()) / 1_000);
    if (
      expiresAt !== issuedAt + CHECKPOINT_ATTRIBUTION_REPAIR_TTL_SECONDS ||
      issuedAt > nowSeconds + 60 ||
      expiresAt <= nowSeconds
    ) {
      return null;
    }
    const attribution = parseCheckpointConsultationAttribution({
      source: CHECKPOINT_CONSULTATION_SOURCE,
      checkpointCode: payload.checkpointCode,
      sessionId: payload.sessionId,
    });
    if (!attribution) return null;
    return {
      attribution,
      expiresAt: expiresAt * 1_000,
      referenceId: payload.referenceId,
    };
  } catch {
    return null;
  }
}

export async function recordCheckpointAttribution(
  attribution: CheckpointConsultationAttribution | undefined,
  referenceId: string,
): Promise<CheckpointAttributionPersistence> {
  if (!attribution) return { saved: false, placementId: "" };
  let lastError: unknown;

  for (const delayMs of RETRY_DELAYS_MS) {
    if (delayMs > 0) {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
    }
    try {
      const result = await persistCheckpointConsultation({
        anonymousSessionId: attribution.sessionId,
        checkpointCode: attribution.checkpointCode,
        consultationReferenceId: referenceId,
        status: "submitted",
      });
      if (result.accepted) {
        return { saved: true, placementId: result.placementId || "" };
      }
      lastError = new Error("checkpoint attribution was not accepted");
    } catch (error) {
      lastError = error;
    }
  }

  console.error(
    `checkpoint-attribution: persistence failed ${referenceId} ${attribution.checkpointCode}`,
    lastError instanceof Error ? lastError.name : "unknown",
  );
  return { saved: false, placementId: "" };
}

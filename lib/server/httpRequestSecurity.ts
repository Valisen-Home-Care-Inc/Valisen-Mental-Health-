import { NextRequest } from "next/server";

export type BoundedJsonResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: "invalid" | "too_large" };

export function hasJsonContentType(request: NextRequest): boolean {
  return (
    request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ===
    "application/json"
  );
}

/**
 * Compare the complete browser Origin (scheme + host + port) with both the
 * canonical request URL and the platform-forwarded public origin.
 */
export function isSameOriginRequest(request: NextRequest): boolean {
  const rawOrigin = request.headers.get("origin")?.trim();
  if (!rawOrigin) return false;

  try {
    const suppliedOrigin = new URL(rawOrigin);
    if (
      suppliedOrigin.origin !== rawOrigin ||
      suppliedOrigin.username ||
      suppliedOrigin.password
    ) {
      return false;
    }

    const expectedOrigins = new Set([request.nextUrl.origin]);
    const forwardedHost =
      request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
      request.headers.get("host")?.trim();
    const forwardedProto =
      request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
      request.nextUrl.protocol.replace(":", "");

    if (forwardedHost && (forwardedProto === "https" || forwardedProto === "http")) {
      expectedOrigins.add(new URL(`${forwardedProto}://${forwardedHost}`).origin);
    }

    return expectedOrigins.has(suppliedOrigin.origin);
  } catch {
    return false;
  }
}

/** Enforce a real byte cap even when Content-Length is absent or dishonest. */
export async function readBoundedJson(
  request: NextRequest,
  maximumBytes: number,
): Promise<BoundedJsonResult> {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1) {
    return { ok: false, reason: "invalid" };
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const contentLength = Number(declaredLength);
    if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
      return { ok: false, reason: "invalid" };
    }
    if (contentLength > maximumBytes) {
      return { ok: false, reason: "too_large" };
    }
  }

  const reader = request.body?.getReader();
  if (!reader) return { ok: false, reason: "invalid" };

  const chunks: Uint8Array[] = [];
  let bytesRead = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      bytesRead += value.byteLength;
      if (bytesRead > maximumBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, reason: "too_large" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: "invalid" };
  } finally {
    reader.releaseLock();
  }

  let rawBody: string;
  try {
    rawBody = new TextDecoder("utf-8", { fatal: true }).decode(
      Buffer.concat(chunks, bytesRead),
    );
  } catch {
    return { ok: false, reason: "invalid" };
  }

  try {
    return { ok: true, value: JSON.parse(rawBody) as unknown };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}

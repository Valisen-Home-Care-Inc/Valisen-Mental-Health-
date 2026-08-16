import { NextRequest } from "next/server";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  CHECKPOINT_ADMIN_COOKIE_NAME,
  CHECKPOINT_ADMIN_SESSION_TTL_SECONDS,
  createCheckpointAdminSessionToken,
  hashCheckpointAdminPassword,
  isCheckpointAdminMutationRequest,
  requireCheckpointAdminApi,
  sanitizeCheckpointAdminReturnPath,
  verifyCheckpointAdminPassword,
  verifyCheckpointAdminSessionToken,
} from "@/lib/server/checkpointAdminAuth";

const PASSWORD = "correct horse battery staple";
const SECRET = "test-only-session-secret-that-is-well-over-thirty-two-bytes";
const NOW = Date.UTC(2026, 7, 6, 14, 30, 0);
const NONCE = Buffer.alloc(16, 0x5c).toString("base64url");

let passwordHash = "";

beforeAll(async () => {
  passwordHash = await hashCheckpointAdminPassword(PASSWORD, {
    iterations: 210_000,
    salt: Buffer.alloc(24, 0x2a),
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("checkpoint admin password verification", () => {
  it("accepts the matching PBKDF2 password and rejects a wrong password", async () => {
    await expect(verifyCheckpointAdminPassword(PASSWORD, passwordHash)).resolves.toBe(true);
    await expect(verifyCheckpointAdminPassword("not the password", passwordHash)).resolves.toBe(
      false,
    );
  });

  it("fails closed for missing or malformed password configuration", async () => {
    await expect(verifyCheckpointAdminPassword(PASSWORD, undefined)).resolves.toBe(false);
    await expect(
      verifyCheckpointAdminPassword(
        PASSWORD,
        "pbkdf2_sha256$1000$not-a-valid-salt$not-a-valid-hash",
      ),
    ).resolves.toBe(false);
  });

  it("rejects an empty password even if configuration is present", async () => {
    await expect(verifyCheckpointAdminPassword("", passwordHash)).resolves.toBe(false);
  });
});

describe("checkpoint admin HMAC sessions", () => {
  it("creates a valid, scoped session with an exact eight-hour lifetime", () => {
    const token = createCheckpointAdminSessionToken(SECRET, { now: NOW, nonce: NONCE });
    const session = verifyCheckpointAdminSessionToken(token, SECRET, NOW);

    expect(session).toMatchObject({ sub: "checkpoint-admin", nonce: NONCE });
    expect(session!.exp - session!.iat).toBe(CHECKPOINT_ADMIN_SESSION_TTL_SECONDS);
  });

  it("rejects tampering, the wrong secret, and malformed tokens", () => {
    const token = createCheckpointAdminSessionToken(SECRET, { now: NOW, nonce: NONCE });
    const signature = token.at(-1) === "A" ? "B" : "A";
    const tampered = `${token.slice(0, -1)}${signature}`;

    expect(verifyCheckpointAdminSessionToken(tampered, SECRET, NOW)).toBeNull();
    expect(
      verifyCheckpointAdminSessionToken(
        token,
        "a-different-test-secret-that-is-also-at-least-thirty-two-bytes",
        NOW,
      ),
    ).toBeNull();
    expect(verifyCheckpointAdminSessionToken("v1.invalid.short", SECRET, NOW)).toBeNull();
  });

  it("rejects an expired session at the expiry boundary", () => {
    const token = createCheckpointAdminSessionToken(SECRET, { now: NOW, nonce: NONCE });
    const expiresAt = NOW + CHECKPOINT_ADMIN_SESSION_TTL_SECONDS * 1_000;

    expect(verifyCheckpointAdminSessionToken(token, SECRET, expiresAt - 1_000)).not.toBeNull();
    expect(verifyCheckpointAdminSessionToken(token, SECRET, expiresAt)).toBeNull();
  });

  it("fails closed when the signing secret is missing or too weak", () => {
    const token = createCheckpointAdminSessionToken(SECRET, { now: NOW, nonce: NONCE });
    expect(verifyCheckpointAdminSessionToken(token, undefined, NOW)).toBeNull();
    expect(verifyCheckpointAdminSessionToken(token, "too-short", NOW)).toBeNull();
    expect(() => createCheckpointAdminSessionToken("too-short")).toThrow();
  });
});

describe("checkpoint admin request guards", () => {
  it("returns 401 for a missing or invalid API session and accepts a valid one", async () => {
    vi.stubEnv("CHECKPOINT_ADMIN_SESSION_SECRET", SECRET);
    const missing = new NextRequest("https://valisenmentalhealth.com/api/admin/checkpoints");
    const missingResponse = requireCheckpointAdminApi(missing);
    expect(missingResponse?.status).toBe(401);
    await expect(missingResponse?.json()).resolves.toEqual({
      error: "Authentication required.",
    });

    const invalid = new NextRequest("https://valisenmentalhealth.com/api/admin/checkpoints", {
      headers: { Cookie: `${CHECKPOINT_ADMIN_COOKIE_NAME}=invalid` },
    });
    expect(requireCheckpointAdminApi(invalid)?.status).toBe(401);

    const token = createCheckpointAdminSessionToken(SECRET);
    const authenticated = new NextRequest(
      "https://valisenmentalhealth.com/api/admin/checkpoints",
      { headers: { Cookie: `${CHECKPOINT_ADMIN_COOKIE_NAME}=${token}` } },
    );
    expect(requireCheckpointAdminApi(authenticated)).toBeNull();
  });

  it("requires an exact same-origin mutation request", () => {
    const sameOrigin = new NextRequest(
      "https://valisenmentalhealth.com/api/admin/checkpoints/session",
      { method: "POST", headers: { Origin: "https://valisenmentalhealth.com" } },
    );
    const crossOrigin = new NextRequest(
      "https://valisenmentalhealth.com/api/admin/checkpoints/session",
      { method: "POST", headers: { Origin: "https://attacker.example" } },
    );
    const sameSiteOnly = new NextRequest(
      "https://valisenmentalhealth.com/api/admin/checkpoints/session",
      {
        method: "POST",
        headers: {
          Origin: "https://valisenmentalhealth.com",
          "Sec-Fetch-Site": "same-site",
        },
      },
    );

    expect(isCheckpointAdminMutationRequest(sameOrigin)).toBe(true);
    expect(isCheckpointAdminMutationRequest(crossOrigin)).toBe(false);
    expect(isCheckpointAdminMutationRequest(sameSiteOnly)).toBe(false);
  });

  it("does not allow an external post-login redirect", () => {
    expect(sanitizeCheckpointAdminReturnPath("https://attacker.example")).toBe(
      "/admin/checkpoints/quiz",
    );
    expect(sanitizeCheckpointAdminReturnPath("//attacker.example/admin/checkpoints")).toBe(
      "/admin/checkpoints/quiz",
    );
    expect(sanitizeCheckpointAdminReturnPath(undefined)).toBe(
      "/admin/checkpoints/quiz",
    );
    expect(sanitizeCheckpointAdminReturnPath("/admin/checkpoints/consultations")).toBe(
      "/admin/checkpoints/consultations",
    );
    expect(sanitizeCheckpointAdminReturnPath("/admin/checkpoints/VMH-04?range=30d")).toBe(
      "/admin/checkpoints/VMH-04?range=30d",
    );
  });
});

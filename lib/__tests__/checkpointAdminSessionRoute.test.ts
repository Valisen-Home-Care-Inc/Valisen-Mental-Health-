import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, POST } from "@/app/api/admin/checkpoints/session/route";
import {
  CHECKPOINT_ADMIN_COOKIE_NAME,
  createCheckpointAdminSessionToken,
  hashCheckpointAdminPassword,
} from "@/lib/server/checkpointAdminAuth";
import { resetRateLimitState } from "@/lib/server/rateLimit";
import { verifyTurnstile } from "@/lib/server/turnstile";

vi.mock("@/lib/server/turnstile", () => ({
  verifyTurnstile: vi.fn(),
}));

const ORIGIN = "https://valisenmentalhealth.com";
const PASSWORD = "a secure admin password";
const SECRET = "route-test-session-secret-that-is-longer-than-thirty-two-bytes";
const TURNSTILE_TOKEN = "admin-turnstile-token";
let passwordHash = "";
const verifyTurnstileMock = vi.mocked(verifyTurnstile);

function loginBody(password = PASSWORD) {
  return { password, turnstileToken: TURNSTILE_TOKEN };
}

function postRequest(body: unknown, origin = ORIGIN) {
  return new NextRequest(`${ORIGIN}/api/admin/checkpoints/session?next=%2Fadmin%2Fcheckpoints`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  passwordHash = await hashCheckpointAdminPassword(PASSWORD, {
    iterations: 210_000,
    salt: Buffer.alloc(24, 0x3b),
  });
});

beforeEach(() => {
  resetRateLimitState();
  vi.stubEnv("CHECKPOINT_ADMIN_PASSWORD_HASH", passwordHash);
  vi.stubEnv("CHECKPOINT_ADMIN_SESSION_SECRET", SECRET);
  verifyTurnstileMock.mockReset();
  verifyTurnstileMock.mockResolvedValue({ ok: true });
});

afterAll(() => vi.unstubAllEnvs());

describe("checkpoint admin session route", () => {
  it("creates a locked-down eight-hour cookie for a valid password", async () => {
    const response = await POST(postRequest(loginBody()));
    const cookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      redirectTo: "/admin/checkpoints",
    });
    expect(cookie).toContain(`${CHECKPOINT_ADMIN_COOKIE_NAME}=`);
    expect(cookie).toMatch(/Max-Age=28800/i);
    expect(cookie).toMatch(/Path=\//i);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=strict/i);
    expect(verifyTurnstileMock).toHaveBeenCalledWith(
      expect.any(NextRequest),
      TURNSTILE_TOKEN,
      "checkpoint_admin_login",
      expect.stringContaining(TURNSTILE_TOKEN),
    );
  });

  it("rejects a wrong password without issuing a session", async () => {
    const response = await POST(postRequest(loginBody("wrong password")));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: expect.any(String) });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("rejects cross-origin login before credential processing", async () => {
    const response = await POST(postRequest(loginBody(), "https://attacker.example"));
    expect(response.status).toBe(403);
    expect(verifyTurnstileMock).not.toHaveBeenCalled();
  });

  it("requires a valid Turnstile challenge before checking the password", async () => {
    verifyTurnstileMock.mockResolvedValueOnce({ ok: false, reason: "invalid" });
    const invalid = await POST(postRequest(loginBody()));
    expect(invalid.status).toBe(400);
    expect(invalid.headers.get("set-cookie")).toBeNull();

    verifyTurnstileMock.mockResolvedValueOnce({ ok: false, reason: "unavailable" });
    const unavailable = await POST(postRequest(loginBody()));
    expect(unavailable.status).toBe(503);
  });

  it("rejects a missing Turnstile token as an invalid request", async () => {
    const response = await POST(postRequest({ password: PASSWORD }));
    expect(response.status).toBe(400);
    expect(verifyTurnstileMock).not.toHaveBeenCalled();
  });

  it("rate limits repeated sign-in attempts through the shared server limiter", async () => {
    for (let attempt = 0; attempt < 7; attempt += 1) {
      const response = await POST(postRequest({ unexpected: true }));
      expect(response.status).toBe(400);
    }
    const limited = await POST(postRequest({ unexpected: true }));
    expect(limited.status).toBe(429);
  });

  it("fails safely when authentication configuration is missing", async () => {
    vi.stubEnv("CHECKPOINT_ADMIN_PASSWORD_HASH", "");
    const response = await POST(postRequest(loginBody()));
    expect(response.status).toBe(503);
  });

  it("returns 401 when logout has no valid authenticated session", async () => {
    const response = await DELETE(
      new NextRequest(`${ORIGIN}/api/admin/checkpoints/session`, {
        method: "DELETE",
        headers: { Origin: ORIGIN },
      }),
    );
    expect(response.status).toBe(401);
  });

  it("clears an authenticated session cookie on logout", async () => {
    const token = createCheckpointAdminSessionToken(SECRET);
    const response = await DELETE(
      new NextRequest(`${ORIGIN}/api/admin/checkpoints/session`, {
        method: "DELETE",
        headers: {
          Origin: ORIGIN,
          Cookie: `${CHECKPOINT_ADMIN_COOKIE_NAME}=${token}`,
        },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toMatch(/Max-Age=0/i);
  });
});

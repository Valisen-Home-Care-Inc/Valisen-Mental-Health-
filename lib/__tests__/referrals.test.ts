import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { rpc, verify, track } = vi.hoisted(() => ({ rpc: vi.fn(), verify: vi.fn(), track: vi.fn() }));
vi.mock("@/lib/server/supabaseServer", () => ({ callSupabaseRpc: rpc }));
vi.mock("@/lib/server/turnstile", () => ({ verifyTurnstile: verify }));
vi.mock("@/lib/funnelTracking", () => ({ recordFirstPartyFunnelEvent: track }));
import { POST } from "@/app/api/referrals/route";
import { EMPTY_REFERRAL, REFERRAL_CONSENT_VERSION, validateReferral } from "@/lib/referrals";
import { REFERRAL_EVENTS, trackReferralEvent } from "@/lib/referralAnalytics";
import { resetRateLimitState } from "@/lib/server/rateLimit";
import { isSensitiveGoogleAdsMarketingPath, shouldLoadSiteAnalytics } from "@/lib/analyticsBoundary";

const fields = { ...EMPTY_REFERRAL, providerName: "Test Provider", providerRole: "Nurse", organization: "Test Clinic", providerPhone: "613-555-0101", providerEmail: "provider@example.invalid", patientName: "Synthetic Patient", patientPhone: "613-555-0102", reason: "Anxiety", consent: true };
const envelope = () => ({ fields, submissionId: "c1b0a5d4-1963-4f79-bdf4-83ac944fe308", consentVersion: REFERRAL_CONSENT_VERSION, turnstileToken: "synthetic-token", website: "" });
function request(body: unknown = envelope(), origin = "https://valisenmentalhealth.com") {
  return new NextRequest("https://valisenmentalhealth.com/api/referrals", { method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify(body) });
}
beforeEach(() => { vi.stubEnv("REFERRALS_ENABLED", "true"); resetRateLimitState(); rpc.mockReset().mockResolvedValue(null); verify.mockReset().mockResolvedValue({ ok: true }); track.mockReset(); });
afterEach(() => vi.unstubAllEnvs());

describe("provider referral intake", () => {
  it("requires authorization and the selected patient contact method", () => {
    expect(validateReferral(fields).ok).toBe(true);
    const result = validateReferral({ ...fields, contactMethod: "email", patientEmail: "", consent: false });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toMatchObject({ patientEmail: expect.any(String), consent: expect.any(String) });
    expect(validateReferral({ ...fields, reason: "injected reason", therapist: "unknown", notes: "x".repeat(1001) }).ok).toBe(false);
  });
  it("fails closed when collection is disabled", async () => {
    vi.stubEnv("REFERRALS_ENABLED", "false");
    expect((await POST(request())).status).toBe(503);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects cross-origin, oversized, honeypot and invalid authorization requests", async () => {
    expect((await POST(request(envelope(), "https://attacker.invalid"))).status).toBe(403);
    expect((await POST(request({ notes: "x".repeat(13000) }))).status).toBe(413);
    expect((await POST(request({ ...envelope(), website: "bot" }))).status).toBe(400);
    expect((await POST(request({ ...envelope(), fields: { ...fields, consent: false } }))).status).toBe(422);
    expect((await POST(request({ ...envelope(), consentVersion: "old" }))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("requires verified Turnstile before persistence", async () => {
    verify.mockResolvedValue({ ok: false, reason: "invalid" });
    expect((await POST(request())).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("persists only validated fields and acknowledges only durable receipt", async () => {
    const response = await POST(request({ ...envelope(), gclid: "not-stored", fields: { ...fields, extra: "not-stored" } }));
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(rpc).toHaveBeenCalledWith("submit_provider_referral", { p_id: envelope().submissionId, p_details: fields, p_consent_version: REFERRAL_CONSENT_VERSION });
    rpc.mockRejectedValue(new Error("private upstream failure"));
    const failed = await POST(request());
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain("private upstream failure");
    expect(track).not.toHaveBeenCalled();
  });
  it("rate limits repeated submissions", async () => {
    for (let i = 0; i < 10; i++) await POST(request());
    expect((await POST(request())).status).toBe(429);
    expect(rpc).toHaveBeenCalledTimes(10);
  });
});
describe("referral measurement privacy", () => {
  it("emits fixed event names with no form payload or patient identifiers", () => {
    for (const event of REFERRAL_EVENTS) trackReferralEvent(event);
    expect(track.mock.calls).toEqual(REFERRAL_EVENTS.map(event => [event, { page: "sitewide" }]));
  });
  it("disables marketing on both canonical and trailing slash routes", () => {
    for (const path of ["/referrals", "/referrals/", "/referrals/therapists/ryann-simpson", "/referrals/privacy-policy"]) {
      expect(shouldLoadSiteAnalytics(path)).toBe(false);
      expect(isSensitiveGoogleAdsMarketingPath(path)).toBe(true);
    }
  });
});

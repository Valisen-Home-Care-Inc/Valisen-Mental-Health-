import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prepareGoogleAdsConsultationConversion = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/googleAdsConsultationConversion", () => ({
  prepareGoogleAdsConsultationConversion,
}));

import { POST } from "@/app/api/google-ads/consultation-conversion/route";
import { createGoogleAdsJourney } from "@/lib/server/googleAdsJourneySession";

const ORIGIN = "https://valisenmentalhealth.com";
const REFERENCE_ID = "VC-ABCDEF123456";
const SECRET = "conversion-route-test-secret-with-at-least-thirty-two-bytes";

function journey() {
  const proof = createGoogleAdsJourney({
    landingPath: "/",
    search: "?utm_source=google&utm_medium=cpc&utm_campaign=general",
  });
  if (!proof) throw new Error("test journey unavailable");
  return proof;
}

function request(body: Record<string, unknown>, origin = ORIGIN) {
  return new NextRequest(`${ORIGIN}/api/google-ads/consultation-conversion`, {
    method: "POST",
    headers: {
      Origin: origin,
      Host: "valisenmentalhealth.com",
      "Content-Type": "application/json",
      "Sec-Fetch-Site": origin === ORIGIN ? "same-origin" : "cross-site",
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.stubEnv("GOOGLE_ADS_CONVERSION_SECRET", SECRET);
  prepareGoogleAdsConsultationConversion.mockReset();
  prepareGoogleAdsConsultationConversion.mockResolvedValue("signed-conversion-token");
});
afterEach(() => vi.unstubAllEnvs());

describe("Google Ads consultation conversion repair", () => {
  it("returns a per-tab receipt only after the durable link is verified", async () => {
    const proof = journey();
    const response = await POST(
      request({
        sessionId: proof.claim.sessionId,
        referenceId: REFERENCE_ID,
        journeyToken: proof.token,
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      googleAdsThankYouReady: true,
      googleAdsConversionReceipt: "signed-conversion-token",
    });
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(prepareGoogleAdsConsultationConversion).toHaveBeenCalledWith({
      sessionId: proof.claim.sessionId,
      referenceId: REFERENCE_ID,
      journey: proof.claim,
    });
  });

  it("rejects cross-origin, mismatched sessions, and expanded payloads", async () => {
    const proof = journey();
    for (const candidate of [
      request(
        {
          sessionId: proof.claim.sessionId,
          referenceId: REFERENCE_ID,
          journeyToken: proof.token,
        },
        "https://meta.example",
      ),
      request({
        sessionId: "gas-12345678-1234-4234-9234-123456789abc",
        referenceId: REFERENCE_ID,
        journeyToken: proof.token,
      }),
      request({
        sessionId: proof.claim.sessionId,
        referenceId: REFERENCE_ID,
        journeyToken: proof.token,
        email: "private@example.com",
      }),
    ]) {
      prepareGoogleAdsConsultationConversion.mockClear();
      const response = await POST(candidate);
      expect([400, 403]).toContain(response.status);
      expect(prepareGoogleAdsConsultationConversion).not.toHaveBeenCalled();
    }
  });
});

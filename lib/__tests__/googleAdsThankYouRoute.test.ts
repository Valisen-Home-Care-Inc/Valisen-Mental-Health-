import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/thank-you/confirm/route";
import {
  createGoogleAdsConversionReceipt,
  verifyGoogleAdsConversionReceipt,
} from "@/lib/server/googleAdsConversionReceipt";
import { createGoogleAdsJourney } from "@/lib/server/googleAdsJourneySession";

const SECRET = "thank-you-route-test-secret-with-at-least-thirty-two-bytes";
const REFERENCE = "VC-ABCDEF123456";
const consumeGoogleAdsConversion = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/googleAdsRepository", () => ({
  consumeGoogleAdsConversion,
}));

function proof() {
  const result = createGoogleAdsJourney({
    landingPath: "/",
    search: "?utm_source=google&utm_medium=cpc&utm_campaign=general",
  });
  if (!result) throw new Error("test journey unavailable");
  const conversionReceipt = createGoogleAdsConversionReceipt({
    sessionId: result.claim.sessionId,
    referenceId: REFERENCE,
  });
  if (!conversionReceipt) throw new Error("test conversion receipt unavailable");
  const conversionClaim = verifyGoogleAdsConversionReceipt(conversionReceipt);
  if (!conversionClaim) throw new Error("test conversion claim unavailable");
  return { ...result, conversionClaim, conversionReceipt };
}

function request(body: Record<string, unknown>) {
  return new NextRequest("https://valisenmentalhealth.com/thank-you/confirm", {
    method: "POST",
    headers: {
      Origin: "https://valisenmentalhealth.com",
      Host: "valisenmentalhealth.com",
      "Content-Type": "application/json",
      "Sec-Fetch-Site": "same-origin",
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.stubEnv("GOOGLE_ADS_CONVERSION_SECRET", SECRET);
  consumeGoogleAdsConversion.mockReset();
  consumeGoogleAdsConversion.mockResolvedValue({ accepted: true });
});
afterEach(() => vi.unstubAllEnvs());

describe("Google Ads thank-you confirmation", () => {
  it("atomically consumes matching per-tab journey and conversion receipts", async () => {
    const claim = proof();
    const response = await POST(
      request({
        journeyToken: claim.token,
        conversionReceipt: claim.conversionReceipt,
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      conversionId: `gac-${claim.conversionClaim.nonceHash.slice(0, 32)}`,
    });
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(consumeGoogleAdsConversion).toHaveBeenCalledWith({
      sessionId: claim.claim.sessionId,
      referenceId: REFERENCE,
      nonceHash: claim.conversionClaim.nonceHash,
    });
  });

  it("does not confirm a direct visit, tamper, or another tab's receipt", async () => {
    const first = proof();
    const second = proof();
    for (const body of [
      {},
      { journeyToken: `${first.token}x`, conversionReceipt: first.conversionReceipt },
      { journeyToken: first.token, conversionReceipt: second.conversionReceipt },
    ]) {
      consumeGoogleAdsConversion.mockClear();
      const response = await POST(request(body));
      expect(response.status).toBe(403);
      expect(consumeGoogleAdsConversion).not.toHaveBeenCalled();
    }
  });

  it("returns 409 when a different receipt already claimed the conversion", async () => {
    consumeGoogleAdsConversion.mockResolvedValue({ accepted: false });
    const claim = proof();
    const response = await POST(
      request({
        journeyToken: claim.token,
        conversionReceipt: claim.conversionReceipt,
      }),
    );
    expect(response.status).toBe(409);
  });

  it("returns the same conversion ID when a committed response is retried", async () => {
    consumeGoogleAdsConversion.mockResolvedValue({
      accepted: true,
      replayed: true,
    });
    const claim = proof();
    const body = {
      journeyToken: claim.token,
      conversionReceipt: claim.conversionReceipt,
    };
    const first = await POST(request(body));
    const retry = await POST(request(body));
    expect(first.status).toBe(200);
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual(await first.json());
  });

  it("keeps a valid per-tab receipt retryable while storage is unavailable", async () => {
    consumeGoogleAdsConversion.mockRejectedValue(new Error("unavailable"));
    const claim = proof();
    const response = await POST(
      request({
        journeyToken: claim.token,
        conversionReceipt: claim.conversionReceipt,
      }),
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("2");
  });
});

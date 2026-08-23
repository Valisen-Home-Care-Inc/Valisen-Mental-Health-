import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const callSupabaseRpc = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/supabaseServer", () => ({ callSupabaseRpc }));

import {
  consumeGoogleAdsConversion,
  linkGoogleAdsConsultation,
} from "@/lib/server/googleAdsRepository";

const SESSION_ID = "gas-12345678-1234-4234-9234-123456789abc";
const REFERENCE_ID = "VC-ABCDEF123456";

beforeEach(() => {
  callSupabaseRpc.mockReset().mockImplementation((name: string) => {
    if (name === "ensure_google_ads_session") return { accepted: true };
    if (name === "link_google_ads_consultation") {
      return {
        accepted: true,
        linked: true,
        sessionId: SESSION_ID,
        referenceId: REFERENCE_ID,
      };
    }
    return { accepted: true };
  });
});

describe("Google Ads durable repository boundaries", () => {
  it("ensures a signed session before linking an intake", async () => {
    await expect(
      linkGoogleAdsConsultation({
        sessionId: SESSION_ID,
        referenceId: REFERENCE_ID,
        submittedAt: "2026-08-23T12:05:00.000Z",
        journey: {
          attribution: {
            source: "google",
            medium: "cpc",
            campaign: "campaign_7",
            content: "creative_2",
          },
          googleClickIdPresent: true,
          landingPath: "/lp/anxiety-therapy",
          startedAt: "2026-08-23T12:00:00.000Z",
        },
      }),
    ).resolves.toMatchObject({ accepted: true, linked: true });

    expect(callSupabaseRpc.mock.calls.map(([name]) => name)).toEqual([
      "ensure_google_ads_session",
      "link_google_ads_consultation",
    ]);
    expect(callSupabaseRpc).toHaveBeenNthCalledWith(
      1,
      "ensure_google_ads_session",
      expect.objectContaining({
        p_session_key: SESSION_ID,
        p_landing_path: "/lp/anxiety-therapy",
        p_utm_source: "google",
        p_google_click_id_present: true,
      }),
      3_000,
    );
  });

  it("passes the signed receipt nonce hash to retry-idempotent consumption", async () => {
    const nonceHash = "a".repeat(64);
    await consumeGoogleAdsConversion({
      sessionId: SESSION_ID,
      referenceId: REFERENCE_ID,
      nonceHash,
    });
    expect(callSupabaseRpc).toHaveBeenCalledWith(
      "consume_google_ads_conversion",
      {
        p_session_key: SESSION_ID,
        p_reference_id: REFERENCE_ID,
        p_nonce_hash: nonceHash,
      },
      5_000,
    );
  });

  it("ships the forward-only session, nonce, tab, and retention hardening", () => {
    const sql = readFileSync(
      resolve(
        process.cwd(),
        "supabase/migrations/20260823010000_google_ads_same_domain_hardening.sql",
      ),
      "utf8",
    );
    expect(sql).toContain("ensure_google_ads_session");
    expect(sql).toContain("conversion_claim_nonce_hash");
    expect(sql).toContain("drop constraint google_ads_events_session_sequence_unique");
    expect(sql).toContain("prune_google_ads_analytics");
  });
});

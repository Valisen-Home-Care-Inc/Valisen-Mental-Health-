import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const callSupabaseRpc = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/supabaseServer", () => ({ callSupabaseRpc }));

import {
  consumeGoogleAdsConversion,
  fetchGoogleAdsTestDashboard,
  linkGoogleAdsConsultation,
} from "@/lib/server/googleAdsRepository";
import { fetchConsultationTestManager } from "@/lib/server/growthRepository";

const SESSION_ID = "gas-12345678-1234-4234-9234-123456789abc";
const REFERENCE_ID = "VC-ABCDEF123456";

beforeEach(() => {
  callSupabaseRpc.mockReset().mockImplementation(async (name: string) => {
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

  it("uses protected service-role RPCs for Google Ads QA views", async () => {
    const from = "2026-08-23T00:00:00.000Z";
    const to = "2026-08-24T00:00:00.000Z";

    await fetchGoogleAdsTestDashboard(from, to);
    await fetchConsultationTestManager({
      from,
      to,
      source: "google_ads",
      limit: 25,
    });

    expect(callSupabaseRpc).toHaveBeenCalledWith(
      "get_google_ads_test_dashboard",
      { p_from: from, p_to: to },
      15_000,
    );
    expect(callSupabaseRpc).toHaveBeenCalledWith(
      "get_consultation_test_manager",
      {
        p_from: from,
        p_to: to,
        p_workflow_status: null,
        p_conversion_stage: null,
        p_source_kind: "google_ads",
        p_search: null,
        p_limit: 25,
        p_offset: 0,
      },
      15_000,
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

  it("ships fail-closed Google Ads QA classification and protected mirrors", () => {
    const sql = readFileSync(
      resolve(
        process.cwd(),
        "supabase/migrations/20260823030000_google_ads_test_qa_visibility.sql",
      ),
      "utf8",
    );
    expect(sql).toContain("utmCampaign'), '') = 'manual_test'");
    expect(sql).toContain("classify_manual_google_ads_consultation");
    expect(sql).toContain(
      "new.source_kind = 'google_ads' and new.utm_campaign = 'manual_test'",
    );
    expect(sql).toContain("new.lead_id is not null");
    expect(sql).toContain("where lead.id = new.lead_id");
    expect(sql).toContain("request.lead_id = lead.id");
    expect(sql).toContain("before insert or update on public.consultation_leads");
    expect(sql).toContain("before insert or update on public.consultation_requests");
    expect(sql).toContain(
      "revoke all on function public.classify_manual_google_ads_consultation()",
    );
    expect(sql).toContain("session.is_test is distinct from v_is_test");
    expect(sql).toContain("lead.is_test or request.is_test");
    expect(sql).toContain("and not ads_session.is_test");
    expect(sql).toContain("and ads_session.is_test");
    expect(sql).toContain("v_request_activity_start := strpos(");
    expect(sql).toContain("v_request_activity_end := strpos(");
    expect(sql).toContain(
      "v_request_activity_from || E'\\n    where request.is_test'",
    );
    expect(sql).not.toContain("v_request_activity_anchor");
    expect(sql).toContain("get_google_ads_test_dashboard");
    expect(sql).toContain("get_consultation_test_manager");
    expect(sql).toContain("to service_role");
  });
});

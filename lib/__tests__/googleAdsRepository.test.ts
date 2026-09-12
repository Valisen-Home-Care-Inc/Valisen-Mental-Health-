import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const callSupabaseRpc = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/supabaseServer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/server/supabaseServer")>()),
  callSupabaseRpc,
}));

import {
  consumeGoogleAdsConversion,
  fetchGoogleAdsEventExportPage,
  fetchGoogleAdsJourneyExportPage,
  fetchGoogleAdsTestDashboard,
  fetchGoogleAdsDashboard,
  fetchGoogleAdsReportRows,
  findGoogleAdsSessionIdentity,
  linkGoogleAdsConsultation,
  seedGoogleAdsSession,
} from "@/lib/server/googleAdsRepository";
import { fetchConsultationTestManager } from "@/lib/server/growthRepository";
import { SupabaseServerError } from "@/lib/server/supabaseServer";

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
  it("recovers duplicate entry identities through protected exports, including QA sessions", async () => {
    callSupabaseRpc.mockImplementation(async (name: string, input: { p_test: boolean }) => {
      if (name !== "export_google_ads_journeys") throw new Error("Unexpected identity lookup");
      return input.p_test ? [{ sessionId: SESSION_ID, startedAt: new Date().toISOString(),
        landingPath: "/welcome", source: "google", medium: "cpc", campaign: "qa" }] : [];
    });
    expect(await findGoogleAdsSessionIdentity(SESSION_ID, "/welcome")).toMatchObject({
      sessionId: SESSION_ID, attribution: { source: "google", campaign: "qa" },
    });
    expect(await findGoogleAdsSessionIdentity(SESSION_ID, "/")).toBeNull();
  });

  it("counts two request references belonging to one lead as one booked opportunity", async () => {
    const otherReference = "VC-ABCDEF654321";
    callSupabaseRpc.mockImplementation(async (name: string, input: { p_request_reference?: string }) => {
      if (name === "export_google_ads_journeys") return [REFERENCE_ID, otherReference].map((reference, index) => ({
        sessionId: `${SESSION_ID}${index}`, startedAt: "2026-09-11T14:14:00.000Z", landingPath: "/welcome",
        eventCount: 2, consultationSubmitted: true, consultationReferenceId: reference, booked: true, paidTherapy: true,
      }));
      if (name === "export_google_ads_journey_events") return [];
      if (name === "repair_consultation_request_attribution") return { accepted: true,
        requestReference: input.p_request_reference, leadId: "same-lead" };
      return {};
    });
    const report = await fetchGoogleAdsDashboard("2026-09-01T04:00:00.000Z", "2026-09-12T04:00:00.000Z", "/welcome");
    expect(report).toMatchObject({ kpis: { sessions: 2, consultationRequests: 2, consultationOpportunities: 1,
      bookedConsultations: 1, paidTherapyConversions: 1 } });
    expect(JSON.stringify(report)).not.toContain("same-lead");
  });

  it("reads every export page before calculating a final URL's totals", async () => {
    const from = "2026-09-01T04:00:00.000Z";
    const to = "2026-09-12T04:00:00.000Z";
    const row = (id: number) => ({ sessionId: `gas-00000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
      startedAt: "2026-09-11T14:14:00.000Z", landingPath: id === 1000 ? "/welcome" : "/", eventCount: 1, engagedMs: 10_000 });
    callSupabaseRpc.mockImplementation(async (name: string, input: { p_offset: number }) => {
      if (name === "export_google_ads_journeys") return input.p_offset === 0 ? Array.from({ length: 1000 }, (_, id) => row(id)) : [row(1000)];
      if (name === "export_google_ads_journey_events") return [];
      return {};
    });
    const data = await fetchGoogleAdsDashboard(from, to, "/welcome");
    expect(data).toMatchObject({ landingPath: "/welcome", kpis: { sessions: 1, averageEngagedMs: 10_000 } });
    expect(callSupabaseRpc).toHaveBeenCalledWith("export_google_ads_journeys",
      { p_from: from, p_to: to, p_test: false, p_limit: 1000, p_offset: 1000 }, 20_000);
    expect(callSupabaseRpc.mock.calls.some(([name]) => name === "get_google_ads_dashboard")).toBe(false);
    callSupabaseRpc.mockResolvedValue({ error: "bad payload" });
    await expect(fetchGoogleAdsReportRows(from, to, false)).rejects.toBeInstanceOf(SupabaseServerError);
  });

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
          landingPath: "/lp/google-ads",
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
        p_landing_path: "/lp/google-ads",
        p_utm_source: "google",
        p_google_click_id_present: true,
      }),
      3_000,
    );
  });

  it("seeds the session at click time and falls back to ensure before the migration exists", async () => {
    const seed = {
      sessionId: SESSION_ID,
      startedAt: "2026-09-03T12:00:00.000Z",
      landingPath: "/welcome",
      attribution: {
        source: "google",
        medium: "cpc",
        campaign: "Therapy Ontario Search",
        content: "vt1~a:7639334819~k:online therapy ontario",
      },
      googleClickIdPresent: true,
      valueTrack: {
        campaignId: "18124413697",
        campaignName: "Therapy Ontario Search",
        adGroupId: "7639334819",
        keyword: "online therapy ontario",
        matchType: "phrase" as const,
      },
    };
    callSupabaseRpc.mockReset().mockImplementation(async (name: string) =>
      name === "seed_google_ads_session"
        ? { accepted: true, seeded: true }
        : { accepted: true },
    );
    await expect(seedGoogleAdsSession(seed)).resolves.toEqual({
      accepted: true,
      seeded: true,
    });
    expect(callSupabaseRpc).toHaveBeenCalledWith(
      "seed_google_ads_session",
      {
        p_session_key: SESSION_ID,
        p_session_started_at: "2026-09-03T12:00:00.000Z",
        p_landing_path: "/welcome",
        p_utm_source: "google",
        p_utm_medium: "cpc",
        p_utm_campaign: "Therapy Ontario Search",
        p_utm_content: "vt1~a:7639334819~k:online therapy ontario",
        p_google_click_id_present: true,
        p_campaign_id: "18124413697",
        p_campaign_name: "Therapy Ontario Search",
        p_ad_group_id: "7639334819",
        p_ad_group_name: null,
        p_keyword: "online therapy ontario",
        p_match_type: "phrase",
        p_network: null,
        p_ad_device: null,
        p_creative_id: null,
      },
      2_500,
    );

    callSupabaseRpc.mockReset().mockImplementation(async (name: string) => {
      if (name === "seed_google_ads_session") {
        throw new SupabaseServerError("missing", 503, 404);
      }
      return { accepted: true };
    });
    await expect(seedGoogleAdsSession(seed)).resolves.toEqual({
      accepted: true,
      seeded: false,
    });
    expect(callSupabaseRpc.mock.calls.map(([name]) => name)).toEqual([
      "seed_google_ads_session",
      "ensure_google_ads_session",
    ]);
    expect(callSupabaseRpc).toHaveBeenLastCalledWith(
      "ensure_google_ads_session",
      expect.objectContaining({
        p_session_key: SESSION_ID,
        p_utm_campaign: "Therapy Ontario Search",
        p_google_click_id_present: true,
      }),
      2_500,
    );

    callSupabaseRpc.mockReset().mockRejectedValue(new SupabaseServerError("down", 503));
    await expect(seedGoogleAdsSession(seed)).rejects.toBeInstanceOf(SupabaseServerError);
  });

  it("pages the privacy-safe export RPCs", async () => {
    const from = "2026-09-01T04:00:00.000Z";
    const to = "2026-09-03T18:00:00.000Z";
    await fetchGoogleAdsJourneyExportPage({ from, to, test: false, limit: 1_000, offset: 2_000 });
    await fetchGoogleAdsEventExportPage({ from, to, test: true, limit: 5_000, offset: 0 });
    expect(callSupabaseRpc).toHaveBeenCalledWith(
      "export_google_ads_journeys",
      { p_from: from, p_to: to, p_test: false, p_limit: 1_000, p_offset: 2_000 },
      20_000,
    );
    expect(callSupabaseRpc).toHaveBeenCalledWith(
      "export_google_ads_journey_events",
      { p_from: from, p_to: to, p_test: true, p_limit: 5_000, p_offset: 0 },
      20_000,
    );
  });

  it("ships the click-attribution migration with a rollback self-test", () => {
    const sql = readFileSync(
      resolve(
        process.cwd(),
        "supabase/migrations/20260903000000_google_ads_click_attribution.sql",
      ),
      "utf8",
    );
    for (const column of [
      "campaign_id", "campaign_name", "ad_group_id", "ad_group_name", "keyword",
      "match_type", "network", "ad_device", "creative_id", "seeded_at",
    ]) {
      expect(sql).toContain(`add column if not exists ${column}`);
    }
    expect(sql).toContain("create or replace function public.seed_google_ads_session(");
    expect(sql).toContain("on conflict (session_key) do nothing");
    expect(sql).toContain("get diagnostics v_inserted = row_count");
    expect(sql).toContain("google_ads_sessions_click_attribution_valid");
    expect(sql).toContain("'sessionsWithoutEvents', total.sessions_without_events");
    expect(sql).toContain("'attributedSessions', total.attributed_sessions");
    expect(sql).toContain("'campaignName', recent.campaign_name");
    expect(sql).toContain("'durationMs'");
    expect(sql).toContain("FUNCTION public.get_google_ads_test_dashboard(");
    expect(sql).toContain("v_test_definition like '%not ads_session.is_test%'");
    expect(sql).toContain("create or replace function public.export_google_ads_journeys(");
    expect(sql).toContain("create or replace function public.export_google_ads_journey_events(");
    expect(sql).not.toMatch(/'email'|'phone'|coordination_details|first_name/);
    expect(sql).toContain("select public.ingest_google_ads_events(");
    expect(sql).toContain("select public.get_google_ads_test_dashboard(");
    expect(sql).toContain("select public.export_google_ads_journeys(");
    expect(sql).toContain("when sqlstate 'ZX001' then");
    expect(sql).toContain("to service_role");
    for (const value of ["exact", "phrase", "broad", "search", "search_partners", "display", "youtube", "video_partners", "performance_max", "demand_gen", "mobile", "tablet", "desktop", "other"]) {
      expect(sql).toContain(`'${value}'`);
    }
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

  it("ships the polymorphic consultation-trigger hotfix with a rollback self-test", () => {
    const sql = readFileSync(
      resolve(
        process.cwd(),
        "supabase/migrations/20260823040000_google_ads_consultation_trigger_hotfix.sql",
      ),
      "utf8",
    );
    expect(sql).toContain("if tg_table_name = 'consultation_requests' then");
    expect(sql).toContain("if new.lead_id is not null then");
    expect(sql).not.toContain(
      "tg_table_name = 'consultation_requests' and new.lead_id is not null",
    );
    expect(sql).toContain("select public.upsert_consultation_lead(");
    expect(sql).toContain("p_utm_campaign => 'manual_test'");
    expect(sql).toContain("when sqlstate 'ZX001' then");
  });
});

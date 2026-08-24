import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const repositories = vi.hoisted(() => ({
  fetchGoogleAdsDashboard: vi.fn(),
  fetchGoogleAdsTestDashboard: vi.fn(),
  fetchConsultationManager: vi.fn(),
  fetchConsultationTestManager: vi.fn(),
  resolveCrmReportingRange: vi.fn(),
}));

vi.mock("@/lib/server/checkpointAdminAuth", () => ({
  requireCheckpointAdminApi: vi.fn(() => null),
  isCheckpointAdminMutationRequest: vi.fn(() => true),
}));

vi.mock("@/lib/server/googleAdsRepository", () => ({
  fetchGoogleAdsDashboard: repositories.fetchGoogleAdsDashboard,
  fetchGoogleAdsTestDashboard: repositories.fetchGoogleAdsTestDashboard,
}));

vi.mock("@/lib/server/growthRepository", () => ({
  fetchConsultationManager: repositories.fetchConsultationManager,
  fetchConsultationTestManager: repositories.fetchConsultationTestManager,
}));

vi.mock("@/lib/server/crmReportingRepository", () => ({
  resolveCrmReportingRange: repositories.resolveCrmReportingRange,
}));

import { GET as getGoogleAdsDashboard } from "@/app/api/admin/checkpoints/google-ads/dashboard/route";
import { POST as getConsultationManager } from "@/app/api/admin/checkpoints/consultations/route";

const ORIGIN = "https://valisenmentalhealth.com";
const FROM = "2026-08-17";
const TO = "2026-08-20";

const consultationData = {
  generatedAt: "2026-08-23T16:00:00.000Z",
  kpis: {},
  sources: [],
  leads: [],
  totalCount: 0,
  limit: 50,
  offset: 0,
  openCarryoverCount: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  repositories.fetchGoogleAdsDashboard.mockResolvedValue({});
  repositories.fetchGoogleAdsTestDashboard.mockResolvedValue({});
  repositories.fetchConsultationManager.mockResolvedValue(consultationData);
  repositories.fetchConsultationTestManager.mockResolvedValue(consultationData);
  repositories.resolveCrmReportingRange.mockImplementation(
    async (_section: string, range: { from: string; to: string }) => ({ range }),
  );
});

describe("CRM Test QA API scope", () => {
  it("reads Google Ads test data directly without applying the live reporting cutoff", async () => {
    const response = await getGoogleAdsDashboard(
      new NextRequest(
        `${ORIGIN}/api/admin/checkpoints/google-ads/dashboard?scope=test&range=custom&from=${FROM}&to=${TO}`,
      ),
    );

    expect(response.status).toBe(200);
    expect(repositories.fetchGoogleAdsTestDashboard).toHaveBeenCalledWith(
      "2026-08-17T04:00:00.000Z",
      "2026-08-21T04:00:00.000Z",
    );
    expect(repositories.fetchGoogleAdsDashboard).not.toHaveBeenCalled();
    expect(repositories.resolveCrmReportingRange).not.toHaveBeenCalled();
  });

  it("keeps Google Ads live data as the default scope", async () => {
    const response = await getGoogleAdsDashboard(
      new NextRequest(
        `${ORIGIN}/api/admin/checkpoints/google-ads/dashboard?range=custom&from=${FROM}&to=${TO}`,
      ),
    );

    expect(response.status).toBe(200);
    expect(repositories.resolveCrmReportingRange).toHaveBeenCalledWith(
      "google_ads",
      expect.any(Object),
    );
    expect(repositories.fetchGoogleAdsDashboard).toHaveBeenCalledOnce();
    expect(repositories.fetchGoogleAdsTestDashboard).not.toHaveBeenCalled();
  });

  it("reads consultation test records directly and carries the protected filters", async () => {
    const response = await getConsultationManager(
      new NextRequest(`${ORIGIN}/api/admin/checkpoints/consultations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: ORIGIN },
        body: JSON.stringify({
          scope: "test",
          range: "custom",
          from: FROM,
          to: TO,
          workflowStatus: "new",
          limit: "50",
          offset: "0",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(repositories.fetchConsultationTestManager).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "2026-08-17T04:00:00.000Z",
        to: "2026-08-21T04:00:00.000Z",
        workflowStatus: "new",
        limit: 50,
        offset: 0,
      }),
    );
    expect(repositories.fetchConsultationManager).not.toHaveBeenCalled();
    expect(repositories.resolveCrmReportingRange).not.toHaveBeenCalled();
  });

  it("rejects every scope except the exact live and test values", async () => {
    const googleResponse = await getGoogleAdsDashboard(
      new NextRequest(
        `${ORIGIN}/api/admin/checkpoints/google-ads/dashboard?scope=qa&range=30d`,
      ),
    );
    const consultationResponse = await getConsultationManager(
      new NextRequest(`${ORIGIN}/api/admin/checkpoints/consultations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: ORIGIN },
        body: JSON.stringify({ scope: "TEST", range: "30d" }),
      }),
    );

    expect(googleResponse.status).toBe(400);
    expect(consultationResponse.status).toBe(400);
    expect(repositories.fetchGoogleAdsDashboard).not.toHaveBeenCalled();
    expect(repositories.fetchGoogleAdsTestDashboard).not.toHaveBeenCalled();
    expect(repositories.fetchConsultationManager).not.toHaveBeenCalled();
    expect(repositories.fetchConsultationTestManager).not.toHaveBeenCalled();
  });
});

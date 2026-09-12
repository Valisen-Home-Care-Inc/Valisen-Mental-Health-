import GoogleAdsDashboardClient from "@/components/checkpoints/admin/GoogleAdsDashboardClient";
import { resolveCheckpointDateRange } from "@/lib/checkpoints/dashboardMetrics";
import { normalizeGoogleAdsDashboard } from "@/lib/googleAdsDashboard";
import { DEFAULT_GOOGLE_ADS_LANDING_PATH } from "@/lib/googleAdsLandingReport";
import { requireCheckpointAdminPage } from "@/lib/server/checkpointAdminAuth";
import { fetchGoogleAdsDashboard } from "@/lib/server/googleAdsRepository";
import { resolveCrmReportingRange } from "@/lib/server/crmReportingRepository";

export const dynamic = "force-dynamic";

export default async function GoogleAdsAnalyticsPage() {
  await requireCheckpointAdminPage("/admin/checkpoints/google-ads");
  const range = resolveCheckpointDateRange("30d");
  let data = null;
  let error: string | null = null;

  if (!range) {
    error = "The default analytics range could not be created.";
  } else {
    try {
      const reporting = await resolveCrmReportingRange("google_ads", range);
      const response = await fetchGoogleAdsDashboard(
        reporting.range.from,
        reporting.range.to,
        DEFAULT_GOOGLE_ADS_LANDING_PATH,
      );
      data = normalizeGoogleAdsDashboard(response, reporting.range);
    } catch (caught) {
      console.error(
        "google-ads-admin: initial dashboard query failed",
        caught instanceof Error ? caught.name : "unknown",
      );
      error = "Google Ads analytics are temporarily unavailable.";
    }
  }

  return <GoogleAdsDashboardClient initialData={data} initialError={error} />;
}

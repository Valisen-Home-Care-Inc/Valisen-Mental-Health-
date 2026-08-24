import DashboardClient from "@/components/checkpoints/admin/DashboardClient";
import { resolveCheckpointDateRange } from "@/lib/checkpoints/dashboardMetrics";
import { requireCheckpointAdminPage } from "@/lib/server/checkpointAdminAuth";
import { fetchCheckpointDashboard } from "@/lib/server/checkpointRepository";
import { resolveCrmReportingRange } from "@/lib/server/crmReportingRepository";

export const dynamic = "force-dynamic";

export default async function CheckpointDashboardPage() {
  await requireCheckpointAdminPage("/admin/checkpoints");
  const range = resolveCheckpointDateRange("30d");
  let data = null;
  let error: string | null = null;

  if (!range) {
    error = "The default analytics range could not be created.";
  } else {
    try {
      const reporting = await resolveCrmReportingRange("checkpoints", range);
      data = await fetchCheckpointDashboard(
        reporting.range.from,
        reporting.range.to,
      );
    } catch (caught) {
      error =
        caught instanceof Error
          ? caught.message
          : "Checkpoint analytics are temporarily unavailable.";
    }
  }

  return <DashboardClient initialData={data} initialError={error} />;
}

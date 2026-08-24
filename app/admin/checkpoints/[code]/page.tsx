import { notFound } from "next/navigation";
import DetailClient from "@/components/checkpoints/admin/DetailClient";
import { isCheckpointCode } from "@/lib/checkpoints/config";
import { resolveCheckpointDateRange } from "@/lib/checkpoints/dashboardMetrics";
import { requireCheckpointAdminPage } from "@/lib/server/checkpointAdminAuth";
import { fetchCheckpointDetail } from "@/lib/server/checkpointRepository";
import { resolveCrmReportingRange } from "@/lib/server/crmReportingRepository";

export const dynamic = "force-dynamic";

export default async function CheckpointDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!isCheckpointCode(code)) notFound();
  await requireCheckpointAdminPage(`/admin/checkpoints/${code}`);

  const range = resolveCheckpointDateRange("30d");
  let data = null;
  let error: string | null = null;
  if (range) {
    try {
      const reporting = await resolveCrmReportingRange("checkpoints", range);
      data = await fetchCheckpointDetail(
        code,
        reporting.range.from,
        reporting.range.to,
        reporting.state.activeSince,
      );
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "Checkpoint detail is unavailable.";
    }
  }
  return (
    <DetailClient
      checkpointCode={code}
      initialData={data}
      initialError={error}
    />
  );
}

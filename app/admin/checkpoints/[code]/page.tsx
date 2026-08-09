import { notFound } from "next/navigation";
import DetailClient from "@/components/checkpoints/admin/DetailClient";
import { isCheckpointCode } from "@/lib/checkpoints/config";
import { resolveCheckpointDateRange } from "@/lib/checkpoints/dashboardMetrics";
import { requireCheckpointAdminPage } from "@/lib/server/checkpointAdminAuth";
import { fetchCheckpointDetail } from "@/lib/server/checkpointRepository";

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
      data = await fetchCheckpointDetail(code, range.from, range.to);
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

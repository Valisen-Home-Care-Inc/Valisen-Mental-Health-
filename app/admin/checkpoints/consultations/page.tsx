import ConsultationManagerClient from "@/components/checkpoints/admin/ConsultationManagerClient";
import { resolveCheckpointDateRange } from "@/lib/checkpoints/dashboardMetrics";
import { requireCheckpointAdminPage } from "@/lib/server/checkpointAdminAuth";
import { fetchConsultationManager } from "@/lib/server/growthRepository";

export const dynamic = "force-dynamic";

export default async function ConsultationManagerPage() {
  await requireCheckpointAdminPage("/admin/checkpoints/consultations");
  const range = resolveCheckpointDateRange("30d");
  let data = null;
  let error: string | null = null;

  if (!range) {
    error = "The default consultation range could not be created.";
  } else {
    try {
      data = await fetchConsultationManager({
        from: range.from,
        to: range.to,
        limit: 50,
        offset: 0,
      });
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "Consultation records are unavailable.";
    }
  }

  return <ConsultationManagerClient initialData={data} initialError={error} />;
}

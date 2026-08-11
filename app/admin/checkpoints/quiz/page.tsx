import QuizDashboardClient from "@/components/checkpoints/admin/QuizDashboardClient";
import { resolveCheckpointDateRange } from "@/lib/checkpoints/dashboardMetrics";
import { requireCheckpointAdminPage } from "@/lib/server/checkpointAdminAuth";
import { fetchGrowthDashboard } from "@/lib/server/growthRepository";

export const dynamic = "force-dynamic";

export default async function QuizAnalyticsPage() {
  await requireCheckpointAdminPage("/admin/checkpoints/quiz");
  const range = resolveCheckpointDateRange("30d");
  let data = null;
  let error: string | null = null;

  if (!range) {
    error = "The default analytics range could not be created.";
  } else {
    try {
      data = await fetchGrowthDashboard(range.from, range.to);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "Quiz analytics are unavailable.";
    }
  }

  return <QuizDashboardClient initialData={data} initialError={error} />;
}

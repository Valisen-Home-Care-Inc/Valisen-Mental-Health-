import QuizDashboardClient from "@/components/checkpoints/admin/QuizDashboardClient";
import { resolveCheckpointDateRange } from "@/lib/checkpoints/dashboardMetrics";
import { requireCheckpointAdminPage } from "@/lib/server/checkpointAdminAuth";
import {
  fetchGrowthDashboard,
  fetchQuizSubmissionRecoveryQueue,
  fetchQuizTestCandidates,
} from "@/lib/server/growthRepository";

export const dynamic = "force-dynamic";

export default async function QuizAnalyticsPage() {
  await requireCheckpointAdminPage("/admin/checkpoints/quiz");
  const range = resolveCheckpointDateRange("30d");
  let data = null;
  let recovery = null;
  let testData = null;
  let error: string | null = null;

  if (!range) {
    error = "The default analytics range could not be created.";
  } else {
    try {
      [data, recovery, testData] = await Promise.all([
        fetchGrowthDashboard(range.from, range.to),
        fetchQuizSubmissionRecoveryQueue(),
        fetchQuizTestCandidates(),
      ]);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "Quiz analytics are unavailable.";
    }
  }

  return (
    <QuizDashboardClient
      initialData={data}
      initialRecovery={recovery}
      initialTestData={testData}
      initialError={error}
    />
  );
}

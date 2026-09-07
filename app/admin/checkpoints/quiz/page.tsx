import QuizDashboardClient from "@/components/checkpoints/admin/QuizDashboardClient";
import { resolveCheckpointDateRange } from "@/lib/checkpoints/dashboardMetrics";
import { requireCheckpointAdminPage } from "@/lib/server/checkpointAdminAuth";
import {
  fetchGrowthDashboard,
  fetchQuizSubmissionRecoveryQueue,
  fetchQuizTestCandidates,
} from "@/lib/server/growthRepository";
import { resolveCrmReportingRange } from "@/lib/server/crmReportingRepository";
import { callSupabaseRpc } from "@/lib/server/supabaseServer";
import type { ResultEngagementReport } from "@/lib/quizResultEngagement";

export const dynamic = "force-dynamic";

export default async function QuizAnalyticsPage() {
  await requireCheckpointAdminPage("/admin/checkpoints/quiz");
  const range = resolveCheckpointDateRange("30d");
  let data = null;
  let recovery = null;
  let testData = null;
  let resultEngagement: ResultEngagementReport | null = null;
  let error: string | null = null;

  if (!range) {
    error = "The default analytics range could not be created.";
  } else {
    try {
      const reporting = await resolveCrmReportingRange("quiz", range);
      [data, recovery, testData, resultEngagement] = await Promise.all([
        fetchGrowthDashboard(reporting.range.from, reporting.range.to),
        fetchQuizSubmissionRecoveryQueue(),
        fetchQuizTestCandidates(),
        callSupabaseRpc<ResultEngagementReport>("get_quiz_result_engagement", { p_from: reporting.range.from, p_to: reporting.range.to }).catch(() => null),
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
      initialResultEngagement={resultEngagement}
    />
  );
}

import type { JourneyReport } from "./contract";
import type { CheckpointQuestionStepMetric } from "@/lib/checkpoints/dashboardMetrics";

/** Supports the installed launch RPC as well as newer RPCs that return historical metrics directly. */
export function withLegacyJourneyMetrics(report: JourneyReport, allCompleted: number, allSteps: CheckpointQuestionStepMetric[]): JourneyReport {
  const legacyQuestionSteps = report.legacyQuestionSteps ?? allSteps.map(step => {
    // The original RPC infers question reach from the previous completed step.
    // Remove the V3 contribution using that same rule, not V3's explicit reach events.
    const newReached = step.stepNumber === 1 ? report.started : report.questions.find(q => q.stepNumber === step.stepNumber - 1)?.completed ?? 0;
    const newCompleted = report.questions.find(q => q.stepNumber === step.stepNumber)?.completed ?? 0;
    const reached = Math.max(0,step.reached-newReached), completed = Math.max(0,step.completed-newCompleted);
    const dropOffs = Math.max(0,reached-completed);
    return { stepNumber: step.stepNumber, reached, completed, dropOffs, completionRate: reached ? completed*100/reached : 0, dropOffRate: reached ? dropOffs*100/reached : 0 };
  });
  return { ...report, legacyCompleted: report.legacyCompleted ?? Math.max(0,allCompleted-report.completed), legacyQuestionSteps };
}

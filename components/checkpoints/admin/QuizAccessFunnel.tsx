import type { QuizFlowVersion } from "@/lib/growth/dashboard";
import { formatCount } from "@/components/checkpoints/admin/MetricVisuals";

export default function QuizAccessFunnel({ flow }: { flow: QuizFlowVersion }) {
  const access = flow.access;
  return <div className="mb-6 rounded-xl border border-[#dce8e1] bg-[#f8faf8] p-4" aria-label="Results access tracking">
    <h3 className="text-sm font-semibold text-[#31413e]">Results access: contact form to saved results</h3>
    <p className="mt-1 text-[11px] leading-5 text-[#667471]">Each milestone counts an attempt once, even after retries. Saved means a durable lead record exists. An exit without saving matures after 30 minutes or a browser exit. Submission and failure tracking starts with this update; earlier events cannot be reconstructed.</p>
    <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-5">
      {([
        ["Form viewed", access.viewed], ["Form started", access.started],
        ["Save attempted", access.submitAttempted], ["Details saved", access.saved],
        ["Results viewed", access.resultsViewed], ["Validation issues", access.validationFailed],
        ["Verification issues", access.verificationFailed], ["Save failures", access.submitFailed],
        ["Exited without saving", access.exitedWithoutSubmitting],
      ] as const).map(([label, count]) => <div key={label} className="rounded-lg bg-white p-3">
        <p className="text-[10px] text-[#667471]">{label}</p>
        <p className="mt-1 text-xl font-semibold tabular-nums text-[#31413e]">{formatCount(count)}</p>
      </div>)}
    </div>
  </div>;
}

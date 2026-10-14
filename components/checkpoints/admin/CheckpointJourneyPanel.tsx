"use client";
import { Download } from "lucide-react";
import type { JourneyReport } from "@/lib/checkpoints/journey/contract";
import type { CheckpointIntentMetric } from "@/lib/checkpoints/dashboardMetrics";
import { CheckpointSegmentation, QuestionStepVisual } from "./MetricVisuals";

export default function CheckpointJourneyPanel({ report, intents, range, code }: { report: JourneyReport; intents: CheckpointIntentMetric[]; range: { from: string; to: string }; code?: string }) {
  function exportReport() {
    const rows: Array<Array<string | number>> = [["Version","Checkpoint scope","From","To","Section","Metric","Count","Reached","Completed","Exits"]];
    const row = (section: string, metric: string, count: number, reached: number | "" = "", completed: number | "" = "", exits: number | "" = "") => rows.push([report.version,code || "All VMHs",range.from,range.to,section,metric,count,reached,completed,exits]);
    for (const key of ["sessions","started","completed","threeQuestionResults","fourQuestionResults"] as const) row("New quiz",key,report[key]);
    for (const [key,value] of Object.entries(report.actions)) row("Request progress",key,value);
    for (const q of report.questions) row("New questions",`Q${q.stepNumber}: ${q.label}`,q.completed,q.reached,q.completed,q.exits);
    row("Historical quiz","sessions",report.legacySessions); row("Historical quiz","completed",report.legacyCompleted);
    for (const q of report.legacyQuestionSteps) row("Historical questions",`Q${q.stepNumber}`,q.completed,q.reached,q.completed,q.dropOffs);
    for (const intent of intents) row("Historical intent",intent.intent,intent.count);
    const csv = rows.map(values => values.map(value => `"${String(value).replaceAll('"','""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF",csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");a.href=url;a.download=`checkpoint-journey-${code || "all"}-${range.from.slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);
  }
  const actions: Array<[string,number,string]> = [
    ["Free-call button",report.actions.cta,"Opened the contact form from an offer or mobile button"],
    ["Form opened",report.actions.formOpened,"Request panel shown; no contact details saved yet"],
    ["Name field reached",report.actions.nameReached,"Focused the name field; it may be focused automatically"],
    ["Phone field reached",report.actions.phoneReached,"Focused the required phone field"],
    ["Consent reached",report.actions.consentReached,"Focused the contact-permission checkbox"],
    ["Validation issue",report.actions.validationFailed,"A name, phone or consent check failed"],
    ["Submit attempted",report.actions.attempted,"A valid form was sent to the server"],
    ["Request error",report.actions.failed,"The request or notification returned an error; retry is available"],
    ["Requests saved",report.actions.saved,"Server-confirmed saved requests, including requests awaiting notification retry"],
    ["Consultations booked",report.actions.booked,"Scheduling confirmed or recorded by the clinic; separate from saved requests"],
    ["Paid therapy",report.actions.paid,"Clinic-recorded paid therapy"],
    ["Therapist options",report.actions.therapistOptions,"Opened the alternative-therapist panel"],
  ];
  return <section className="mt-5 rounded-[20px] border border-[#c9ddd5] bg-white p-5 shadow-sm sm:p-6" aria-labelledby="checkpoint-journey-title" data-checkpoint-journey-report>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-wider text-[#497a73]">Current Mental Battery quiz · V3</p><h2 id="checkpoint-journey-title" className="mt-1 text-[22px] font-semibold">From check-in to a free-call request</h2><p className="mt-2 max-w-[800px] text-[12px] leading-5 text-[#667471]">{report.sessions} new-quiz sessions · {report.started} started · {report.completed} completed. These counts are separate from the previous quiz. The overview above includes both versions.</p></div><button type="button" onClick={exportReport} className="flex min-h-10 items-center gap-2 rounded-lg bg-[#1e5f5a] px-4 text-[12px] font-semibold text-white"><Download size={15} />Export quiz report CSV</button></div>
    <h3 className="mt-6 text-[15px] font-semibold">Where people stopped answering</h3>
    <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{report.questions.map(q => <article key={q.stepNumber} className="rounded-xl border border-black/5 bg-[#f6f9f7] p-4"><p className="text-[10px] font-bold text-[#497a73]">QUESTION {q.stepNumber}</p><h4 className="mt-1 min-h-9 text-[12px] font-semibold">{q.label}</h4><p className="mt-2 text-[24px] font-semibold tabular-nums">{q.completed}<span className="ml-2 text-[11px] font-normal text-[#788480]">completed / {q.reached} reached</span></p><p className="mt-2 text-[11px] text-[#975b41]">{q.exits} left without answering this question</p></article>)}</div>
    <p className="mt-3 text-[11px] leading-5 text-[#788480]">{report.threeQuestionResults} three-question results · {report.fourQuestionResults} four-question results. The wellbeing path finishes after question 3. Question 4 is counted only when it was actually shown; skipping it is not a drop-off. Question 3 changes with the visitor’s topic. Answers and concern labels are not stored.</p>
    <h3 className="mt-6 text-[15px] font-semibold">What happened after the result</h3>
    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{actions.map(([label,count,note]) => <article key={label} className="rounded-xl bg-[#f6f9f7] p-4"><h4 className="text-[11px] font-semibold text-[#497a73]">{label}</h4><p className="mt-2 text-[24px] font-semibold tabular-nums">{count}</p><p className="mt-1 text-[10px] leading-4 text-[#788480]">{note}</p></article>)}</div>
    <p className="mt-3 text-[11px] text-[#788480]">Unique sessions per milestone. Focus is not a typed answer; a saved request is not a booked appointment. One session may fail, retry and then save successfully.</p>
    <details className="mt-5 rounded-xl border border-black/5 bg-[#fafbf9] p-4"><summary className="cursor-pointer text-[13px] font-semibold">Previous quiz: historical questions and intent ({report.legacySessions} sessions)</summary><p className="my-3 text-[11px] text-[#788480]">The old four-question flow and its “What feels most useful?” intent question remain here. They are excluded from the current quiz counts.</p><QuestionStepVisual steps={report.legacyQuestionSteps} completedCheckIns={report.legacyCompleted} /><div className="mt-4"><CheckpointSegmentation actions={[]} intents={intents} /></div></details>
  </section>;
}

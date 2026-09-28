"use client";

import { Download, LoaderCircle } from "lucide-react";
import { useState } from "react";
import type { CheckpointDatePreset } from "@/lib/checkpoints/dashboardMetrics";

export default function GoogleAdsFullExportButton({ range, scope, customFrom, customTo }: {
  range: CheckpointDatePreset; scope: "live" | "test"; customFrom: string; customTo: string;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function download() {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const params = new URLSearchParams({ range, scope });
      if (range === "custom") { params.set("from", customFrom); params.set("to", customTo); }
      const response = await fetch(`/api/admin/checkpoints/google-ads/export-all?${params}`, { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || "The export could not be created.");
      }
      const filename = /filename="([^"]+)"/.exec(response.headers.get("content-disposition") || "")?.[1] || "google-ads-all-data.zip";
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url; link.download = filename;
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Downloaded all landing pages for the selected date range and scope.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "The export could not be created."); }
    finally { setBusy(false); }
  }
  return <div className="mt-5 rounded-[16px] border border-[#b8d2cc] bg-[#edf5f1] p-4 sm:p-5">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div><p className="text-[13px] font-semibold text-[#284c43]">Everything for your Google Ads review</p>
        <p className="mt-1 max-w-[660px] text-[11px] leading-5 text-[#62766d]">All final URLs · Selected date range · {scope === "test" ? "Test QA" : "Live campaign"}. One ZIP with summaries, landing-page comparisons, sessions, full event timelines and a JSON report.</p></div>
      <button type="button" onClick={() => void download()} disabled={busy || (range === "custom" && (!customFrom || !customTo))}
        className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-[12px] bg-[#1e5f5a] px-5 py-3 text-[13px] font-semibold text-white shadow-sm transition hover:bg-[#174d48] disabled:opacity-60">
        {busy ? <LoaderCircle size={18} className="animate-spin" /> : <Download size={18} />}{busy ? "Preparing export…" : "Export all Google Ads data"}
      </button>
    </div>
    {message ? <p role="status" className="mt-3 text-[12px] leading-5 text-[#395e52]">{message}</p> : null}
  </div>;
}

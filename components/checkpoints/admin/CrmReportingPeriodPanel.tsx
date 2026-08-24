"use client";

import {
  Archive,
  ChevronDown,
  Download,
  RefreshCw,
  RotateCcw,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CRM_REPORTING_LABELS,
  type CrmReportingArchive,
  type CrmReportingArchiveDetail,
  type CrmReportingArchiveList,
  type CrmReportingSection,
} from "@/lib/crmReporting";

function formatDate(value: string, includeTime = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" as const } : {}),
    timeZone: "America/Toronto",
  }).format(date);
}
function summaryLabel(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function downloadJson(archive: CrmReportingArchiveDetail) {
  const blob = new Blob([JSON.stringify(archive, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${archive.section}-${archive.label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "archive"}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function CrmReportingPeriodPanel({
  section,
  onReset,
}: {
  section: CrmReportingSection;
  onReset: () => void | Promise<void>;
}) {
  const [data, setData] = useState<CrmReportingArchiveList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showArchives, setShowArchives] = useState(false);
  const [label, setLabel] = useState("");
  const [archiving, setArchiving] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const sectionLabel = CRM_REPORTING_LABELS[section];

  const suggestedLabel = useMemo(
    () => `${sectionLabel} · ${formatDate(new Date().toISOString())}`,
    [sectionLabel],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/admin/checkpoints/reporting-periods?section=${section}`,
        { credentials: "same-origin", cache: "no-store" },
      );
      const body = (await response.json().catch(() => null)) as
        | { data?: CrmReportingArchiveList; error?: string }
        | null;
      if (!response.ok || !body?.data) {
        throw new Error(body?.error || "Reporting periods are unavailable.");
      }
      setData(body.data);
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Reporting periods are unavailable.",
      );
    } finally {
      setLoading(false);
    }
  }, [section]);

  useEffect(() => {
    void load();
  }, [load]);

  async function archiveAndReset() {
    if (archiving) return;
    const cleanLabel = label.trim();
    if (!cleanLabel) return;
    setArchiving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/checkpoints/reporting-periods", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, label: cleanLabel }),
      });
      const body = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;
      if (!response.ok || !body?.ok) {
        throw new Error(body?.error || "The reporting period could not be archived.");
      }
      setShowDialog(false);
      setShowArchives(true);
      setLabel("");
      await load();
      await onReset();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The reporting period could not be archived.",
      );
    } finally {
      setArchiving(false);
    }
  }

  async function downloadArchive(archive: CrmReportingArchive) {
    setDownloadingId(archive.id);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/checkpoints/reporting-periods?section=${section}&id=${archive.id}`,
        { credentials: "same-origin", cache: "no-store" },
      );
      const body = (await response.json().catch(() => null)) as
        | { archive?: CrmReportingArchiveDetail; error?: string }
        | null;
      if (!response.ok || !body?.archive) {
        throw new Error(body?.error || "The archive could not be downloaded.");
      }
      downloadJson(body.archive);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The archive could not be downloaded.",
      );
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <section className="mt-5 overflow-hidden rounded-[18px] border border-[#b9d2cb] bg-[#f8fbf9] shadow-[0_6px_24px_rgba(25,47,43,0.04)]" aria-labelledby={`${section}-reporting-period-title`}>
      <div className="flex flex-col justify-between gap-4 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] bg-[#e3f0eb] text-[#286f68]">
            <Archive size={17} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[9.5px] font-bold uppercase tracking-[1px] text-[#64827d]">Reporting period</p>
            <h2 id={`${section}-reporting-period-title`} className="mt-0.5 text-[14px] font-semibold text-[#263734]">
              {data ? `Current data starts ${formatDate(data.activeSince, true)}` : "Current reporting window"}
            </h2>
            <p className="mt-1 max-w-[800px] text-[10.5px] leading-4 text-[#74817e]">
              Archive the current metrics before a new campaign or reporting cycle. Source records stay intact.
              {section === "consultations" ? " Unresolved follow-ups remain visible as carryover." : ""}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowArchives((current) => !current)}
            disabled={loading || !data}
            className="inline-flex min-h-10 items-center gap-2 rounded-[10px] border border-black/10 bg-white px-3 text-[11px] font-semibold text-[#5d6b68] shadow-sm disabled:opacity-50"
          >
            {loading ? <RefreshCw size={13} className="animate-spin" aria-hidden="true" /> : <ChevronDown size={13} className={showArchives ? "rotate-180" : ""} aria-hidden="true" />}
            Archives {data ? `(${data.archives.length})` : ""}
          </button>
          <button
            type="button"
            onClick={() => {
              setLabel(suggestedLabel);
              setShowDialog(true);
            }}
            disabled={loading || !data}
            className="inline-flex min-h-10 items-center gap-2 rounded-[10px] bg-[#1e5f5a] px-3.5 text-[11px] font-semibold text-white shadow-sm disabled:opacity-50"
          >
            <RotateCcw size={13} aria-hidden="true" />
            Archive &amp; start fresh
          </button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="border-t border-[#e6cdbf] bg-[#fff8f3] px-5 py-3 text-[10.5px] text-[#8d5139]">{error}</p>
      ) : null}

      {showArchives && data ? (
        <div className="border-t border-black/[0.06] bg-white">
          {data.archives.length ? (
            <div className="divide-y divide-black/[0.055]">
              {data.archives.map((archive) => (
                <article key={archive.id} className="flex flex-col justify-between gap-3 px-5 py-4 lg:flex-row lg:items-center">
                  <div>
                    <p className="text-[12px] font-semibold text-[#32423f]">{archive.label}</p>
                    <p className="mt-1 text-[10px] text-[#82908c]">{formatDate(archive.periodStartedAt)} – {formatDate(archive.periodEndedAt)} · archived {formatDate(archive.createdAt, true)}</p>
                    <dl className="mt-2 flex flex-wrap gap-1.5">
                      {Object.entries(archive.summary).map(([key, value]) => (
                        <div key={key} className="rounded-full bg-[#eef3f0] px-2.5 py-1 text-[9.5px] text-[#5d706b]">
                          <dt className="inline font-medium">{summaryLabel(key)} </dt>
                          <dd className="inline font-bold tabular-nums text-[#315f59]">{Number(value).toLocaleString("en-CA")}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                  <button
                    type="button"
                    onClick={() => void downloadArchive(archive)}
                    disabled={downloadingId === archive.id}
                    className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-[9px] border border-black/10 bg-white px-3 text-[10.5px] font-semibold text-[#356b64] shadow-sm disabled:opacity-50"
                  >
                    {downloadingId === archive.id ? <RefreshCw size={13} className="animate-spin" aria-hidden="true" /> : <Download size={13} aria-hidden="true" />}
                    Download snapshot
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <p className="px-5 py-5 text-[11px] text-[#7b8884]">No archived reporting periods yet.</p>
          )}
        </div>
      ) : null}

      {showDialog ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#102b29]/45 p-4 backdrop-blur-[2px]" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !archiving) setShowDialog(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby={`${section}-archive-dialog-title`} className="w-full max-w-[520px] rounded-[20px] bg-white p-6 shadow-[0_24px_80px_rgba(12,35,32,.25)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[9.5px] font-bold uppercase tracking-[1px] text-[#64827d]">Safe reset</p>
                <h2 id={`${section}-archive-dialog-title`} className="mt-1 text-[22px] font-semibold tracking-[-0.5px] text-[#20312e]">Archive this period and start fresh?</h2>
              </div>
              <button type="button" onClick={() => setShowDialog(false)} disabled={archiving} className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] border border-black/10 text-[#66736f]" aria-label="Close"><X size={15} aria-hidden="true" /></button>
            </div>
            <p className="mt-4 text-[12px] leading-5 text-[#64736f]">The live {sectionLabel} metrics will restart from zero. The old snapshot will remain downloadable, and no raw records will be deleted.</p>
            <label className="mt-5 block text-[11px] font-semibold text-[#53625f]">Archive name<input value={label} onChange={(event) => setLabel(event.target.value)} maxLength={100} className="mt-1.5 min-h-11 w-full rounded-[11px] border border-black/10 bg-[#fafbf9] px-3 text-[12px] outline-none focus:border-[#4e8c83]" /></label>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setShowDialog(false)} disabled={archiving} className="min-h-11 rounded-[11px] border border-black/10 bg-white px-4 text-[12px] font-semibold text-[#65726f]">Cancel</button>
              <button type="button" onClick={() => void archiveAndReset()} disabled={archiving || !label.trim()} className="inline-flex min-h-11 items-center gap-2 rounded-[11px] bg-[#1d625c] px-4 text-[12px] font-semibold text-white disabled:opacity-50">{archiving ? <RefreshCw size={14} className="animate-spin" aria-hidden="true" /> : <Archive size={14} aria-hidden="true" />}{archiving ? "Archiving…" : "Archive metrics & reset"}</button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

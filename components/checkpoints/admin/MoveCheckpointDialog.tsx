"use client";

import { ArrowRight, CalendarClock, MapPin, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  formatTorontoDateTimeInput,
  parseTorontoDateTimeInput,
} from "@/lib/checkpoints/torontoDateTime";

type MoveTarget = {
  code: string;
  currentPartner: string;
  currentLocation: string;
};

function placementDateLimits(now = new Date()): { min: string; max: string } {
  return {
    min: formatTorontoDateTimeInput(new Date(now.getTime() - 5 * 60_000)),
    max: formatTorontoDateTimeInput(new Date(now.getTime() + 366 * 24 * 60 * 60_000)),
  };
}

export default function MoveCheckpointDialog({
  target,
  onClose,
  onMoved,
}: {
  target: MoveTarget | null;
  onClose: () => void;
  onMoved: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const [partnerName, setPartnerName] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationNotes, setLocationNotes] = useState("");
  const [effectiveAt, setEffectiveAt] = useState(formatTorontoDateTimeInput);
  const [dateLimits, setDateLimits] = useState(placementDateLimits);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    setPartnerName("");
    setLocationName("");
    setLocationNotes("");
    setEffectiveAt(formatTorontoDateTimeInput());
    setDateLimits(placementDateLimits());
    setError(null);
    window.setTimeout(() => firstFieldRef.current?.focus(), 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), textarea:not([disabled])",
        ),
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, target]);

  if (!target) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const effectiveAtUtc = parseTorontoDateTimeInput(effectiveAt);
    if (!effectiveAtUtc) {
      setError("Choose a valid Toronto date and time.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/checkpoints/${target?.code}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partnerName,
          locationName,
          locationNotes: locationNotes || undefined,
          effectiveAt: effectiveAtUtc,
        }),
      });
      const body = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;
      if (!response.ok || !body?.ok) {
        throw new Error(body?.error || "The checkpoint could not be moved.");
      }
      onMoved();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "The checkpoint could not be moved.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#102523]/55 p-4 backdrop-blur-sm" role="presentation">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-checkpoint-title"
        className="my-auto w-full max-w-[560px] overflow-hidden rounded-[22px] border border-white/30 bg-[#fbfcfa] shadow-[0_30px_100px_rgba(8,26,24,0.35)]"
      >
        <div className="border-b border-black/[0.07] px-6 py-5 sm:px-7">
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-[#377a72]">Placement management</p>
              <h2 id="move-checkpoint-title" className="mt-1.5 text-[24px] font-semibold tracking-[-0.7px] text-[#1d2b29]">
                Move {target.code}
              </h2>
              <p className="mt-1 text-[12px] text-[#74807d]">
                Currently {target.currentPartner} · {target.currentLocation}
              </p>
            </div>
            <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[#687471] transition hover:bg-black/5" aria-label="Close move checkpoint dialog">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-5 px-6 py-6 sm:px-7">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-[12px] font-semibold text-[#35423f]">
              Partner / business
              <input ref={firstFieldRef} required maxLength={120} value={partnerName} onChange={(event) => setPartnerName(event.target.value)} placeholder="Coffee Shop A" className="form-input mt-2 bg-white" />
            </label>
            <label className="block text-[12px] font-semibold text-[#35423f]">
              Location name
              <input required maxLength={160} value={locationName} onChange={(event) => setLocationName(event.target.value)} placeholder="Centretown · Front counter" className="form-input mt-2 bg-white" />
            </label>
          </div>
          <label className="block text-[12px] font-semibold text-[#35423f]">
            Optional placement notes
            <textarea maxLength={500} rows={3} value={locationNotes} onChange={(event) => setLocationNotes(event.target.value)} placeholder="Table position, display setup, or installation note" className="form-input mt-2 resize-none bg-white" />
          </label>
          <label className="block text-[12px] font-semibold text-[#35423f]">
            Effective date and time (Toronto)
            <span className="relative mt-2 block">
              <CalendarClock size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6e7b78]" aria-hidden="true" />
              <input type="datetime-local" required value={effectiveAt} min={dateLimits.min} max={dateLimits.max} onChange={(event) => setEffectiveAt(event.target.value)} className="form-input bg-white pl-10" />
            </span>
          </label>

          <div className="rounded-[14px] border border-[#cfe1dc] bg-[#edf6f2] p-4">
            <div className="flex gap-3">
              <MapPin size={17} className="mt-0.5 shrink-0 text-[#2b7169]" aria-hidden="true" />
              <p className="text-[11.5px] leading-5 text-[#48625d]">
                The current placement closes at this time and its analytics stay intact. New sessions automatically use the new placement. The NFC tag and QR code do not change.
              </p>
            </div>
          </div>

          {error ? <p role="alert" className="rounded-[12px] bg-[#fbeae5] px-4 py-3 text-[12px] font-medium text-[#94442e]">{error}</p> : null}

          <div className="flex flex-col-reverse gap-2.5 pt-1 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={submitting} className="min-h-11 rounded-[11px] border border-black/10 bg-white px-5 text-[13px] font-semibold text-[#52605d] hover:bg-black/[0.02] disabled:opacity-60">Cancel</button>
            <button type="submit" disabled={submitting} className="inline-flex min-h-11 items-center justify-center rounded-[11px] bg-[#1c5e59] px-5 text-[13px] font-semibold text-white shadow-[0_8px_22px_rgba(28,94,89,0.22)] transition hover:bg-[#174e4a] disabled:cursor-wait disabled:opacity-65">
              {submitting ? "Saving placement…" : "Confirm move"}
              {!submitting ? <ArrowRight size={15} className="ml-2" aria-hidden="true" /> : null}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

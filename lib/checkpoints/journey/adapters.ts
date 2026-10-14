"use client";
import { createCryptographicUuid, getCheckpointSessionStorage, getOrCreateCheckpointSession, setCheckpointPlacement, type CheckpointSessionContext } from "@/lib/checkpoints/session";
import { isCheckpointCode } from "@/lib/checkpoints/config";
import { isUuid } from "@/lib/checkpoints/eventContract";
import { CHECKPOINT_JOURNEY_VERSION, type JourneyEventName, type JourneyEventDetails } from "./contract";
import type { callRequestPayload } from "./conversionModel";

export function createJourneyAdapters(code: string) {
  let context: CheckpointSessionContext | undefined;
  const sent = new Set<string>();
  const pending = new Map<string, Promise<void>>();
  let accepted: { referenceId: string } | undefined;
  let submissionId: string | undefined;
  let submission: Promise<{ referenceId: string }> | undefined;
  let startedAt: number | undefined;
  function session() {
    if (context) return context;
    if (!isCheckpointCode(code)) throw new Error("Unknown checkpoint.");
    const storage = getCheckpointSessionStorage();
    // A version upgrade begins a fresh anonymous cohort; it never relabels old sessions.
    const existing = getOrCreateCheckpointSession(code, storage, window.crypto);
    let marker: string | null = null;
    try { marker = storage?.getItem(`valisen.checkpoint.v3-session:${code}`) ?? null; } catch { /* storage optional */ }
    context = marker === existing.sessionId ? existing : { checkpointCode: code, sessionId: createCryptographicUuid(window.crypto) };
    try {
      storage?.setItem(`valisen.checkpoint.v3-session:${code}`, context.sessionId);
      storage?.setItem("valisen.mental-battery.session.v1", JSON.stringify({ version: 1, ...context }));
    } catch { /* An in-memory session still works in restricted browsers. */ }
    return context;
  }
  function track(event: JourneyEventName, details: JourneyEventDetails = {}) {
    const current = session();
    const key = `${event}:${details.stepNumber ?? ""}:${details.field ?? ""}:${details.placement ?? ""}`;
    const ledgerKey = `valisen.checkpoint.v3-event:${current.sessionId}:${key}`;
    const storage = getCheckpointSessionStorage();
    let eventId = createCryptographicUuid(window.crypto);
    try { const old = storage?.getItem(ledgerKey); if (old === "sent") return Promise.resolve(); if (old) eventId = old; storage?.setItem(ledgerKey, eventId); } catch { /* best effort */ }
    if (sent.has(key)) return Promise.resolve();
    if (pending.has(key)) return pending.get(key)!;
    const work = (async () => {
      try {
        const response = await fetch("/api/checkpoint-journey/events", { method: "POST", credentials: "same-origin", referrerPolicy: "no-referrer", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId, sessionId: current.sessionId, checkpointCode: code, version: CHECKPOINT_JOURNEY_VERSION, event, ...details }) });
        if (!response.ok) return;
        const body = await response.json();
        if (typeof body.placementId === "string") context = setCheckpointPlacement(current, body.placementId, storage);
        sent.add(key); try { storage?.setItem(ledgerKey, "sent"); } catch { /* best effort */ }
      } catch { /* Analytics never prevent reflection or contact. */ }
      finally { pending.delete(key); }
    })();
    pending.set(key, work); return work;
  }
  return {
    track,
    startForm() { startedAt ??= Date.now(); },
    submit(payload: ReturnType<typeof callRequestPayload>, token: string) {
      if (accepted) return Promise.resolve(accepted);
      if (submission) return submission;
      const current = session();
      if (!submissionId) {
        const storage = getCheckpointSessionStorage(), key = `valisen.checkpoint.v3-request:${current.sessionId}`;
        let previous: string | null = null;
        try { previous = storage?.getItem(key) ?? null; } catch { /* storage optional */ }
        submissionId = isUuid(previous) ? previous : createCryptographicUuid(window.crypto);
        // Only the random request ID survives reloads, never contact details or answers.
        try { storage?.setItem(key,submissionId); } catch { /* in-memory retry remains available */ }
      }
      submission = (async () => {
        const response = await fetch("/api/checkpoint-journey/request", { method: "POST", credentials: "same-origin", referrerPolicy: "no-referrer", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, clientSubmissionId: submissionId, sessionId: current.sessionId, formStartedAt: startedAt ?? Date.now(), turnstileToken: token }) });
        const body = await response.json().catch(() => null);
        if (!response.ok || !body?.ok || !body?.referenceId) throw new Error(body?.error || "We couldn’t finish this request. Your details are still here. Please try again.");
        accepted = { referenceId: body.referenceId }; return accepted;
      })().finally(() => { submission = undefined; });
      return submission;
    },
  };
}

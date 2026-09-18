"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/** One live inventory endpoint for all page pools; fail closed on lookup errors. */
export function useConsultationAvailability(conceptSlug?: string, refreshKey = 0, preview = false, therapistSlug?: string) {
  const [booked, setBooked] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<"checking" | "ready" | "unavailable">("checking");
  const key = `${conceptSlug || ""}:${therapistSlug || ""}`;
  const [loadedKey, setLoadedKey] = useState("");
  const sequence = useRef(0);
  const invalidate = useCallback(() => { sequence.current++; }, []);
  const refresh = useCallback(async () => {
    const current = ++sequence.current;
    if (preview) { setBooked(new Set()); setLoadedKey(key); setStatus("ready"); return; }
    try {
      const query = new URLSearchParams();
      if (conceptSlug) query.set("concept", conceptSlug);
      if (therapistSlug) query.set("therapist", therapistSlug);
      const response = await fetch(`/api/consultation-slots${query.size ? `?${query}` : ""}`, { cache: "no-store", credentials: "same-origin", signal: AbortSignal.timeout(10_000) });
      const body = await response.json();
      if ((therapistSlug && body.calendarVersion !== "therapist-capacity-v2") || !response.ok || !Array.isArray(body.booked) || body.booked.some((key: unknown) => typeof key !== "string")) throw new Error("unavailable");
      if (sequence.current !== current) return;
      setBooked(new Set(body.booked)); setLoadedKey(key); setStatus("ready");
    } catch { if (sequence.current === current) { setLoadedKey(key); setStatus("unavailable"); } }
  }, [conceptSlug, therapistSlug, preview, key]);
  useEffect(() => {
    setStatus("checking"); void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    const changed = () => void refresh();
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", changed);
    window.addEventListener("valisen:consultation-booked", changed);
    document.addEventListener("visibilitychange", visible);
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("valisen-consultations") : null;
    if (channel) channel.onmessage = changed;
    return () => { invalidate(); clearInterval(timer); window.removeEventListener("focus", changed); window.removeEventListener("valisen:consultation-booked", changed); document.removeEventListener("visibilitychange", visible); channel?.close(); };
  }, [refresh, refreshKey, invalidate]);
  return { booked: loadedKey === key ? booked : new Set<string>(), status: loadedKey === key ? status : "checking" as const, refresh };
}
export function announceConsultationBooked() {
  window.dispatchEvent(new Event("valisen:consultation-booked"));
  if (typeof BroadcastChannel !== "undefined") { const channel = new BroadcastChannel("valisen-consultations"); channel.postMessage("refresh"); channel.close(); }
}

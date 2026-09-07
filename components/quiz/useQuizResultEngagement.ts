"use client";
import { useCallback, useEffect, useRef, type RefObject } from "react";
import { RESULT_SECTIONS, type ResultAction, type ResultSection, type ResultEngagementSnapshot } from "@/lib/quizResultEngagement";

/** First-party summaries only: never send DOM text, answers, chosen times or contact details. */
export function useQuizResultEngagement(root: RefObject<HTMLDivElement>, submissionToken: string) {
  const record = useRef<(action: ResultAction) => void>(() => {});
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    let started = performance.now();
    let ticked = started;
    let lastActivity = started;
    let activeMs = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const snapshot: ResultEngagementSnapshot = { viewId: crypto.randomUUID(), sequence: 0, elapsedSeconds: 0, activeSeconds: 0, scrollDepth: 0, sections: [], actions: {} };
    const measure = () => {
      const now = performance.now();
      if (document.visibilityState === "visible" && ticked < lastActivity + 60000) activeMs += Math.max(0, Math.min(now, lastActivity + 60000) - ticked);
      ticked = now;
      snapshot.elapsedSeconds = Math.min(86400, Math.floor((now - started) / 1000));
      snapshot.activeSeconds = Math.min(snapshot.elapsedSeconds, Math.floor(activeMs / 1000));
      const bounds = element.getBoundingClientRect();
      if (document.visibilityState === "visible" && bounds.top < innerHeight && bounds.bottom > 0) snapshot.scrollDepth = Math.max(snapshot.scrollDepth, Math.min(100, Math.max(0, Math.round((innerHeight - bounds.top) / Math.max(1, bounds.height) * 100))));
    };
    const flush = () => {
      measure();
      snapshot.sequence += 1;
      void fetch("/api/quiz-lead/result-engagement", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ submissionToken, snapshot }), keepalive: true }).catch(() => {});
    };
    const activity = () => { measure(); lastActivity = performance.now(); };
    const schedule = () => { if (!retryTimer) retryTimer = setTimeout(() => { retryTimer = undefined; flush(); }, 1500); };
    record.current = (action) => { activity(); snapshot.actions[action] = Math.min(10000, (snapshot.actions[action] || 0) + 1); schedule(); };
    const observer = new IntersectionObserver((entries) => {
      if (document.visibilityState !== "visible") return;
      for (const entry of entries) if (entry.isIntersecting) {
        const section = (entry.target as HTMLElement).dataset.resultSection as ResultSection;
        if (!RESULT_SECTIONS.includes(section)) continue;
        if (!snapshot.sections.includes(section)) snapshot.sections.push(section);
        snapshot.lastSection = section;
      }
    }, { threshold: 0.15 });
    element.querySelectorAll("[data-result-section]").forEach((section) => observer.observe(section));
    // visibilitychange fires after the state changes; account for the final visible interval first.
    let wasVisible = document.visibilityState === "visible";
    const visibility = () => {
      const now = performance.now();
      if (wasVisible) activeMs += Math.max(0, Math.min(now, lastActivity + 60000) - ticked);
      ticked = now;
      wasVisible = document.visibilityState === "visible";
      if (wasVisible) lastActivity = now;
      flush();
    };
    const interval = setInterval(() => { if (document.visibilityState === "visible") flush(); }, 30000);
    const initial = setTimeout(flush, 1000);
    window.addEventListener("scroll", activity, { passive: true });
    element.addEventListener("pointerdown", activity, { passive: true });
    element.addEventListener("keydown", activity);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", flush);
    return () => {
      clearTimeout(initial); clearTimeout(retryTimer); clearInterval(interval); observer.disconnect();
      window.removeEventListener("scroll", activity); element.removeEventListener("pointerdown", activity); element.removeEventListener("keydown", activity);
      document.removeEventListener("visibilitychange", visibility); window.removeEventListener("pagehide", flush);
      // Avoid counting React development effect probes as actual views.
      if (performance.now() - started > 500) flush();
      record.current = () => {}; started = performance.now();
    };
  }, [root, submissionToken]);
  return useCallback((action: ResultAction) => record.current(action), []);
}

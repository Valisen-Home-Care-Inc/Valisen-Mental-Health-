export const RESULT_SECTIONS = ["summary", "therapists", "booking", "details", "download"] as const;
export const RESULT_ACTIONS = ["date_selected", "time_selected", "consent_changed", "booking_clicked", "booking_failed", "booking_completed", "details_opened", "profile_clicked", "pdf_clicked", "restart_clicked"] as const;
export type ResultAction = typeof RESULT_ACTIONS[number];
export type ResultSection = typeof RESULT_SECTIONS[number];
export type ResultEngagementSnapshot = {
  viewId: string; sequence: number; elapsedSeconds: number; activeSeconds: number;
  scrollDepth: number; sections: ResultSection[]; lastSection?: ResultSection;
  actions: Partial<Record<ResultAction, number>>;
};
export type ResultEngagementReport = {
  views: number; visitors: number; averageActiveSeconds: number; averageScrollDepth: number;
  records: Array<{ referenceId: string; views: number; activeSeconds: number; elapsedSeconds: number; scrollDepth: number; sections: ResultSection[]; lastSection?: ResultSection; actions: Partial<Record<ResultAction, number>>; lastSeenAt: string }>;
};

export function parseResultEngagement(value: unknown): ResultEngagementSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const keys = ["viewId", "sequence", "elapsedSeconds", "activeSeconds", "scrollDepth", "sections", "lastSection", "actions"];
  if (Object.keys(v).some((key) => !keys.includes(key)) || typeof v.viewId !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v.viewId)) return null;
  const integer = (n: unknown, max: number) => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= max;
  if (!integer(v.sequence, 10000) || !integer(v.elapsedSeconds, 86400) || !integer(v.activeSeconds, 86400) || Number(v.activeSeconds) > Number(v.elapsedSeconds) || !integer(v.scrollDepth, 100)) return null;
  if (!Array.isArray(v.sections) || v.sections.length > RESULT_SECTIONS.length || !v.sections.every((section) => RESULT_SECTIONS.includes(section))) return null;
  if (v.lastSection !== undefined && (!RESULT_SECTIONS.includes(v.lastSection as ResultSection) || !v.sections.includes(v.lastSection))) return null;
  if (!v.actions || typeof v.actions !== "object" || Array.isArray(v.actions) || Object.entries(v.actions).some(([key, count]) => !RESULT_ACTIONS.includes(key as ResultAction) || !integer(count, 10000))) return null;
  return { viewId: v.viewId, sequence: Number(v.sequence), elapsedSeconds: Number(v.elapsedSeconds), activeSeconds: Number(v.activeSeconds), scrollDepth: Number(v.scrollDepth), sections: Array.from(new Set(v.sections)) as ResultSection[], ...(v.lastSection ? { lastSection: v.lastSection as ResultSection } : {}), actions: v.actions as ResultEngagementSnapshot["actions"] };
}

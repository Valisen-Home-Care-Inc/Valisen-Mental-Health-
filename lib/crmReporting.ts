import type { CheckpointDateRange } from "@/lib/checkpoints/dashboardMetrics";

export const CRM_REPORTING_SECTIONS = [
  "google_ads",
  "quiz",
  "checkpoints",
  "consultations",
] as const;

export type CrmReportingSection = (typeof CRM_REPORTING_SECTIONS)[number];

export const CRM_REPORTING_DEFAULT_ACTIVE_SINCE =
  "2020-01-01T00:00:00.000Z";

export const CRM_REPORTING_LABELS: Record<CrmReportingSection, string> = {
  google_ads: "Google Ads",
  quiz: "Quiz analytics",
  checkpoints: "Checkpoints",
  consultations: "Consultations",
};

export type CrmReportingState = {
  section: CrmReportingSection;
  activeSince: string;
  updatedAt: string;
};

export type CrmReportingArchiveSummary = Record<string, number>;

export type CrmReportingArchive = {
  id: string;
  section?: CrmReportingSection;
  label: string;
  periodStartedAt: string;
  periodEndedAt: string;
  summary: CrmReportingArchiveSummary;
  createdAt: string;
};

export type CrmReportingArchiveDetail = CrmReportingArchive & {
  section: CrmReportingSection;
  snapshot: Record<string, unknown>;
  /** Frozen values captured at reset time, retained for audit comparison. */
  summaryAtArchive?: CrmReportingArchiveSummary;
  snapshotAtArchive?: Record<string, unknown>;
  /** The time delayed booking/paid stages were last reconciled for download. */
  reconciledAt?: string;
};

export type CrmReportingArchiveList = CrmReportingState & {
  archives: CrmReportingArchive[];
};

export function isCrmReportingSection(
  value: unknown,
): value is CrmReportingSection {
  return (
    typeof value === "string" &&
    (CRM_REPORTING_SECTIONS as readonly string[]).includes(value)
  );
}

export function clampCrmReportingRange(
  range: CheckpointDateRange,
  activeSince: string,
): CheckpointDateRange {
  const requestedFrom = new Date(range.from).getTime();
  const requestedTo = new Date(range.to).getTime();
  const cutoff = new Date(activeSince).getTime();
  if (
    !Number.isFinite(requestedFrom) ||
    !Number.isFinite(requestedTo) ||
    !Number.isFinite(cutoff) ||
    requestedFrom >= requestedTo
  ) {
    return range;
  }

  const clampedFrom = Math.max(requestedFrom, Math.min(cutoff, requestedTo - 1));
  return {
    ...range,
    from: new Date(clampedFrom).toISOString(),
  };
}

export function sanitizeCrmArchiveLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const label = value.trim();
  if (
    !label ||
    label.length > 100 ||
    /[\u0000-\u001F\u007F]/.test(label)
  ) {
    return null;
  }
  return label;
}

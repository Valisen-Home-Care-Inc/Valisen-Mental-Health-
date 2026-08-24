import {
  CRM_REPORTING_DEFAULT_ACTIVE_SINCE,
  clampCrmReportingRange,
  type CrmReportingArchive,
  type CrmReportingArchiveDetail,
  type CrmReportingArchiveList,
  type CrmReportingArchiveSummary,
  type CrmReportingSection,
  type CrmReportingState,
} from "@/lib/crmReporting";
import type { CheckpointDateRange } from "@/lib/checkpoints/dashboardMetrics";
import {
  callSupabaseRpc,
  SupabaseServerError,
} from "@/lib/server/supabaseServer";

export async function fetchCrmReportingState(
  section: CrmReportingSection,
): Promise<CrmReportingState> {
  return callSupabaseRpc("get_crm_reporting_state", {
    p_section: section,
  });
}

export async function fetchCrmReportingStateOrDefault(
  section: CrmReportingSection,
): Promise<CrmReportingState> {
  try {
    return await fetchCrmReportingState(section);
  } catch (error) {
    if (!(error instanceof SupabaseServerError) || error.upstreamStatus !== 404) {
      throw error;
    }
    console.warn(
      `crm-reporting: migration missing; using legacy cutoff for ${section}`,
    );
    return {
      section,
      activeSince: CRM_REPORTING_DEFAULT_ACTIVE_SINCE,
      updatedAt: CRM_REPORTING_DEFAULT_ACTIVE_SINCE,
    };
  }
}

export async function resolveCrmReportingRange(
  section: CrmReportingSection,
  range: CheckpointDateRange,
): Promise<{ range: CheckpointDateRange; state: CrmReportingState }> {
  const state = await fetchCrmReportingStateOrDefault(section);
  return {
    range: clampCrmReportingRange(range, state.activeSince),
    state,
  };
}

export async function fetchCrmReportingArchives(
  section: CrmReportingSection,
): Promise<CrmReportingArchiveList> {
  return callSupabaseRpc("list_crm_reporting_archives", {
    p_section: section,
  });
}

export async function fetchCrmReportingArchive(
  section: CrmReportingSection,
  archiveId: string,
): Promise<CrmReportingArchiveDetail | null> {
  return callSupabaseRpc("get_crm_reporting_archive", {
    p_section: section,
    p_archive_id: archiveId,
  });
}

export async function archiveCrmReportingPeriod(input: {
  section: CrmReportingSection;
  label: string;
  expectedStartedAt: string;
  periodEndedAt: string;
  summary: CrmReportingArchiveSummary;
  snapshot: Record<string, unknown>;
}): Promise<CrmReportingArchive & { activeSince: string }> {
  return callSupabaseRpc(
    "archive_crm_reporting_period",
    {
      p_section: input.section,
      p_label: input.label,
      p_expected_started_at: input.expectedStartedAt,
      p_period_ended_at: input.periodEndedAt,
      p_summary: input.summary,
      p_snapshot: input.snapshot,
    },
    20_000,
  );
}

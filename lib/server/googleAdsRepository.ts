import type { CampaignAttribution } from "@/lib/campaignAttribution";
import type { GoogleAdsValueTrackAttribution } from "@/lib/googleAdsEntry";
import type { GoogleAdsEventRecord } from "@/lib/server/googleAdsEventContract";
import {
  callSupabaseRpc,
  SupabaseServerError,
} from "@/lib/server/supabaseServer";

export type GoogleAdsIngestResult = {
  accepted: boolean;
  acceptedEvents: number;
};

export async function persistGoogleAdsEventBatch(input: {
  sessionId: string;
  sessionStartedAt: string;
  landingPath: string;
  events: GoogleAdsEventRecord[];
}): Promise<GoogleAdsIngestResult> {
  const result = await callSupabaseRpc<GoogleAdsIngestResult>("ingest_google_ads_events", {
    p_session_key: input.sessionId,
    p_session_started_at: input.sessionStartedAt,
    p_landing_path: input.landingPath,
    p_events: input.events,
  });
  await maybePruneGoogleAdsAnalytics();
  return result;
}

export type GoogleAdsSessionSeed = {
  sessionId: string;
  startedAt: string;
  landingPath: string;
  attribution: CampaignAttribution;
  googleClickIdPresent: boolean;
  valueTrack?: GoogleAdsValueTrackAttribution;
};

export type GoogleAdsSessionSeedResult = {
  accepted: boolean;
  /** True when this call created the row (false when it already existed). */
  seeded: boolean;
};

/**
 * Creates the CRM session row the moment a click is signed, so a click that
 * bounces before any JavaScript runs is still counted. Idempotent: a session
 * created earlier by the event pipeline only gains the still-missing
 * attribution columns. Falls back to the pre-migration `ensure` RPC while the
 * click-attribution migration has not been applied yet.
 */
export async function seedGoogleAdsSession(
  seed: GoogleAdsSessionSeed,
  timeoutMs = 2_500,
): Promise<GoogleAdsSessionSeedResult> {
  const base = {
    p_session_key: seed.sessionId,
    p_session_started_at: seed.startedAt,
    p_landing_path: seed.landingPath,
    p_utm_source: seed.attribution.source ?? null,
    p_utm_medium: seed.attribution.medium ?? null,
    p_utm_campaign: seed.attribution.campaign ?? null,
    p_utm_content: seed.attribution.content ?? null,
    p_google_click_id_present: seed.googleClickIdPresent,
  };
  const valueTrack = seed.valueTrack ?? {};
  try {
    const result = await callSupabaseRpc<{ accepted?: boolean; seeded?: boolean }>(
      "seed_google_ads_session",
      {
        ...base,
        p_campaign_id: valueTrack.campaignId ?? null,
        p_campaign_name: valueTrack.campaignName ?? null,
        p_ad_group_id: valueTrack.adGroupId ?? null,
        p_ad_group_name: valueTrack.adGroupName ?? null,
        p_keyword: valueTrack.keyword ?? null,
        p_match_type: valueTrack.matchType ?? null,
        p_network: valueTrack.network ?? null,
        p_ad_device: valueTrack.device ?? null,
        p_creative_id: valueTrack.creativeId ?? null,
      },
      timeoutMs,
    );
    return {
      accepted: result?.accepted === true,
      seeded: result?.seeded === true,
    };
  } catch (error) {
    if (!(error instanceof SupabaseServerError) || error.upstreamStatus !== 404) {
      throw error;
    }
    console.warn(
      "google-ads: seed_google_ads_session missing; run the click-attribution migration",
    );
    const ensured = await callSupabaseRpc<{ accepted?: boolean }>(
      "ensure_google_ads_session",
      base,
      timeoutMs,
    );
    return { accepted: ensured?.accepted === true, seeded: false };
  }
}

export type GoogleAdsConsultationLinkResult = {
  accepted: boolean;
  linked: boolean;
  sessionId: string;
  referenceId: string;
};

/**
 * Links an already-durable consultation request to an anonymous ad journey.
 * The RPC independently verifies that both records exist and were recorded as
 * Google Ads traffic before it accepts the relationship.
 */
export async function linkGoogleAdsConsultation(input: {
  sessionId: string;
  referenceId: string;
  submittedAt?: string;
  journey?: {
    attribution: {
      source?: string;
      medium?: string;
      campaign?: string;
      content?: string;
    };
    googleClickIdPresent: boolean;
    landingPath: string;
    startedAt: string;
  };
}): Promise<GoogleAdsConsultationLinkResult> {
  if (input.journey) {
    const ensured = await callSupabaseRpc<{ accepted: boolean }>(
      "ensure_google_ads_session",
      {
        p_session_key: input.sessionId,
        p_session_started_at: input.journey.startedAt,
        p_landing_path: input.journey.landingPath,
        p_utm_source: input.journey.attribution.source ?? null,
        p_utm_medium: input.journey.attribution.medium ?? null,
        p_utm_campaign: input.journey.attribution.campaign ?? null,
        p_utm_content: input.journey.attribution.content ?? null,
        p_google_click_id_present: input.journey.googleClickIdPresent,
      },
      3_000,
    );
    if (!ensured.accepted) {
      return {
        accepted: false,
        linked: false,
        sessionId: input.sessionId,
        referenceId: input.referenceId,
      };
    }
  }
  return callSupabaseRpc<GoogleAdsConsultationLinkResult>(
    "link_google_ads_consultation",
    {
      p_session_key: input.sessionId,
      p_reference_id: input.referenceId,
      p_submitted_at: input.submittedAt ?? null,
    },
    3_000,
  );
}

/** Atomically redeems the already-linked consultation conversion once. */
export async function consumeGoogleAdsConversion(input: {
  sessionId: string;
  referenceId: string;
  nonceHash: string;
}): Promise<{ accepted: boolean; replayed?: boolean }> {
  return callSupabaseRpc<{ accepted: boolean; replayed?: boolean }>(
    "consume_google_ads_conversion",
    {
      p_session_key: input.sessionId,
      p_reference_id: input.referenceId,
      p_nonce_hash: input.nonceHash,
    },
    5_000,
  );
}

/** The admin boundary normalizes this unknown RPC document before display. */
export async function fetchGoogleAdsDashboard(
  from: string,
  to: string,
): Promise<unknown> {
  await maybePruneGoogleAdsAnalytics();
  return callSupabaseRpc<unknown>(
    "get_google_ads_dashboard",
    { p_from: from, p_to: to },
    15_000,
  );
}

/**
 * Protected QA mirror of the live dashboard contract. The database RPC is
 * service-role-only and returns only sessions already classified as test.
 */
export async function fetchGoogleAdsTestDashboard(
  from: string,
  to: string,
): Promise<unknown> {
  await maybePruneGoogleAdsAnalytics();
  return callSupabaseRpc<unknown>(
    "get_google_ads_test_dashboard",
    { p_from: from, p_to: to },
    15_000,
  );
}

export type GoogleAdsExportPageInput = {
  from: string;
  to: string;
  test: boolean;
  limit: number;
  offset: number;
};

/** One page of privacy-safe journey rows for the CSV export. */
export async function fetchGoogleAdsJourneyExportPage(
  input: GoogleAdsExportPageInput,
): Promise<unknown> {
  return callSupabaseRpc<unknown>(
    "export_google_ads_journeys",
    {
      p_from: input.from,
      p_to: input.to,
      p_test: input.test,
      p_limit: input.limit,
      p_offset: input.offset,
    },
    20_000,
  );
}

/** One page of closed-taxonomy journey events for the CSV export. */
export async function fetchGoogleAdsEventExportPage(
  input: GoogleAdsExportPageInput,
): Promise<unknown> {
  return callSupabaseRpc<unknown>(
    "export_google_ads_journey_events",
    {
      p_from: input.from,
      p_to: input.to,
      p_test: input.test,
      p_limit: input.limit,
      p_offset: input.offset,
    },
    20_000,
  );
}

let lastPruneAt = 0;
let pruneInFlight: Promise<void> | null = null;

async function maybePruneGoogleAdsAnalytics(): Promise<void> {
  if (Date.now() - lastPruneAt < 24 * 60 * 60 * 1_000) return;
  if (pruneInFlight) return pruneInFlight;
  pruneInFlight = callSupabaseRpc("prune_google_ads_analytics", {}, 5_000)
    .then(() => {
      lastPruneAt = Date.now();
    })
    .catch((error) => {
      console.warn(
        "google-ads: analytics retention cleanup pending",
        error instanceof Error ? error.name : "unknown",
      );
    })
    .finally(() => {
      pruneInFlight = null;
    });
  return pruneInFlight;
}

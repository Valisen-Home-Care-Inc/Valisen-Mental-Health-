import type { GoogleAdsEventRecord } from "@/lib/server/googleAdsEventContract";
import { callSupabaseRpc } from "@/lib/server/supabaseServer";

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

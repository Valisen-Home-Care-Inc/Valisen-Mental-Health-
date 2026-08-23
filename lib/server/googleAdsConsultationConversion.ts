import { createGoogleAdsConversionReceipt } from "@/lib/server/googleAdsConversionReceipt";
import { linkGoogleAdsConsultation } from "@/lib/server/googleAdsRepository";
import type { VerifiedGoogleAdsJourney } from "@/lib/server/googleAdsJourneySession";

/**
 * Links a durable, server-classified Google Ads request and creates the
 * short-lived browser receipt used by the atomic thank-you claim.
 */
export async function prepareGoogleAdsConsultationConversion(input: {
  sessionId: string;
  referenceId: string;
  submittedAt?: string;
  journey: VerifiedGoogleAdsJourney;
}): Promise<string | null> {
  const link = await linkGoogleAdsConsultation(input);
  if (
    !link.accepted ||
    link.sessionId !== input.sessionId ||
    link.referenceId !== input.referenceId
  ) {
    return null;
  }
  return createGoogleAdsConversionReceipt({
    sessionId: input.sessionId,
    referenceId: input.referenceId,
  });
}

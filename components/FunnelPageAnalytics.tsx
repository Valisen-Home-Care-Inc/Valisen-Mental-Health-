"use client";

import { useEffect } from "react";
import {
  trackFunnelViewOnce,
} from "@/lib/analytics";
import {
  captureCampaignAttribution,
  isPaidAttribution,
} from "@/lib/campaignAttribution";

export default function FunnelPageAnalytics({
  page,
  observePricing = false,
  observeInsurance = false,
}: {
  page: "homepage" | "therapist_directory";
  observePricing?: boolean;
  observeInsurance?: boolean;
}) {
  useEffect(() => {
    const attribution = captureCampaignAttribution(window.location.search);
    const paid = isPaidAttribution(attribution);
    const landingPageVariant = paid ? "paid" : "default";

    try {
      window.sessionStorage.setItem(
        "valisen:landing-context:v1",
        JSON.stringify({
          landingPage: page,
          heroVariant: landingPageVariant,
        }),
      );
    } catch {
      // Analytics and storage must never block page content.
    }

    trackFunnelViewOnce(
      "landing_page_viewed",
      { page, attribution, landingPageVariant },
      `landing:${page}`,
    );
    trackFunnelViewOnce(
      page === "homepage" ? "homepage_viewed" : "therapist_directory_viewed",
      { page, attribution, landingPageVariant },
      page,
    );
    if (paid) {
      trackFunnelViewOnce(
        "paid_traffic_landed",
        { page, attribution, landingPageVariant },
        `paid:${page}`,
      );
    }

    const observedSections = [
      observePricing
        ? {
            id: "pricing",
            event: "pricing_section_viewed" as const,
          }
        : undefined,
      observeInsurance
        ? {
            id: "insurance",
            event: "insurance_section_viewed" as const,
          }
        : undefined,
    ].filter(Boolean) as Array<{
      id: string;
      event: "pricing_section_viewed" | "insurance_section_viewed";
    }>;

    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const section = observedSections.find(
            ({ id }) => id === entry.target.id,
          );
          if (!section) continue;
          trackFunnelViewOnce(section.event, {
            page,
            attribution,
            landingPageVariant,
          });
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.3 },
    );

    for (const section of observedSections) {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    }

    return () => observer.disconnect();
  }, [observeInsurance, observePricing, page]);

  return null;
}

"use client";

import { useEffect } from "react";
import {
  trackFunnelViewOnce,
  type PaidSearchFunnelPage,
} from "@/lib/analytics";
import {
  captureCampaignAttribution,
  captureGoogleAdsClickAttribution,
} from "@/lib/campaignAttribution";

type PaidSearchLandingPath =
  | "/lp/anxiety-therapy"
  | "/lp/depression-therapy"
  | "/lp/couples-therapy";

const FIRST_PARTY_PAGE_BY_PATH = {
  "/lp/anxiety-therapy": "paid_search_anxiety",
  "/lp/depression-therapy": "paid_search_depression",
  "/lp/couples-therapy": "paid_search_couples",
} as const satisfies Record<PaidSearchLandingPath, PaidSearchFunnelPage>;

export default function PaidSearchAnalytics({
  landingPath,
}: {
  landingPath: PaidSearchLandingPath;
}) {
  const firstPartyPage = FIRST_PARTY_PAGE_BY_PATH[landingPath];

  useEffect(() => {
    const attribution = captureCampaignAttribution(window.location.search);
    captureGoogleAdsClickAttribution(window.location.search);

    try {
      window.sessionStorage.setItem(
        "valisen:landing-context:v1",
        JSON.stringify({
          landingPage: landingPath,
          heroVariant: "paid",
        }),
      );
    } catch {
      // Storage and analytics must never block page content or navigation.
    }

    const properties = {
      page: firstPartyPage,
      attribution,
      landingPageVariant: "paid" as const,
    };

    trackFunnelViewOnce(
      "landing_page_viewed",
      properties,
      `landing:${landingPath}`,
    );
    trackFunnelViewOnce(
      "paid_traffic_landed",
      properties,
      `paid:${landingPath}`,
    );

    if (typeof IntersectionObserver === "undefined") return;

    const sections = [
      { id: "pricing", event: "pricing_section_viewed" as const },
      { id: "insurance", event: "insurance_section_viewed" as const },
    ];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const section = sections.find(({ id }) => id === entry.target.id);
          if (!section) continue;
          trackFunnelViewOnce(
            section.event,
            properties,
            `${section.event}:${landingPath}`,
          );
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.3 },
    );

    for (const section of sections) {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    }

    return () => observer.disconnect();
  }, [firstPartyPage, landingPath]);

  return null;
}

"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect, useState } from "react";
import GlobalFunnelClickTracker from "@/components/GlobalFunnelClickTracker";
import {
  shouldLoadGoogleAdsMarketingTags,
  shouldLoadSiteAnalytics,
} from "@/lib/analyticsBoundary";
import {
  captureCampaignTermAndStripFromUrl,
} from "@/lib/campaignAttribution";
import {
  getCheckpointSessionStorage,
  readCheckpointSession,
} from "@/lib/checkpoints/session";
import {
  captureGoogleAdsJourneyFromUrl,
  isGoogleAdsJourneyActive,
} from "@/lib/googleAdsJourney";

type BrowserAnalyticsState = {
  hasActiveCheckpointSession: boolean;
  isGoogleAdsJourney: boolean;
  hasConfirmedAdsThankYou: boolean;
};

type GoogleTagWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
};

function initializeGoogleAdsTag() {
  const target = window as GoogleTagWindow;
  target.dataLayer = target.dataLayer || [];
  target.gtag =
    target.gtag ||
    function (...args: unknown[]) {
      target.dataLayer?.push(args);
    };
  target.gtag("js", new Date());
  target.gtag("config", "AW-18124413697", {
    allow_ad_personalization_signals: false,
  });
  window.dispatchEvent(new Event("valisen:google-ads-tags-initialized"));
}

export default function SiteAnalyticsBoundary() {
  const pathname = usePathname();
  const [browserState, setBrowserState] =
    useState<BrowserAnalyticsState | null>(null);

  useEffect(() => {
    captureGoogleAdsJourneyFromUrl();
    const isGoogleAdsJourney = isGoogleAdsJourneyActive();
    if (isGoogleAdsJourney) {
      // Capture only the narrow first-touch campaign contract. Search terms
      // are removed before tags render, and raw click IDs never enter either
      // the regular or Google Ads journey event payload.
      captureCampaignTermAndStripFromUrl();
    } else if (pathname.startsWith("/lp/") || pathname === "/welcome") {
      // This runs before the state update that permits GTM/Ads to render.
      captureCampaignTermAndStripFromUrl();
    }
    setBrowserState({
      hasActiveCheckpointSession: Boolean(
        readCheckpointSession(getCheckpointSessionStorage()),
      ),
      isGoogleAdsJourney,
      // This becomes true only for the current document after the server has
      // atomically consumed its signed conversion receipt.
      hasConfirmedAdsThankYou: false,
    });

    const handleGoogleAdsConversionConfirmed = () => {
      if (
        !isGoogleAdsJourney ||
        pathname !== "/thank-you"
      ) {
        return;
      }
      setBrowserState((current) =>
        current
          ? { ...current, hasConfirmedAdsThankYou: true }
          : current,
      );
    };
    window.addEventListener(
      "valisen:google-ads-conversion-confirmed",
      handleGoogleAdsConversionConfirmed,
    );
    return () => {
      window.removeEventListener(
        "valisen:google-ads-conversion-confirmed",
        handleGoogleAdsConversionConfirmed,
      );
    };
  }, [pathname]);

  // Delay ordinary marketing tags until the browser-only privacy boundary is
  // known. A checkpoint session stays protected across its consultation or
  // therapist-navigation journey, not just while the visitor is on `/c/*`.
  if (!browserState) {
    return null;
  }

  const privacyDefaults = (
    <Script id="google-ads-privacy-defaults" strategy="afterInteractive">
      {`
        window.dataLayer = window.dataLayer || [];
        window.gtag = window.gtag || function(){window.dataLayer.push(arguments);};
        ${
          browserState.isGoogleAdsJourney
            ? `window.gtag('consent', 'default', {
                'ad_storage': 'denied',
                'analytics_storage': 'denied',
                'ad_user_data': 'denied',
                'ad_personalization': 'denied',
                'wait_for_update': 500
              });`
            : ""
        }
        window.gtag('set', 'allow_ad_personalization_signals', false);
      `}
    </Script>
  );

  if (browserState.isGoogleAdsJourney) {
    if (
      !shouldLoadGoogleAdsMarketingTags(
        pathname,
        browserState.hasConfirmedAdsThankYou,
      )
    ) {
      return privacyDefaults;
    }
  } else if (
    !shouldLoadSiteAnalytics(
      pathname,
      browserState.hasActiveCheckpointSession,
    )
  ) {
    return null;
  }

  return (
    <>
      {!browserState.isGoogleAdsJourney ? <GlobalFunnelClickTracker /> : null}
      {privacyDefaults}
      <Script id="google-tag-manager" strategy="afterInteractive">
        {`
          (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','GTM-T3RZ2837');
        `}
      </Script>
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=AW-18124413697"
        strategy="afterInteractive"
        onLoad={initializeGoogleAdsTag}
      />
    </>
  );
}

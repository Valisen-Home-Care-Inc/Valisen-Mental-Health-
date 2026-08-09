"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect, useState } from "react";
import GlobalFunnelClickTracker from "@/components/GlobalFunnelClickTracker";
import { shouldLoadSiteAnalytics } from "@/lib/analyticsBoundary";
import {
  getCheckpointSessionStorage,
  readCheckpointSession,
} from "@/lib/checkpoints/session";

export default function SiteAnalyticsBoundary() {
  const pathname = usePathname();
  const [hasActiveCheckpointSession, setHasActiveCheckpointSession] =
    useState<boolean | null>(null);

  useEffect(() => {
    setHasActiveCheckpointSession(
      Boolean(readCheckpointSession(getCheckpointSessionStorage())),
    );
  }, [pathname]);

  // Delay ordinary marketing tags until the browser-only privacy boundary is
  // known. A checkpoint session stays protected across its consultation or
  // therapist-navigation journey, not just while the visitor is on `/c/*`.
  if (
    hasActiveCheckpointSession === null ||
    !shouldLoadSiteAnalytics(pathname, hasActiveCheckpointSession)
  ) {
    return null;
  }

  return (
    <>
      <GlobalFunnelClickTracker />
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
      />
      <Script id="google-ads-tag" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'AW-18124413697');
        `}
      </Script>
    </>
  );
}

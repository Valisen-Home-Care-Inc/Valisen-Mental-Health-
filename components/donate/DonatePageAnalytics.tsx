"use client";

import { useEffect } from "react";
import { trackDonationCompletedOnce, trackDonationEvent } from "@/lib/donationAnalytics";

/** Fires the page-view event once per page load. */
export function DonatePageViewed() {
  useEffect(() => {
    trackDonationEvent("donate_page_viewed");
  }, []);
  return null;
}

/**
 * Rendered only after the server has confirmed with Stripe that the payment
 * is paid. Removes the session id from the address bar before marketing tags
 * load, then records the completion once.
 */
export function DonationCompleted({
  reference,
  dollars,
}: {
  reference: string;
  dollars: number;
}) {
  useEffect(() => {
    trackDonationCompletedOnce(reference, dollars);
  }, [reference, dollars]);
  return null;
}

/** Keeps the Checkout Session id out of page-view analytics and history. */
export function StripSessionIdFromUrl() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("session_id")) return;
    url.searchParams.delete("session_id");
    try {
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    } catch {
      // Referrer-Policy still prevents the id leaking to other origins.
    }
  }, []);
  return null;
}

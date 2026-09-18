"use client";
import { useEffect, useRef } from "react";
import { REFERRAL_EVENTS, trackReferralEvent, type ReferralEvent } from "@/lib/referralAnalytics";

export default function ReferralAnalytics() {
  const viewed = useRef(false);
  useEffect(() => {
    if (!viewed.current) { trackReferralEvent("referral_page_viewed"); viewed.current = true; }
    const click = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-referral-event]") : null;
      const name = target?.dataset.referralEvent;
      if (name && (REFERRAL_EVENTS as readonly string[]).includes(name)) trackReferralEvent(name as ReferralEvent);
    };
    document.addEventListener("click", click);
    return () => document.removeEventListener("click", click);
  }, []);
  return null;
}

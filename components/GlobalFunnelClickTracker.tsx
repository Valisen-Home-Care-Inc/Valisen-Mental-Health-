"use client";

import { useEffect } from "react";
import { trackFunnelEvent, type FunnelPage } from "@/lib/analytics";

function currentPage(pathname: string): FunnelPage {
  if (pathname === "/") return "homepage";
  if (pathname === "/therapists") return "therapist_directory";
  if (pathname.startsWith("/therapists/")) return "therapist_profile";
  if (pathname === "/quiz") return "quiz";
  if (pathname === "/consultation") return "consultation";
  return "sitewide";
}

export default function GlobalFunnelClickTracker() {
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.dataset.funnelTracked === "true") return;
      let destination: URL;
      try {
        destination = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (destination.origin !== window.location.origin) return;
      if (
        ![
          "/consultation",
          "/book-consultation",
          "/get-matched",
          "/intake",
        ].includes(destination.pathname)
      ) {
        return;
      }
      trackFunnelEvent("consultation_request_clicked", {
        page: currentPage(window.location.pathname),
        ctaPlacement: "consultation_primary",
      });
    }
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return null;
}

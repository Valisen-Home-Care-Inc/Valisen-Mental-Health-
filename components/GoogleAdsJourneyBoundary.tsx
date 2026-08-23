"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  canonicalizeGoogleAdsPath,
  captureGoogleAdsJourneyFromUrl,
  googleAdsSectionId,
  isCrisisPhoneHref,
  isGoogleAdsFormFieldId,
  isGoogleAdsJourneyActive,
  type GoogleAdsEventName,
  type GoogleAdsCtaPlacement,
  type GoogleAdsFormFieldId,
} from "@/lib/googleAdsJourney";
import {
  flushGoogleAdsEvents,
  recordGoogleAdsEvent,
  startGoogleAdsTracking,
  type GoogleAdsEventProperties,
} from "@/lib/googleAdsTracking";
import { isSensitiveGoogleAdsMarketingPath } from "@/lib/analyticsBoundary";

const ACTIVE_WINDOW_MS = 60_000;
const ENGAGEMENT_INTERVAL_MS = 10_000;
const CONSULTATION_PATHS = new Set([
  "/consultation",
  "/book-consultation",
  "/get-matched",
  "/intake",
]);

type PageState = {
  path: string;
  exited: boolean;
};

function safePlacement(element: Element): GoogleAdsCtaPlacement {
  if (element.closest("header, nav")) return "navigation";
  if (element.closest("footer")) return "footer";
  if (element.closest("form")) return "form";
  return "main";
}

function clickedElement(target: EventTarget | null): Element | null {
  if (target instanceof Element) return target;
  return target instanceof Node ? target.parentElement : null;
}

function consultationFieldId(element: Element): GoogleAdsFormFieldId | null {
  if (!(element instanceof HTMLElement)) return null;
  if (isGoogleAdsFormFieldId(element.id)) return element.id;
  if (element.matches('input[type="checkbox"]')) return "consent";
  if (element.matches('button[aria-pressed]')) return "availability";
  return null;
}

function therapistIdFromPath(pathname: string): string | undefined {
  const match = pathname.match(/^\/therapists\/([a-z0-9]+(?:-[a-z0-9]+)*)$/);
  return match?.[1]?.slice(0, 80);
}

function isPlainPrimaryClick(event: MouseEvent, anchor: HTMLAnchorElement): boolean {
  return (
    event.button === 0 &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    anchor.target !== "_blank" &&
    !anchor.hasAttribute("download")
  );
}

/**
 * Records only closed, structural interaction fields for a signed Ads journey.
 * It never reads labels, text content, form values, query values,
 * hashes, quiz answers, or the destination of an external link.
 */
export default function GoogleAdsJourneyBoundary() {
  const pathname = usePathname();
  const lastPageViewRef = useRef<string | null>(null);
  const pageStateRef = useRef<PageState | null>(null);

  useEffect(() => {
    captureGoogleAdsJourneyFromUrl();
    if (
      !isGoogleAdsJourneyActive() ||
      pathname === "/admin" ||
      pathname.startsWith("/admin/") ||
      pathname === "/c" ||
      pathname.startsWith("/c/")
    ) {
      return;
    }

    if (!startGoogleAdsTracking()) return;
    const recordPageEvent = (
      event: GoogleAdsEventName,
      properties: GoogleAdsEventProperties = {},
    ) => recordGoogleAdsEvent(event, { ...properties, path: pathname });
    if (lastPageViewRef.current !== pathname) {
      lastPageViewRef.current = pathname;
      pageStateRef.current = { path: pathname, exited: false };
      recordPageEvent("page_viewed");
    }

    const focusedFields = new Set<GoogleAdsFormFieldId>();
    const viewedSections = new Set<string>();
    const observedSections = new WeakSet<Element>();
    const reachedScrollDepths = new Set<25 | 50 | 75 | 100>();
    let currentSectionId: string | undefined;
    let lastActivityAt = Date.now();
    let lastEngagementAt = Date.now();
    let engagementWindowOpen =
      document.visibilityState === "visible" && document.hasFocus();

    const flushActiveTime = (now = Date.now()) => {
      const eligibleEnd = Math.min(now, lastActivityAt + ACTIVE_WINDOW_MS);
      const engagedMs = engagementWindowOpen
        ? Math.max(0, eligibleEnd - lastEngagementAt)
        : 0;
      lastEngagementAt = now;
      if (engagedMs < 1) return;
      recordPageEvent("engagement_ping", {
        sectionId: currentSectionId,
        engagedMs: Math.min(60_000, Math.round(engagedMs)),
      });
    };

    const markExited = () => {
      const pageState = pageStateRef.current;
      if (!pageState || pageState.path !== pathname || pageState.exited) return;
      flushActiveTime();
      pageState.exited = true;
      recordPageEvent("page_exited", {
        sectionId: currentSectionId,
      });
    };

    const markActivity = () => {
      const now = Date.now();
      if (now > lastActivityAt + ACTIVE_WINDOW_MS) flushActiveTime(now);
      lastActivityAt = now;
    };

    const sectionObserver =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            (entries) => {
              const visible = entries
                .filter((entry) => entry.isIntersecting)
                .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
              if (!visible) return;
              const sectionId = visible.target.getAttribute("data-google-ads-section-id");
              if (!sectionId) return;
              if (currentSectionId && currentSectionId !== sectionId) {
                flushActiveTime();
              }
              currentSectionId = sectionId;
              if (viewedSections.has(sectionId)) return;
              viewedSections.add(sectionId);
              recordPageEvent("section_viewed", { sectionId });
            },
            { threshold: [0.35, 0.65] },
          );

    const observeSections = () => {
      const sections = Array.from(document.querySelectorAll("main section"));
      sections.forEach((section, index) => {
        if (observedSections.has(section)) return;
        observedSections.add(section);
        const sectionId = googleAdsSectionId(index + 1);
        section.setAttribute("data-google-ads-section-id", sectionId);
        if (sectionObserver) {
          sectionObserver.observe(section);
        } else if (index === 0 && !viewedSections.has(sectionId)) {
          currentSectionId = sectionId;
          viewedSections.add(sectionId);
          recordPageEvent("section_viewed", { sectionId });
        }
      });
    };

    observeSections();
    const mutationObserver = new MutationObserver(observeSections);
    if (document.body) {
      mutationObserver.observe(document.body, { childList: true, subtree: true });
    }

    const recordScrollDepth = () => {
      const scrollable = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      const ratio = scrollable === 0 ? 1 : Math.min(1, window.scrollY / scrollable);
      for (const depth of [25, 50, 75, 100] as const) {
        if (ratio * 100 < depth || reachedScrollDepths.has(depth)) continue;
        reachedScrollDepths.add(depth);
        recordPageEvent("scroll_depth_reached", {
          sectionId: currentSectionId,
          scrollDepth: depth,
        });
      }
    };

    const onFocus = (event: FocusEvent) => {
      if (canonicalizeGoogleAdsPath(pathname) !== "/consultation") return;
      const element = clickedElement(event.target);
      if (!element || !element.closest("form")) return;
      const targetId = consultationFieldId(element);
      if (!targetId || focusedFields.has(targetId)) return;
      focusedFields.add(targetId);
      recordPageEvent("form_field_focused", {
        sectionId: currentSectionId,
        targetType: "form_field",
        targetId,
      });
    };

    const onClick = (event: MouseEvent) => {
      const origin = clickedElement(event.target);
      const actionable = origin?.closest("a, button, [role='button']");
      if (!actionable) return;

      const sectionId =
        actionable.closest("section")?.getAttribute("data-google-ads-section-id") ||
        currentSectionId;
      const ctaPlacement = safePlacement(actionable);

      if (actionable instanceof HTMLAnchorElement) {
        const rawHref = actionable.getAttribute("href") || "";
        if (!rawHref || isCrisisPhoneHref(rawHref)) return;

        if (rawHref.toLowerCase().startsWith("tel:")) {
          recordPageEvent("phone_clicked", {
            sectionId,
            targetType: "phone",
            ctaPlacement,
          });
          return;
        }
        if (rawHref.toLowerCase().startsWith("mailto:")) {
          recordPageEvent("email_clicked", {
            sectionId,
            targetType: "email",
            ctaPlacement,
          });
          return;
        }

        let destination: URL;
        try {
          destination = new URL(rawHref, window.location.href);
        } catch {
          return;
        }

        if (destination.origin !== window.location.origin) {
          recordPageEvent("external_link_clicked", {
            sectionId,
            targetType: "external",
            ctaPlacement,
          });
          if (isPlainPrimaryClick(event, actionable)) markExited();
          return;
        }

        const targetPath = canonicalizeGoogleAdsPath(destination.pathname);
        const therapistId = therapistIdFromPath(destination.pathname);
        if (CONSULTATION_PATHS.has(destination.pathname)) {
          recordPageEvent("consultation_cta_clicked", {
            sectionId,
            targetType: "consultation",
            targetPath,
            ctaPlacement,
          });
        } else if (therapistId) {
          recordPageEvent("therapist_profile_clicked", {
            sectionId,
            targetType: "therapist",
            targetPath,
            therapistId,
            ctaPlacement,
          });
        } else if (destination.pathname === "/quiz") {
          recordPageEvent("quiz_clicked", {
            sectionId,
            targetType: "quiz",
            targetPath,
            ctaPlacement,
          });
        } else {
          recordPageEvent("internal_link_clicked", {
            sectionId,
            targetType: "navigation",
            targetPath,
            ctaPlacement,
          });
        }

        const changesPage = destination.pathname !== window.location.pathname;
        if (changesPage && isPlainPrimaryClick(event, actionable)) {
          markExited();

          // Keep a document that loaded marketing tags from surviving into a
          // sensitive form/quiz route (and vice versa) through Next navigation.
          if (
            isSensitiveGoogleAdsMarketingPath(destination.pathname) ||
            isSensitiveGoogleAdsMarketingPath(window.location.pathname)
          ) {
            event.preventDefault();
            event.stopPropagation();
            void flushGoogleAdsEvents(true);
            window.location.assign(destination.href);
          }
        }
        return;
      }

      const button = actionable.closest("button, [role='button']");
      if (!button) return;
      const isSubmit =
        button instanceof HTMLButtonElement && button.type === "submit";
      recordPageEvent("control_clicked", {
        sectionId,
        targetType: "button",
        targetId: isSubmit ? "submit" : "button",
        ctaPlacement,
      });
    };

    const onPageHide = () => {
      markExited();
      void flushGoogleAdsEvents(true);
    };
    const onVisibilityChange = () => {
      flushActiveTime();
      engagementWindowOpen =
        document.visibilityState === "visible" && document.hasFocus();
      lastEngagementAt = Date.now();
      if (document.visibilityState === "hidden") {
        void flushGoogleAdsEvents(true);
      } else {
        markActivity();
      }
    };

    const onWindowFocus = () => {
      flushActiveTime();
      engagementWindowOpen = document.visibilityState === "visible";
      lastEngagementAt = Date.now();
      markActivity();
    };

    const onWindowBlur = () => {
      flushActiveTime();
      engagementWindowOpen = false;
      lastEngagementAt = Date.now();
    };

    const engagementTimer = window.setInterval(() => {
      flushActiveTime();
    }, ENGAGEMENT_INTERVAL_MS);

    document.addEventListener("click", onClick, true);
    document.addEventListener("focusin", onFocus, true);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("focus", onWindowFocus);
    window.addEventListener("blur", onWindowBlur);
    window.addEventListener("pointerdown", markActivity, { passive: true });
    window.addEventListener("keydown", markActivity);
    window.addEventListener("scroll", markActivity, { passive: true });
    window.addEventListener("scroll", recordScrollDepth, { passive: true });
    window.addEventListener("touchstart", markActivity, { passive: true });
    recordScrollDepth();

    return () => {
      markExited();
      void flushGoogleAdsEvents();
      window.clearInterval(engagementTimer);
      mutationObserver.disconnect();
      sectionObserver?.disconnect();
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("focusin", onFocus, true);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("focus", onWindowFocus);
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("pointerdown", markActivity);
      window.removeEventListener("keydown", markActivity);
      window.removeEventListener("scroll", markActivity);
      window.removeEventListener("scroll", recordScrollDepth);
      window.removeEventListener("touchstart", markActivity);
    };
  }, [pathname]);

  return null;
}

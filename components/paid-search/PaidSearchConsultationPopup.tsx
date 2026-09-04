"use client";

import { Clock3, ShieldCheck, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ConsultationCta from "@/components/paid-search/ConsultationCta";
import { CONSULTATION_DURATION_MINUTES } from "@/lib/therapists";

const DISMISSED_STORAGE_KEY = "valisen:google-ads-lp-popup-dismissed:v1";
const TRIGGER_SECTION_ID = "therapists";
const DELAY_MS = 7_000;

function alreadyDismissedThisSession(): boolean {
  try {
    return window.sessionStorage.getItem(DISMISSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberDismissed(): void {
  try {
    window.sessionStorage.setItem(DISMISSED_STORAGE_KEY, "1");
  } catch {
    // A storage-disabled browser just sees the popup again; not worth blocking on.
  }
}

/**
 * Shows a booking nudge once, seven seconds after the visitor has scrolled
 * fully past the therapist grid. It never renders a second live copy of the
 * consultation form (that would double-record Google Ads journey events for
 * every visitor who sees it); instead it hands off to the tracked form via
 * ConsultationCta's scroll-to-#contact.
 */
export default function PaidSearchConsultationPopup() {
  const [open, setOpen] = useState(false);
  const armedRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    rememberDismissed();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return;
    if (alreadyDismissedThisSession()) return;

    const target = document.getElementById(TRIGGER_SECTION_ID);
    if (!target) return;

    const arm = () => {
      if (armedRef.current) return;
      armedRef.current = true;
      observer.disconnect();
      timeoutRef.current = window.setTimeout(() => {
        if (alreadyDismissedThisSession()) return;
        // Never interrupt someone who already completed the form.
        if (document.querySelector('[data-consultation-submitted="true"]')) return;
        setOpen(true);
      }, DELAY_MS);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry || armedRef.current) return;
        // Fully scrolled past = no longer visible, and it exited past the top
        // of the viewport (not "not yet reached" on first paint).
        if (!entry.isIntersecting && entry.boundingClientRect.top < 0) arm();
      },
      { threshold: 0 },
    );
    observer.observe(target);

    // Fallback for viewports tall enough that the section never fully exits
    // the top (common on desktop): arm once its bottom edge is above the fold.
    const onScroll = () => {
      if (armedRef.current) return;
      if (target.getBoundingClientRect().bottom < 0) arm();
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={close}
        className="absolute inset-0 bg-ink/55 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lp-popup-heading"
        className="relative w-full max-w-[430px] rounded-[26px] bg-white p-5 shadow-[0_32px_90px_rgba(15,35,33,0.35)] sm:p-7"
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-ink-secondary transition hover:bg-canvas hover:text-ink"
        >
          <X size={18} aria-hidden="true" />
        </button>
        <span className="inline-flex items-center gap-1.5 rounded-pill bg-teal-xlight px-3 py-1 text-[11px] font-semibold text-teal-dark">
          <Clock3 size={13} aria-hidden="true" /> Reply within 24 hours
        </span>
        <h2 id="lp-popup-heading" className="mt-3 max-w-[330px] text-balance font-serif text-[23px] font-medium leading-[1.15] text-ink sm:text-[25px]">
          Still deciding? You will hear back within 24 hours.
        </h2>
        <p className="mt-2 text-[13px] leading-6 text-ink-secondary">
          No long waitlist. Send the short form and our team gets back to you within one business day to arrange your free {CONSULTATION_DURATION_MINUTES}-minute call.
        </p>
        <ConsultationCta
          placement="consultation_primary"
          className="btn-primary mt-4 min-h-[50px] w-full px-6 text-[14.5px]"
          label="Book My Free Consultation"
          onNavigate={close}
        />
        <p className="mt-2.5 flex items-center justify-center gap-2 text-[11px] text-ink-secondary">
          <ShieldCheck size={13} className="text-teal" aria-hidden="true" /> Private · No cost · No obligation
        </p>
      </div>
    </div>
  );
}

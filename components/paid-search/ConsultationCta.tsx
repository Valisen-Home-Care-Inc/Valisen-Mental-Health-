"use client";

import { ArrowRight } from "lucide-react";
import TrackedLink from "@/components/TrackedLink";
import type { FunnelCtaPlacement } from "@/lib/analytics";
import { scrollToSection } from "@/components/paid-search/scrollToSection";

const CONSULTATION_ANCHOR_ID = "contact";

/**
 * A same-page anchor href only re-triggers the browser's scroll-to-fragment
 * step when the URL hash actually changes. Clicking this CTA a second time
 * (hash already `#contact` after scrolling away and back) would otherwise do
 * nothing, so the scroll is also driven imperatively on every click.
 */
export default function ConsultationCta({
  placement,
  className,
  label = "Book a Free Consultation",
  ariaLabel,
  onNavigate,
}: {
  placement: FunnelCtaPlacement;
  className: string;
  label?: string;
  ariaLabel?: string;
  onNavigate?: () => void;
}) {
  return (
    <TrackedLink
      href={`#${CONSULTATION_ANCHOR_ID}`}
      event="consultation_request_clicked"
      page="paid_search_landing"
      placement={placement}
      className={className}
      ariaLabel={ariaLabel}
      onClick={(event) => {
        // Next's own Link hash-navigation races this scroll and, on this
        // page's geometry, wins with an incorrect position — take full
        // manual control instead of letting both run.
        event.preventDefault();
        onNavigate?.();
        window.history.replaceState(window.history.state, "", `#${CONSULTATION_ANCHOR_ID}`);
        window.requestAnimationFrame(() => scrollToSection(CONSULTATION_ANCHOR_ID));
      }}
    >
      {label}
      <ArrowRight size={16} className="ml-2" aria-hidden="true" />
    </TrackedLink>
  );
}

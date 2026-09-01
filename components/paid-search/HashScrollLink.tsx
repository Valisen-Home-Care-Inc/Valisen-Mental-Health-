"use client";

import type { ReactNode } from "react";
import { scrollToSection } from "@/components/paid-search/scrollToSection";

/**
 * Plain in-page anchor whose scroll is driven imperatively so a repeat click
 * still works after the visitor has scrolled away and the URL hash is
 * already at this target (see ConsultationCta for the same fix).
 */
export default function HashScrollLink({
  targetId,
  children,
  className,
}: {
  targetId: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={`#${targetId}`}
      className={className}
      onClick={(event) => {
        // The browser's own hash navigation can settle at the wrong offset
        // on this page's sticky-header geometry — take full manual control.
        event.preventDefault();
        window.history.replaceState(window.history.state, "", `#${targetId}`);
        window.requestAnimationFrame(() => scrollToSection(targetId));
      }}
    >
      {children}
    </a>
  );
}

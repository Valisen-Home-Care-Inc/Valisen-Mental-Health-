"use client";

import Link from "next/link";
import type { MouseEventHandler, ReactNode } from "react";
import {
  trackFunnelEvent,
  type FunnelCtaPlacement,
  type FunnelEvent,
  type FunnelPage,
} from "@/lib/analytics";

export default function TrackedLink({
  href,
  children,
  className,
  event,
  secondaryEvent,
  page,
  placement,
  finderUsed,
  newTab = false,
  janeClick = false,
  onClick,
  ariaLabel,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  event: FunnelEvent;
  secondaryEvent?: FunnelEvent;
  page: FunnelPage;
  placement: FunnelCtaPlacement;
  finderUsed?: boolean;
  newTab?: boolean;
  janeClick?: boolean;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  ariaLabel?: string;
}) {
  const handleClick: MouseEventHandler<HTMLAnchorElement> = (clickEvent) => {
    trackFunnelEvent(event, {
      page,
      ctaPlacement: placement,
      finderUsed,
    });
    if (secondaryEvent && secondaryEvent !== event) {
      trackFunnelEvent(secondaryEvent, {
        page,
        ctaPlacement: placement,
        finderUsed,
      });
    }
    if (janeClick && event !== "jane_booking_clicked") {
      trackFunnelEvent("jane_booking_clicked", {
        page,
        ctaPlacement: placement,
        finderUsed,
      });
    }
    onClick?.(clickEvent);
  };

  const sharedProps = {
    className,
    onClick: handleClick,
    "aria-label": ariaLabel,
    "data-funnel-tracked": "true",
  };

  if (newTab) {
    return (
      <a
        {...sharedProps}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    );
  }

  return (
    <Link {...sharedProps} href={href}>
      {children}
    </Link>
  );
}

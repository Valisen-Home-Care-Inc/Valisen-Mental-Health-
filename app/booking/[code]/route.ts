import { after, NextRequest, NextResponse } from "next/server";
import {
  bookingScanDevice,
  findBookingLink,
  isLikelyAutomatedRequest,
} from "@/lib/bookingLinks";
import { recordBookingLinkScan } from "@/lib/server/bookingLinkRepository";

/**
 * Tracked QR destination, e.g. https://valisenmentalhealth.com/booking/bc.
 * Redirects immediately; the scan is written after the response is sent so a
 * slow or unavailable database never delays or blocks the visitor.
 */

export const dynamic = "force-dynamic";

type BookingLinkRouteContext = { params: Promise<{ code: string }> };

const RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

function redirectTo(destination: string): NextResponse {
  const response = NextResponse.redirect(destination, 302);
  for (const [name, value] of Object.entries(RESPONSE_HEADERS)) {
    response.headers.set(name, value);
  }
  return response;
}

function notFound(): NextResponse {
  return new NextResponse("Not found", {
    status: 404,
    headers: { ...RESPONSE_HEADERS, "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function GET(request: NextRequest, context: BookingLinkRouteContext) {
  const { code } = await context.params;
  const link = findBookingLink(code);
  if (!link) return notFound();

  const userAgent = request.headers.get("user-agent");
  const prefetch =
    request.headers.get("purpose") === "prefetch" ||
    request.headers.get("sec-purpose")?.includes("prefetch") === true;

  if (!prefetch && !isLikelyAutomatedRequest(userAgent)) {
    const device = bookingScanDevice(userAgent);
    try {
      after(() =>
        recordBookingLinkScan(link.code, device).catch(() => {
          console.warn(`booking-link: scan for ${link.code} was not recorded`);
        }),
      );
    } catch {
      console.warn("booking-link: scan logging unavailable");
    }
  }

  return redirectTo(link.destination);
}

// Link checkers use HEAD. Answer with the same redirect, without counting a scan.
export async function HEAD(_request: NextRequest, context: BookingLinkRouteContext) {
  const { code } = await context.params;
  const link = findBookingLink(code);
  return link ? redirectTo(link.destination) : notFound();
}

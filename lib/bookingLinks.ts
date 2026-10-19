/**
 * Tracked booking links, one per flyer area: /booking/bh is Beacon Hill,
 * /booking/ka is Kanata, and so on.
 *
 * A scan of the printed QR code is logged (area code and a coarse device
 * category only) and the visitor is redirected straight to the external
 * booking page. To add an area, add one entry to BOOKING_LINKS and print a QR
 * code for `https://valisenmentalhealth.com/booking/<code>`; the admin
 * "Booking" tab shows a section for it automatically.
 */

export const JANE_BOOKING_URL = "https://valisenmentalhealth.janeapp.com/";

/** Admin navigation label for the booking scan tab. */
export const BOOKING_NAV_LABEL = "Booking";

export type BookingLink = {
  /** Lowercase path segment used in /booking/<code>. */
  code: string;
  /** Flyer area name shown in the admin dashboard. */
  label: string;
  /** Where the visitor is sent after the scan is logged. */
  destination: string;
};

function janeDestination(code: string): string {
  const url = new URL(JANE_BOOKING_URL);
  url.searchParams.set("utm_source", "qr");
  url.searchParams.set("utm_medium", "flyer");
  url.searchParams.set("utm_campaign", code);
  return url.toString();
}

// One entry per flyer area. The code is printed in the QR address, so do not
// change a code once its flyers are out; add a new area instead.
export const BOOKING_LINKS: readonly BookingLink[] = [
  { code: "bh", label: "Beacon Hill", destination: janeDestination("bh") },
  { code: "ka", label: "Kanata", destination: janeDestination("ka") },
];

export const BOOKING_LINK_CODE_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/;

export function bookingLinkPath(code: string): string {
  return `/booking/${code}`;
}

export function findBookingLink(code: unknown): BookingLink | null {
  if (typeof code !== "string") return null;
  const normalized = code.trim().toLowerCase();
  if (!BOOKING_LINK_CODE_PATTERN.test(normalized)) return null;
  return BOOKING_LINKS.find((link) => link.code === normalized) ?? null;
}

export function bookingLinkLabel(code: string): string {
  return findBookingLink(code)?.label ?? code.toUpperCase();
}

export type BookingScanDevice = "ios" | "android" | "other";

export function bookingScanDevice(userAgent: string | null | undefined): BookingScanDevice {
  const value = userAgent ?? "";
  if (/iphone|ipad|ipod/i.test(value)) return "ios";
  if (/android/i.test(value)) return "android";
  return "other";
}

// Link previews (messaging apps, social cards), crawlers and command-line
// clients also request URLs. They are redirected but never counted as scans.
const NON_HUMAN_AGENT =
  /bot\b|bot\/|crawl|spider|slurp|preview|facebookexternalhit|embedly|slackbot|discordbot|whatsapp|telegrambot|skypeuripreview|bitlybot|curl\/|wget\/|python-requests|httpclient|go-http-client|headlesschrome|lighthouse/i;

export function isLikelyAutomatedRequest(userAgent: string | null | undefined): boolean {
  const value = (userAgent ?? "").trim();
  if (!value) return true;
  return NON_HUMAN_AGENT.test(value);
}

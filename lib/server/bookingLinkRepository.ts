import type { BookingScanDevice } from "@/lib/bookingLinks";
import { callSupabaseRpc } from "@/lib/server/supabaseServer";

// Logging runs after the redirect has been sent, but should still finish
// promptly so a slow database never keeps a serverless function alive.
const RECORD_TIMEOUT_MS = 3_000;

export async function recordBookingLinkScan(
  linkCode: string,
  device: BookingScanDevice,
): Promise<void> {
  await callSupabaseRpc(
    "record_booking_link_scan",
    { p_link_code: linkCode, p_device: device },
    RECORD_TIMEOUT_MS,
  );
}

export type BookingLinkReport = {
  generatedAt: string;
  /** Toronto calendar date of "today" when the report was produced. */
  today: string;
  links: Array<{
    code: string;
    today: number;
    last7Days: number;
    last30Days: number;
    allTime: number;
    firstScanAt: string | null;
    lastScanAt: string | null;
  }>;
  /** One row per Toronto date with at least one scan, last 30 days. */
  daily: Array<{ code: string; date: string; count: number }>;
  /** Last 30 days. */
  devices: Array<{ code: string; device: BookingScanDevice; count: number }>;
  /** Most recent scans, newest first. */
  recent: Array<{ code: string; device: BookingScanDevice; scannedAt: string }>;
};

export async function fetchBookingLinkReport(): Promise<BookingLinkReport> {
  return callSupabaseRpc<BookingLinkReport>("get_booking_link_report", {});
}

import {
  BOOKING_LINKS,
  bookingLinkLabel,
  bookingLinkPath,
  type BookingScanDevice,
} from "@/lib/bookingLinks";
import type { BookingLinkReport } from "@/lib/server/bookingLinkRepository";

export const BOOKING_REPORT_DAYS = 30;

export type BookingLinkSection = {
  code: string;
  label: string;
  path: string;
  configured: boolean;
  today: number;
  last7Days: number;
  last30Days: number;
  allTime: number;
  lastScanAt: string | null;
  /** Exactly BOOKING_REPORT_DAYS Toronto dates, oldest first, zero-filled. */
  daily: Array<{ date: string; count: number }>;
  devices: Array<{ device: BookingScanDevice; count: number }>;
  recent: Array<{ device: BookingScanDevice; scannedAt: string }>;
};

const DEVICE_ORDER: BookingScanDevice[] = ["ios", "android", "other"];

/** Calendar dates (YYYY-MM-DD) ending at `today`, oldest first. */
export function trailingDates(today: string, days = BOOKING_REPORT_DAYS): string[] {
  const [year, month, day] = today.split("-").map(Number);
  const end = Date.UTC(year, month - 1, day);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(end - (days - 1 - index) * 86_400_000);
    return date.toISOString().slice(0, 10);
  });
}

/**
 * One section per configured booking link (even before its first scan), plus
 * any code that still has scans but was removed from the configuration.
 */
export function buildBookingLinkSections(report: BookingLinkReport): BookingLinkSection[] {
  const configured = new Set(BOOKING_LINKS.map((link) => link.code));
  const codes = [
    ...BOOKING_LINKS.map((link) => link.code),
    ...report.links.map((link) => link.code).filter((code) => !configured.has(code)),
  ];
  const dates = trailingDates(report.today);

  return codes.map((code) => {
    const totals = report.links.find((link) => link.code === code);
    const dailyCounts = new Map(
      report.daily.filter((row) => row.code === code).map((row) => [row.date, row.count]),
    );
    const deviceCounts = new Map(
      report.devices.filter((row) => row.code === code).map((row) => [row.device, row.count]),
    );
    return {
      code,
      label: bookingLinkLabel(code),
      path: bookingLinkPath(code),
      configured: configured.has(code),
      today: totals?.today ?? 0,
      last7Days: totals?.last7Days ?? 0,
      last30Days: totals?.last30Days ?? 0,
      allTime: totals?.allTime ?? 0,
      lastScanAt: totals?.lastScanAt ?? null,
      daily: dates.map((date) => ({ date, count: dailyCounts.get(date) ?? 0 })),
      devices: DEVICE_ORDER.map((device) => ({ device, count: deviceCounts.get(device) ?? 0 })),
      recent: report.recent
        .filter((row) => row.code === code)
        .map(({ device, scannedAt }) => ({ device, scannedAt })),
    };
  });
}

export function bookingDeviceLabel(device: BookingScanDevice): string {
  if (device === "ios") return "iPhone / iPad";
  if (device === "android") return "Android";
  return "Other";
}

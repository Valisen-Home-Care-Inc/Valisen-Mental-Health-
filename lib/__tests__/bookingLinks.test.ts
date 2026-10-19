import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BOOKING_LINKS,
  BOOKING_NAV_LABEL,
  bookingLinkLabel,
  bookingScanDevice,
  findBookingLink,
  isLikelyAutomatedRequest,
} from "@/lib/bookingLinks";
import { buildBookingLinkSections, trailingDates } from "@/lib/bookingLinkReport";

const recordBookingLinkScan = vi.hoisted(() => vi.fn());
const afterCallbacks = vi.hoisted(() => [] as Array<() => unknown>);

vi.mock("@/lib/server/bookingLinkRepository", () => ({ recordBookingLinkScan }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (callback: () => unknown) => {
    afterCallbacks.push(callback);
  },
}));

const { GET, HEAD } = await import("@/app/booking/[code]/route");

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";

const EMPTY_REPORT = {
  generatedAt: "2026-10-19T19:00:00Z",
  today: "2026-10-19",
  links: [],
  daily: [],
  devices: [],
  recent: [],
};

function request(code: string, headers: Record<string, string> = {}, method = "GET") {
  return new NextRequest(`https://valisenmentalhealth.com/booking/${code}`, { method, headers });
}

function context(code: string) {
  return { params: Promise.resolve({ code }) };
}

async function runAfter() {
  await Promise.all(afterCallbacks.splice(0).map((callback) => callback()));
}

beforeEach(() => {
  recordBookingLinkScan.mockReset();
  recordBookingLinkScan.mockResolvedValue(undefined);
  afterCallbacks.length = 0;
});

describe("flyer area configuration", () => {
  it("has Beacon Hill at /booking/bh and Kanata at /booking/ka, both sent to Jane", () => {
    expect(findBookingLink("bh")?.label).toBe("Beacon Hill");
    expect(findBookingLink("ka")?.label).toBe("Kanata");
    for (const link of BOOKING_LINKS) {
      const destination = new URL(link.destination);
      expect(destination.origin).toBe("https://valisenmentalhealth.janeapp.com");
      expect(destination.searchParams.get("utm_campaign")).toBe(link.code);
    }
  });

  it("no longer answers the retired bc code", () => {
    expect(findBookingLink("bc")).toBeNull();
  });

  it("uses unique, URL-safe codes and names", () => {
    const codes = BOOKING_LINKS.map((link) => link.code);
    const labels = BOOKING_LINKS.map((link) => link.label);
    expect(new Set(codes).size).toBe(codes.length);
    expect(new Set(labels).size).toBe(labels.length);
    for (const code of codes) expect(code).toMatch(/^[a-z0-9][a-z0-9-]{0,39}$/);
  });

  it("matches codes case-insensitively and rejects unknown or malformed ones", () => {
    expect(findBookingLink("BH")?.code).toBe("bh");
    expect(findBookingLink("nope")).toBeNull();
    expect(findBookingLink("../bh")).toBeNull();
    expect(findBookingLink(undefined)).toBeNull();
    expect(bookingLinkLabel("zz")).toBe("ZZ");
  });

  it("calls the admin tab Booking", () => {
    expect(BOOKING_NAV_LABEL).toBe("Booking");
  });

  it("classifies devices coarsely", () => {
    expect(bookingScanDevice(IPHONE)).toBe("ios");
    expect(bookingScanDevice(ANDROID)).toBe("android");
    expect(bookingScanDevice("Mozilla/5.0 (Windows NT 10.0) Chrome/129.0")).toBe("other");
  });

  it("treats link previews, crawlers and empty agents as automated", () => {
    expect(isLikelyAutomatedRequest(IPHONE)).toBe(false);
    expect(isLikelyAutomatedRequest(ANDROID)).toBe(false);
    for (const agent of [
      "",
      "facebookexternalhit/1.1",
      "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
      "WhatsApp/2.23.20.0",
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "curl/8.4.0",
    ]) {
      expect(isLikelyAutomatedRequest(agent)).toBe(true);
    }
  });
});

describe("/booking/[code] route", () => {
  it("redirects a Beacon Hill scan to Jane and logs it under bh after the response", async () => {
    const response = await GET(request("bh", { "user-agent": IPHONE }), context("bh"));
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(findBookingLink("bh")!.destination);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(recordBookingLinkScan).not.toHaveBeenCalled();
    await runAfter();
    expect(recordBookingLinkScan).toHaveBeenCalledWith("bh", "ios");
  });

  it("logs a Kanata scan under ka", async () => {
    const response = await GET(request("ka", { "user-agent": ANDROID }), context("ka"));
    expect(response.status).toBe(302);
    await runAfter();
    expect(recordBookingLinkScan).toHaveBeenCalledWith("ka", "android");
  });

  it("still redirects when the database write fails", async () => {
    recordBookingLinkScan.mockRejectedValue(new Error("database down"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const response = await GET(request("bh", { "user-agent": ANDROID }), context("bh"));
    expect(response.status).toBe(302);
    await runAfter();
    expect(recordBookingLinkScan).toHaveBeenCalledWith("bh", "android");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("redirects link previews and prefetches without counting them", async () => {
    const preview = await GET(request("bh", { "user-agent": "facebookexternalhit/1.1" }), context("bh"));
    const prefetch = await GET(
      request("bh", { "user-agent": IPHONE, "sec-purpose": "prefetch" }),
      context("bh"),
    );
    expect(preview.status).toBe(302);
    expect(prefetch.status).toBe(302);
    await runAfter();
    expect(recordBookingLinkScan).not.toHaveBeenCalled();
  });

  it("answers HEAD with the redirect and never counts it", async () => {
    const response = await HEAD(request("bh", { "user-agent": IPHONE }, "HEAD"), context("bh"));
    expect(response.status).toBe(302);
    await runAfter();
    expect(recordBookingLinkScan).not.toHaveBeenCalled();
  });

  it("returns 404 for unknown codes, including the retired bc", async () => {
    for (const code of ["unknown", "bc"]) {
      const response = await GET(request(code, { "user-agent": IPHONE }), context(code));
      expect(response.status).toBe(404);
    }
    await runAfter();
    expect(recordBookingLinkScan).not.toHaveBeenCalled();
  });
});

describe("booking scan report", () => {
  it("lists 30 Toronto dates ending today, across a month boundary", () => {
    const dates = trailingDates("2026-11-02");
    expect(dates).toHaveLength(30);
    expect(dates[0]).toBe("2026-10-04");
    expect(dates.at(-1)).toBe("2026-11-02");
  });

  it("shows a section for every area with zeros before its first scan", () => {
    const sections = buildBookingLinkSections(EMPTY_REPORT);
    expect(sections.map((section) => section.label)).toEqual(BOOKING_LINKS.map((link) => link.label));
    for (const section of sections) {
      expect(section.allTime).toBe(0);
      expect(section.daily).toHaveLength(30);
      expect(section.daily.every((day) => day.count === 0)).toBe(true);
      expect(section.devices.map((row) => row.device)).toEqual(["ios", "android", "other"]);
    }
  });

  it("keeps each area's counts separate and keeps removed areas visible", () => {
    const sections = buildBookingLinkSections({
      ...EMPTY_REPORT,
      links: [
        { code: "bh", today: 2, last7Days: 5, last30Days: 9, allTime: 9, firstScanAt: null, lastScanAt: "2026-10-19T18:00:00Z" },
        { code: "ka", today: 0, last7Days: 1, last30Days: 3, allTime: 3, firstScanAt: null, lastScanAt: "2026-10-16T12:00:00Z" },
        { code: "old", today: 0, last7Days: 0, last30Days: 1, allTime: 4, firstScanAt: null, lastScanAt: "2026-10-01T12:00:00Z" },
      ],
      daily: [
        { code: "bh", date: "2026-10-19", count: 2 },
        { code: "bh", date: "2026-10-15", count: 3 },
        { code: "ka", date: "2026-10-16", count: 1 },
        { code: "old", date: "2026-10-01", count: 1 },
      ],
      devices: [
        { code: "bh", device: "ios", count: 6 },
        { code: "bh", device: "android", count: 3 },
        { code: "ka", device: "other", count: 3 },
      ],
      recent: [
        { code: "bh", device: "ios", scannedAt: "2026-10-19T18:00:00Z" },
        { code: "ka", device: "other", scannedAt: "2026-10-16T12:00:00Z" },
      ],
    });
    const beaconHill = sections.find((section) => section.code === "bh")!;
    const kanata = sections.find((section) => section.code === "ka")!;
    expect(beaconHill.label).toBe("Beacon Hill");
    expect(beaconHill.daily.at(-1)).toEqual({ date: "2026-10-19", count: 2 });
    expect(beaconHill.daily.find((day) => day.date === "2026-10-15")?.count).toBe(3);
    expect(beaconHill.devices).toEqual([
      { device: "ios", count: 6 },
      { device: "android", count: 3 },
      { device: "other", count: 0 },
    ]);
    expect(beaconHill.recent).toHaveLength(1);
    expect(kanata.last30Days).toBe(3);
    expect(kanata.daily.find((day) => day.date === "2026-10-16")?.count).toBe(1);
    expect(kanata.recent).toEqual([{ device: "other", scannedAt: "2026-10-16T12:00:00Z" }]);
    const old = sections.find((section) => section.code === "old")!;
    expect(old.configured).toBe(false);
    expect(old.allTime).toBe(4);
  });
});

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BOOKING_LINKS,
  bookingNavigationLabel,
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

describe("booking link configuration", () => {
  it("has Booking BC pointing at the Jane booking page", () => {
    const link = findBookingLink("bc");
    expect(link?.label).toBe("Booking BC");
    const destination = new URL(link!.destination);
    expect(destination.origin).toBe("https://valisenmentalhealth.janeapp.com");
    expect(destination.searchParams.get("utm_campaign")).toBe("bc");
  });

  it("uses unique, URL-safe codes", () => {
    const codes = BOOKING_LINKS.map((link) => link.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(code).toMatch(/^[a-z0-9][a-z0-9-]{0,39}$/);
  });

  it("matches codes case-insensitively and rejects unknown or malformed ones", () => {
    expect(findBookingLink("BC")?.code).toBe("bc");
    expect(findBookingLink("nope")).toBeNull();
    expect(findBookingLink("../bc")).toBeNull();
    expect(findBookingLink(undefined)).toBeNull();
  });

  it("names the admin tab after the only link", () => {
    expect(bookingNavigationLabel()).toBe(BOOKING_LINKS.length === 1 ? "Booking BC" : "Booking links");
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
  it("redirects a phone scan to Jane and logs it after the response", async () => {
    const response = await GET(request("bc", { "user-agent": IPHONE }), context("bc"));
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(findBookingLink("bc")!.destination);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(recordBookingLinkScan).not.toHaveBeenCalled();
    await runAfter();
    expect(recordBookingLinkScan).toHaveBeenCalledWith("bc", "ios");
  });

  it("still redirects when the database write fails", async () => {
    recordBookingLinkScan.mockRejectedValue(new Error("database down"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const response = await GET(request("bc", { "user-agent": ANDROID }), context("bc"));
    expect(response.status).toBe(302);
    await runAfter();
    expect(recordBookingLinkScan).toHaveBeenCalledWith("bc", "android");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("redirects link previews and prefetches without counting them", async () => {
    const preview = await GET(request("bc", { "user-agent": "facebookexternalhit/1.1" }), context("bc"));
    const prefetch = await GET(
      request("bc", { "user-agent": IPHONE, "sec-purpose": "prefetch" }),
      context("bc"),
    );
    expect(preview.status).toBe(302);
    expect(prefetch.status).toBe(302);
    await runAfter();
    expect(recordBookingLinkScan).not.toHaveBeenCalled();
  });

  it("answers HEAD with the redirect and never counts it", async () => {
    const response = await HEAD(request("bc", { "user-agent": IPHONE }, "HEAD"), context("bc"));
    expect(response.status).toBe(302);
    await runAfter();
    expect(recordBookingLinkScan).not.toHaveBeenCalled();
  });

  it("returns 404 for unknown codes", async () => {
    const response = await GET(request("unknown", { "user-agent": IPHONE }), context("unknown"));
    expect(response.status).toBe(404);
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

  it("shows Booking BC with zeros before its first scan", () => {
    const [section] = buildBookingLinkSections({
      generatedAt: "2026-10-19T19:00:00Z",
      today: "2026-10-19",
      links: [],
      daily: [],
      devices: [],
      recent: [],
    });
    expect(section.label).toBe("Booking BC");
    expect(section.allTime).toBe(0);
    expect(section.daily).toHaveLength(30);
    expect(section.daily.every((day) => day.count === 0)).toBe(true);
    expect(section.devices.map((row) => row.device)).toEqual(["ios", "android", "other"]);
  });

  it("fills daily counts and keeps scans from removed links visible", () => {
    const sections = buildBookingLinkSections({
      generatedAt: "2026-10-19T19:00:00Z",
      today: "2026-10-19",
      links: [
        { code: "bc", today: 2, last7Days: 5, last30Days: 9, allTime: 9, firstScanAt: null, lastScanAt: "2026-10-19T18:00:00Z" },
        { code: "old", today: 0, last7Days: 0, last30Days: 1, allTime: 4, firstScanAt: null, lastScanAt: "2026-10-01T12:00:00Z" },
      ],
      daily: [
        { code: "bc", date: "2026-10-19", count: 2 },
        { code: "bc", date: "2026-10-15", count: 3 },
        { code: "old", date: "2026-10-01", count: 1 },
      ],
      devices: [{ code: "bc", device: "ios", count: 6 }, { code: "bc", device: "android", count: 3 }],
      recent: [{ code: "bc", device: "ios", scannedAt: "2026-10-19T18:00:00Z" }],
    });
    const bc = sections.find((section) => section.code === "bc")!;
    expect(bc.daily.at(-1)).toEqual({ date: "2026-10-19", count: 2 });
    expect(bc.daily.find((day) => day.date === "2026-10-15")?.count).toBe(3);
    expect(bc.devices).toEqual([
      { device: "ios", count: 6 },
      { device: "android", count: 3 },
      { device: "other", count: 0 },
    ]);
    expect(bc.recent).toHaveLength(1);
    const old = sections.find((section) => section.code === "old")!;
    expect(old.configured).toBe(false);
    expect(old.allTime).toBe(4);
  });
});

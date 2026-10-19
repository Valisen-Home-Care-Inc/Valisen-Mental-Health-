import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  bookingFlyerFilename,
  bookingFlyerQr,
  bookingFlyerUrl,
  bookingQrFilename,
  bookingQrPlacement,
  bookingQrSvg,
  zipBookingFlyers,
} from "@/lib/bookingFlyer";
import { BOOKING_LINKS, findBookingLink } from "@/lib/bookingLinks";

const PANEL = { x: 405, y: 1022, width: 291, height: 276 };

describe("booking flyer QR codes", () => {
  it("encodes each area's canonical production address", () => {
    expect(bookingFlyerUrl(findBookingLink("bh")!)).toBe("https://valisenmentalhealth.com/booking/bh");
    expect(bookingFlyerUrl(findBookingLink("ka")!)).toBe("https://valisenmentalhealth.com/booking/ka");
  });

  it("gives every area a different, valid QR symbol", () => {
    const keys = BOOKING_LINKS.map((link) => {
      const qr = bookingFlyerQr(link);
      expect(qr.size % 4).toBe(1); // 21, 25, 29, 33 … modules
      expect(qr.isDark(0, 0)).toBe(true);
      expect(qr.isDark(0, qr.size - 1)).toBe(true);
      expect(qr.isDark(qr.size - 1, 0)).toBe(true);
      let key = "";
      for (let row = 0; row < qr.size; row += 1) {
        for (let column = 0; column < qr.size; column += 1) key += qr.isDark(row, column) ? "1" : "0";
      }
      return key;
    });
    expect(new Set(keys).size).toBe(BOOKING_LINKS.length);
  });

  it("fits the QR inside the white panel with at least a 4-module margin", () => {
    for (const link of BOOKING_LINKS) {
      const { size } = bookingFlyerQr(link);
      const place = bookingQrPlacement(size);
      const margin = 4 * place.pitch - 1e-9;
      expect(place.x - PANEL.x).toBeGreaterThanOrEqual(margin);
      expect(place.y - PANEL.y).toBeGreaterThanOrEqual(margin);
      expect(PANEL.x + PANEL.width - (place.x + place.size)).toBeGreaterThanOrEqual(margin);
      expect(PANEL.y + PANEL.height - (place.y + place.size)).toBeGreaterThanOrEqual(margin);
      // Big enough to scan from arm's length on a letter-size print (about 1.7 in).
      expect(place.size).toBeGreaterThan(200);
    }
  });

  it("exports a standalone SVG with a white quiet zone", () => {
    const link = findBookingLink("bh")!;
    const svg = bookingQrSvg(link);
    const size = bookingFlyerQr(link).size + 8;
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain(`viewBox="0 0 ${size} ${size}"`);
    expect(svg).toContain("<title>https://valisenmentalhealth.com/booking/bh</title>");
    expect(svg).toContain('fill="#ffffff"');
  });
});

describe("booking flyer files", () => {
  it("names files after the area", () => {
    const link = findBookingLink("bh")!;
    expect(bookingFlyerFilename(link)).toBe("Booking-Flyer-Beacon-Hill-bh.png");
    expect(bookingQrFilename(link)).toBe("Booking-QR-Beacon-Hill-bh.svg");
  });

  it("puts one flyer per area into the ZIP", () => {
    const files = BOOKING_LINKS.map((link, index) => ({ link, png: new Uint8Array([index, 7]) }));
    const unzipped = unzipSync(zipBookingFlyers(files));
    expect(Object.keys(unzipped)).toEqual(BOOKING_LINKS.map(bookingFlyerFilename));
    expect(Array.from(unzipped["Booking-Flyer-Kanata-ka.png"])).toEqual([1, 7]);
  });
});

import { zipSync } from "fflate";
import QRCode from "qrcode";
import { bookingLinkPath, type BookingLink } from "@/lib/bookingLinks";
import { CHECKPOINT_BASE_URL } from "@/lib/checkpoints/config";
import type { FlyerScale } from "@/lib/checkpoints/flyer";

/**
 * "Need Support? Talk to a Therapist." print flyer with a booking QR code per
 * flyer area (/booking/bh, /booking/ka, ...).
 *
 * The artwork is a fixed raster template. The generator repaints the white
 * rounded panel that holds the QR code and draws the area's QR inside it in
 * solid navy with a full quiet zone. Solid dark-on-white is deliberate: the
 * gradient QR on the original artwork only decoded after image cleanup, and a
 * flyer QR has to scan from a phone in dim waiting rooms. Measurements are in
 * template pixels, taken from the artwork.
 */
export const BOOKING_FLYER_TEMPLATE_SRC = "/flyers/need-support-flyer.png";
// 1103 px across 8.5 in ≈ 5109 px per metre, so PNGs open at US Letter size.
export const BOOKING_FLYER_TEMPLATE = { width: 1103, height: 1426, pixelsPerMetre: 5109 } as const;
export const BOOKING_FLYER_ZIP_FILENAME = "Valisen-Booking-Flyers-All-Areas.zip";

/** The white rounded panel on the artwork that holds the QR code. */
const PANEL = { x: 405, y: 1022, width: 291, height: 276, radius: 26 } as const;
/** Light margin around the symbol, in modules. The QR standard asks for 4. */
const QUIET_ZONE_MODULES = 4;
export const BOOKING_QR_COLOUR = "#0b1446";

export type BookingFlyerQr = {
  url: string;
  size: number;
  isDark: (row: number, column: number) => boolean;
};

/** Always the canonical production address, so a preview deploy never prints a wrong QR. */
export function bookingFlyerUrl(link: BookingLink): string {
  return new URL(bookingLinkPath(link.code), `${CHECKPOINT_BASE_URL}/`).toString();
}

export function bookingFlyerQr(link: BookingLink): BookingFlyerQr {
  const url = bookingFlyerUrl(link);
  const qr = QRCode.create([{ data: new TextEncoder().encode(url), mode: "byte" }], {
    errorCorrectionLevel: "Q",
  });
  return {
    url,
    size: qr.modules.size,
    isDark: (row, column) => Boolean(qr.modules.get(row, column)),
  };
}

function fileSafe(value: string): string {
  return value.normalize("NFKD").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function bookingFlyerFilename(link: BookingLink): string {
  return `Booking-Flyer-${fileSafe(link.label)}-${link.code}.png`;
}

export function bookingQrFilename(link: BookingLink): string {
  return `Booking-QR-${fileSafe(link.label)}-${link.code}.svg`;
}

/** Where the symbol (without quiet zone) sits on the template, in template pixels. */
export function bookingQrPlacement(moduleCount: number) {
  const units = moduleCount + 2 * QUIET_ZONE_MODULES;
  const pitch = Math.min(PANEL.width, PANEL.height) / units;
  const size = pitch * moduleCount;
  return {
    x: PANEL.x + (PANEL.width - size) / 2,
    y: PANEL.y + (PANEL.height - size) / 2,
    size,
    pitch,
  };
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function drawQr(context: CanvasRenderingContext2D, qr: BookingFlyerQr, scale: number) {
  // Repaint the panel to remove the artwork's own QR.
  context.fillStyle = "#ffffff";
  context.beginPath();
  roundedRect(
    context,
    PANEL.x * scale,
    PANEL.y * scale,
    PANEL.width * scale,
    PANEL.height * scale,
    PANEL.radius * scale,
  );
  context.fill();

  // Module edges are snapped to whole device pixels so neighbouring modules
  // join without hairline seams at any export scale.
  const place = bookingQrPlacement(qr.size);
  const edge = (start: number, index: number) => Math.round((start + index * place.pitch) * scale);
  context.fillStyle = BOOKING_QR_COLOUR;
  context.beginPath();
  for (let row = 0; row < qr.size; row += 1) {
    const top = edge(place.y, row);
    const bottom = edge(place.y, row + 1);
    for (let column = 0; column < qr.size; column += 1) {
      if (!qr.isDark(row, column)) continue;
      const left = edge(place.x, column);
      const right = edge(place.x, column + 1);
      context.rect(left, top, right - left, bottom - top);
    }
  }
  context.fill();
}

/** Draws the flyer onto `canvas`. A null link shows the untouched artwork. */
export function drawBookingFlyer(
  canvas: HTMLCanvasElement,
  template: CanvasImageSource,
  link: BookingLink | null,
  scale: FlyerScale,
) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot draw the flyer.");
  canvas.width = BOOKING_FLYER_TEMPLATE.width * scale;
  canvas.height = BOOKING_FLYER_TEMPLATE.height * scale;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.imageSmoothingEnabled = scale !== 1;
  context.imageSmoothingQuality = "high";
  context.drawImage(template, 0, 0, canvas.width, canvas.height);
  if (!link) return;
  drawQr(context, bookingFlyerQr(link), scale);
}

/** The area's QR code on its own, as a print-ready SVG with a white quiet zone. */
export function bookingQrSvg(link: BookingLink): string {
  const qr = bookingFlyerQr(link);
  const total = qr.size + 2 * QUIET_ZONE_MODULES;
  let path = "";
  for (let row = 0; row < qr.size; row += 1) {
    for (let column = 0; column < qr.size; column += 1) {
      if (qr.isDark(row, column)) {
        path += `M${column + QUIET_ZONE_MODULES} ${row + QUIET_ZONE_MODULES}h1v1h-1z`;
      }
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${total * 10}" height="${total * 10}" shape-rendering="crispEdges">` +
    `<title>${qr.url}</title>` +
    `<rect width="${total}" height="${total}" fill="#ffffff"/>` +
    `<path fill="${BOOKING_QR_COLOUR}" d="${path}"/>` +
    `</svg>`
  );
}

export type BookingFlyerFile = { link: BookingLink; png: Uint8Array };

/** One ZIP with a flyer PNG per area. PNG data is already compressed, so entries are stored. */
export function zipBookingFlyers(files: readonly BookingFlyerFile[]): Uint8Array {
  return zipSync(
    Object.fromEntries(files.map((file) => [bookingFlyerFilename(file.link), file.png])),
    { level: 0 },
  );
}

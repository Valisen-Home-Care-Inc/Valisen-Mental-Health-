import { zipSync } from "fflate";
import QRCode from "qrcode";
import { checkpointPermanentUrl, type CheckpointCode } from "@/lib/checkpoints/config";

/**
 * Mental Battery print flyer.
 *
 * The flyer artwork is a fixed raster template. Only the QR code changes per
 * checkpoint, so the generator repaints the white square that holds it and
 * redraws a QR in the artwork's own style. Every measurement below is in
 * template pixels and was taken from the QR on the original artwork, which is
 * a version 5 / level H symbol — the same symbol every checkpoint URL produces.
 */
export const FLYER_TEMPLATE_SRC = "/checkpoints/mental-battery-flyer.png";
export const FLYER_TEMPLATE = { width: 1545, height: 1999, pixelsPerMetre: 7165 } as const;
export const FLYER_SCALES = [2, 1] as const;
export type FlyerScale = (typeof FLYER_SCALES)[number];
export const FLYER_ZIP_FILENAME = "Valisen-Mental-Battery-Flyers-VMH-01-to-VMH-25.zip";

const QR_VERSION = 5;
const QR_MODULES = 37;
const QR_BOX = { x: 574.6, y: 1404.65, size: 404.04 } as const;
const QR_CLEAR = { x: 570, y: 1400, width: 413, height: 413 } as const;
const MODULE = { size: 9.79, radius: 1 } as const;
const FINDER = {
  outer: 76.57,
  outerRadius: 20,
  ring: 11.72,
  holeRadius: 8.3,
  centre: 32.77,
  centreRadius: 6.4,
} as const;
const FINDER_COLOURS = { topLeft: "#ec1769", topRight: "#1747ae", bottomLeft: "#f06a16" } as const;
// Module colours along the artwork's bottom-left → top-right diagonal (teal →
// blue → indigo), one stop per module step.
const MODULE_GRADIENT = (
  "00b1b5 00afb6 00aeb7 00acb8 00abba 00a9bb 00a8bd 00a6be 00a5bf 00a3c1 00a2c2 00a0c4 " +
  "009fc5 009dc6 009cc8 009bc9 0099cb 0097cb 0195ca 0292ca 0390ca 048dca 058bca 0689ca " +
  "0786ca 0884ca 0882ca 0980ca 0a7dca 0b7bca 0c78c9 0d76c9 0e74ca 0f71c9 106fc9 116dc9 " +
  "126ac9 1268c9 1366c9 1463c9 1561c9 165ec8 185bc7 1958c5 1a55c4 1c51c3 1d4ec1 1e4bc0 " +
  "1f48be 2145bd 2242bc 233eba 253bb9 2638b8 2735b6 2831b5 292fb4"
).split(" ");

export type FlyerQr = { size: number; isDark: (row: number, column: number) => boolean };

export function flyerFilename(code: CheckpointCode): string {
  return `${code}.png`;
}

/** QR matrix for a checkpoint's permanent production URL. */
export function checkpointFlyerQr(code: CheckpointCode): FlyerQr {
  // Like the admin QR download, flyers always encode the canonical production
  // URL so a preview deploy can never produce a flyer that needs reprinting.
  const url = checkpointPermanentUrl(code);
  const qr = QRCode.create([{ data: new TextEncoder().encode(url), mode: "byte" }], {
    version: QR_VERSION,
    errorCorrectionLevel: "H",
  });
  if (qr.modules.size !== QR_MODULES) {
    throw new Error(`${code} produced an unexpected QR size.`);
  }
  return {
    size: qr.modules.size,
    isDark: (row, column) => Boolean(qr.modules.get(row, column)),
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

function inFinder(row: number, column: number): boolean {
  const last = QR_MODULES - 7;
  return (row < 7 && column < 7) || (row < 7 && column >= last) || (row >= last && column < 7);
}

function drawFinder(context: CanvasRenderingContext2D, row: number, column: number, colour: string) {
  const pitch = QR_BOX.size / QR_MODULES;
  const centreX = QR_BOX.x + (column + 3.5) * pitch;
  const centreY = QR_BOX.y + (row + 3.5) * pitch;
  const hole = FINDER.outer - 2 * FINDER.ring;
  context.fillStyle = colour;
  context.beginPath();
  roundedRect(context, centreX - FINDER.outer / 2, centreY - FINDER.outer / 2, FINDER.outer, FINDER.outer, FINDER.outerRadius);
  roundedRect(context, centreX - hole / 2, centreY - hole / 2, hole, hole, FINDER.holeRadius);
  context.fill("evenodd");
  context.beginPath();
  roundedRect(context, centreX - FINDER.centre / 2, centreY - FINDER.centre / 2, FINDER.centre, FINDER.centre, FINDER.centreRadius);
  context.fill();
}

function drawQr(context: CanvasRenderingContext2D, qr: FlyerQr) {
  const pitch = QR_BOX.size / QR_MODULES;
  const inset = (pitch - MODULE.size) / 2;

  context.fillStyle = "#ffffff";
  context.fillRect(QR_CLEAR.x, QR_CLEAR.y, QR_CLEAR.width, QR_CLEAR.height);

  const middle = QR_BOX.size / 2;
  const reach = ((MODULE_GRADIENT.length - 1) / 4) * pitch;
  const gradient = context.createLinearGradient(
    QR_BOX.x + middle - reach,
    QR_BOX.y + middle + reach,
    QR_BOX.x + middle + reach,
    QR_BOX.y + middle - reach,
  );
  MODULE_GRADIENT.forEach((colour, index) => {
    gradient.addColorStop(index / (MODULE_GRADIENT.length - 1), `#${colour}`);
  });

  context.fillStyle = gradient;
  context.beginPath();
  for (let row = 0; row < QR_MODULES; row += 1) {
    for (let column = 0; column < QR_MODULES; column += 1) {
      if (inFinder(row, column) || !qr.isDark(row, column)) continue;
      roundedRect(
        context,
        QR_BOX.x + column * pitch + inset,
        QR_BOX.y + row * pitch + inset,
        MODULE.size,
        MODULE.size,
        MODULE.radius,
      );
    }
  }
  context.fill();

  drawFinder(context, 0, 0, FINDER_COLOURS.topLeft);
  drawFinder(context, 0, QR_MODULES - 7, FINDER_COLOURS.topRight);
  drawFinder(context, QR_MODULES - 7, 0, FINDER_COLOURS.bottomLeft);
}

/**
 * Draws the flyer onto `canvas`. A null `code` shows the untouched artwork.
 * At scale 1 every pixel outside the QR square is identical to the template.
 */
export function drawCheckpointFlyer(
  canvas: HTMLCanvasElement,
  template: CanvasImageSource,
  code: CheckpointCode | null,
  scale: FlyerScale,
) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot draw the flyer.");
  canvas.width = FLYER_TEMPLATE.width * scale;
  canvas.height = FLYER_TEMPLATE.height * scale;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.imageSmoothingEnabled = scale !== 1;
  context.imageSmoothingQuality = "high";
  context.drawImage(template, 0, 0, canvas.width, canvas.height);
  if (!code) return;
  context.setTransform(scale, 0, 0, scale, 0, 0);
  drawQr(context, checkpointFlyerQr(code));
  context.setTransform(1, 0, 0, 1, 0, 0);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Adds a pHYs chunk so the PNG keeps the flyer's US Letter print size at any
 * export scale. Canvas-encoded PNGs carry no physical size of their own.
 */
export function pngWithFlyerPrintSize(png: Uint8Array, scale: FlyerScale): Uint8Array {
  const ihdrEnd = 33;
  if (String.fromCharCode(...png.subarray(ihdrEnd + 4, ihdrEnd + 8)) === "pHYs") return png;
  const chunk = new Uint8Array(21);
  const view = new DataView(chunk.buffer);
  const pixelsPerMetre = Math.round(FLYER_TEMPLATE.pixelsPerMetre * scale);
  view.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  view.setUint32(8, pixelsPerMetre);
  view.setUint32(12, pixelsPerMetre);
  chunk[16] = 1; // unit: metre
  view.setUint32(17, crc32(chunk.subarray(4, 17)));
  const output = new Uint8Array(png.length + chunk.length);
  output.set(png.subarray(0, ihdrEnd), 0);
  output.set(chunk, ihdrEnd);
  output.set(png.subarray(ihdrEnd), ihdrEnd + chunk.length);
  return output;
}

export type FlyerFile = { code: CheckpointCode; png: Uint8Array };

/** One ZIP with a PNG per checkpoint. PNG data is already compressed, so entries are stored. */
export function zipCheckpointFlyers(files: readonly FlyerFile[]): Uint8Array {
  return zipSync(
    Object.fromEntries(files.map((file) => [flyerFilename(file.code), file.png])),
    { level: 0 },
  );
}

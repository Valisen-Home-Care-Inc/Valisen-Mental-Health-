import { crc32 } from "node:zlib";
import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { CHECKPOINT_CODES } from "@/lib/checkpoints/config";
import {
  checkpointFlyerQr,
  flyerFilename,
  pngWithFlyerPrintSize,
  zipCheckpointFlyers,
} from "@/lib/checkpoints/flyer";

function matrixKey(code: (typeof CHECKPOINT_CODES)[number]): string {
  const qr = checkpointFlyerQr(code);
  let key = "";
  for (let row = 0; row < qr.size; row += 1) {
    for (let column = 0; column < qr.size; column += 1) key += qr.isDark(row, column) ? "1" : "0";
  }
  return key;
}

// Smallest structurally valid PNG prefix: signature + IHDR, followed by IEND.
function minimalPng(): Uint8Array {
  const png = new Uint8Array(8 + 25 + 12);
  png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  png.set([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 8);
  png.set([0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82], 33);
  return png;
}

describe("Mental Battery flyer QR codes", () => {
  it("keeps every checkpoint on the artwork's 37-module, level H symbol", () => {
    for (const code of CHECKPOINT_CODES) {
      const qr = checkpointFlyerQr(code);
      expect(qr.size).toBe(37);
      // Finder corners and the timing pattern are fixed in every QR symbol.
      expect(qr.isDark(0, 0)).toBe(true);
      expect(qr.isDark(0, 36)).toBe(true);
      expect(qr.isDark(36, 0)).toBe(true);
      expect(qr.isDark(6, 8)).toBe(true);
      expect(qr.isDark(6, 9)).toBe(false);
    }
  });

  it("gives every checkpoint a different QR code", () => {
    const keys = CHECKPOINT_CODES.map(matrixKey);
    expect(new Set(keys).size).toBe(CHECKPOINT_CODES.length);
  });
});

describe("Mental Battery flyer files", () => {
  it("stamps the US Letter print size after IHDR for each export scale", () => {
    for (const [scale, pixelsPerMetre] of [[1, 7165], [2, 14330]] as const) {
      const png = pngWithFlyerPrintSize(minimalPng(), scale);
      const view = new DataView(png.buffer);
      expect(png.length).toBe(minimalPng().length + 21);
      expect(view.getUint32(33)).toBe(9);
      expect(String.fromCharCode(...png.subarray(37, 41))).toBe("pHYs");
      expect(view.getUint32(41)).toBe(pixelsPerMetre);
      expect(view.getUint32(45)).toBe(pixelsPerMetre);
      expect(png[49]).toBe(1);
      expect(view.getUint32(50)).toBe(crc32(png.subarray(37, 50)));
      expect(String.fromCharCode(...png.subarray(58, 62))).toBe("IEND");
      expect(pngWithFlyerPrintSize(png, scale)).toBe(png);
    }
  });

  it("names every flyer after its checkpoint inside one ZIP", () => {
    const files = CHECKPOINT_CODES.map((code, index) => ({ code, png: new Uint8Array([index, 1, 2]) }));
    const unzipped = unzipSync(zipCheckpointFlyers(files));
    expect(Object.keys(unzipped)).toEqual(CHECKPOINT_CODES.map((code) => `${code}.png`));
    expect(flyerFilename("VMH-07")).toBe("VMH-07.png");
    expect(Array.from(unzipped["VMH-25.png"])).toEqual([24, 1, 2]);
  });
});

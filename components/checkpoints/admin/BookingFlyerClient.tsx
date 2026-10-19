"use client";

import { Download, FileArchive, LoaderCircle, QrCode } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BOOKING_LINKS, findBookingLink, type BookingLink } from "@/lib/bookingLinks";
import {
  BOOKING_FLYER_TEMPLATE,
  BOOKING_FLYER_TEMPLATE_SRC,
  BOOKING_FLYER_ZIP_FILENAME,
  bookingFlyerFilename,
  bookingFlyerUrl,
  bookingQrFilename,
  bookingQrSvg,
  drawBookingFlyer,
  zipBookingFlyers,
  type BookingFlyerFile,
} from "@/lib/bookingFlyer";
import { pngWithFlyerPrintSize, type FlyerScale } from "@/lib/checkpoints/flyer";

type Busy = "loading" | "single" | "all" | null;

function canvasToPng(canvas: HTMLCanvasElement, scale: FlyerScale): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("The browser could not create the PNG."));
        return;
      }
      blob.arrayBuffer().then(
        (buffer) =>
          resolve(pngWithFlyerPrintSize(new Uint8Array(buffer), scale, BOOKING_FLYER_TEMPLATE.pixelsPerMetre)),
        reject,
      );
    }, "image/png");
  });
}

function saveFile(bytes: Uint8Array | string, type: string, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export default function BookingFlyerClient() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const templateRef = useRef<HTMLImageElement | null>(null);
  const [area, setArea] = useState<BookingLink>(BOOKING_LINKS[0]);
  const [scale, setScale] = useState<FlyerScale>(2);
  const [busy, setBusy] = useState<Busy>("loading");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function report(caught: unknown) {
    setMessage("");
    setError(caught instanceof Error ? caught.message : "The flyer could not be generated.");
  }

  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      templateRef.current = image;
      try {
        if (canvasRef.current) drawBookingFlyer(canvasRef.current, image, BOOKING_LINKS[0], 2);
      } catch (caught) { report(caught); }
      setBusy(null);
    };
    image.onerror = () => {
      if (cancelled) return;
      setError("The flyer artwork could not be loaded. Refresh the page to try again.");
    };
    image.src = BOOKING_FLYER_TEMPLATE_SRC;
    return () => { cancelled = true; };
  }, []);

  function redraw(nextArea: BookingLink, nextScale: FlyerScale) {
    if (!canvasRef.current || !templateRef.current) return;
    try {
      drawBookingFlyer(canvasRef.current, templateRef.current, nextArea, nextScale);
    } catch (caught) { report(caught); }
  }

  function changeArea(code: string) {
    const next = findBookingLink(code);
    if (!next) return;
    setArea(next); setError(""); setMessage("");
    redraw(next, scale);
  }

  function changeScale(nextScale: FlyerScale) {
    setScale(nextScale);
    redraw(area, nextScale);
  }

  async function downloadFlyer() {
    if (busy || !canvasRef.current) return;
    setBusy("single"); setError("");
    try {
      saveFile(await canvasToPng(canvasRef.current, scale), "image/png", bookingFlyerFilename(area));
      setMessage(`${bookingFlyerFilename(area)} downloaded.`);
    } catch (caught) { report(caught); }
    finally { setBusy(null); }
  }

  function downloadQr() {
    if (busy) return;
    setError("");
    try {
      saveFile(bookingQrSvg(area), "image/svg+xml", bookingQrFilename(area));
      setMessage(`${bookingQrFilename(area)} downloaded.`);
    } catch (caught) { report(caught); }
  }

  async function downloadAll() {
    if (busy || !templateRef.current) return;
    setBusy("all"); setError(""); setMessage(""); setProgress(0);
    try {
      const work = document.createElement("canvas");
      const files: BookingFlyerFile[] = [];
      for (const link of BOOKING_LINKS) {
        drawBookingFlyer(work, templateRef.current, link, scale);
        files.push({ link, png: await canvasToPng(work, scale) });
        setProgress(files.length);
      }
      saveFile(zipBookingFlyers(files), "application/zip", BOOKING_FLYER_ZIP_FILENAME);
      setMessage(`All ${files.length} area flyers downloaded as one ZIP.`);
    } catch (caught) { report(caught); }
    finally { setBusy(null); }
  }

  const fieldClass = "mt-1.5 min-h-11 w-full rounded-[11px] border border-black/[0.1] bg-white px-3 text-[13px] text-[#192725] shadow-sm disabled:opacity-60";
  const labelClass = "text-[11px] font-semibold text-[#586562]";
  const url = bookingFlyerUrl(area);

  return (
    <main className="mx-auto w-full max-w-[1680px] px-4 py-7 sm:px-7 lg:px-10 lg:py-10">
      <div>
        <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[1.5px] text-[#497a73]">
          <span className="h-px w-5 bg-[#79a89d]" />
          Print materials
        </div>
        <h1 className="text-[31px] font-semibold tracking-[-1.25px] text-[#192725] sm:text-[38px]">
          Booking flyers
        </h1>
        <p className="mt-2 max-w-[660px] text-[13px] leading-5 text-[#667471]">
          The &ldquo;Need Support? Talk to a Therapist&rdquo; flyer with a QR code for one flyer area. A scan is counted
          under that area in the Booking tab, then opens the Jane booking page.
        </p>
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
        <section className="rounded-[16px] border border-black/[0.07] bg-white p-5 shadow-sm">
          <label htmlFor="booking-flyer-area" className={labelClass}>Flyer area</label>
          <select
            id="booking-flyer-area"
            value={area.code}
            disabled={busy === "loading" || busy === "all"}
            onChange={(event) => changeArea(event.target.value)}
            className={fieldClass}
          >
            {BOOKING_LINKS.map((link) => (
              <option key={link.code} value={link.code}>{link.label} (/booking/{link.code})</option>
            ))}
          </select>
          <p className="mt-2 break-all rounded-[9px] bg-[#f4f6f4] px-3 py-2 font-mono text-[11.5px] text-[#40504d]">{url}</p>

          <button type="button" onClick={() => void downloadFlyer()} disabled={Boolean(busy)}
            className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[12px] bg-[#1e5f5a] px-5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-[#174d48] disabled:opacity-60">
            {busy === "single" ? <LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> : <Download size={17} aria-hidden="true" />}
            Download {area.label} flyer (PNG)
          </button>
          <button type="button" onClick={downloadQr} disabled={Boolean(busy)}
            className="mt-2 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[12px] border border-black/[0.1] bg-white px-5 text-[13px] font-semibold text-[#1f625c] shadow-sm transition hover:border-black/20 disabled:opacity-50">
            <QrCode size={17} aria-hidden="true" />
            Download QR code only (SVG)
          </button>
          <p className="mt-2 text-[11px] leading-5 text-[#667471]">The QR-only file is for stickers, cards or other designs.</p>

          <div className="mt-5 border-t border-black/[0.07] pt-5">
            <label htmlFor="booking-flyer-scale" className={labelClass}>Export size</label>
            <select
              id="booking-flyer-scale"
              value={scale}
              disabled={Boolean(busy)}
              onChange={(event) => changeScale(event.target.value === "1" ? 1 : 2)}
              className={fieldClass}
            >
              <option value={2}>Print — {BOOKING_FLYER_TEMPLATE.width * 2} × {BOOKING_FLYER_TEMPLATE.height * 2} px (2×)</option>
              <option value={1}>Original — {BOOKING_FLYER_TEMPLATE.width} × {BOOKING_FLYER_TEMPLATE.height} px</option>
            </select>
            <p className="mt-2 text-[11px] leading-5 text-[#667471]">
              Both print at US Letter size. The QR code is drawn sharp at either size; the artwork itself is low
              resolution, so the 2× export looks best.
            </p>
          </div>

          <div className="mt-5 border-t border-black/[0.07] pt-5">
            <p className={labelClass}>All {BOOKING_LINKS.length} areas</p>
            <button type="button" onClick={() => void downloadAll()} disabled={Boolean(busy)}
              className="mt-1.5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[12px] bg-[#153f3e] px-5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-[#0f302f] disabled:opacity-60">
              {busy === "all" ? <LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> : <FileArchive size={17} aria-hidden="true" />}
              {busy === "all" ? `Generating ${Math.min(progress + 1, BOOKING_LINKS.length)} of ${BOOKING_LINKS.length}…` : "Download all areas (ZIP)"}
            </button>
            {busy === "all" ? <progress max={BOOKING_LINKS.length} value={progress} className="mt-3 h-2 w-full accent-[#1e5f5a]" /> : null}
            <p className="mt-2 text-[11px] leading-5 text-[#667471]">One flyer per area, each named after its area.</p>
          </div>

          <p className="mt-5 rounded-[10px] bg-[#f4f6f4] px-3 py-2.5 text-[11px] leading-5 text-[#4d5a58]">
            Before printing a batch, scan one test print with a phone and check that it opens Jane. New areas are added
            in <span className="font-mono">lib/bookingLinks.ts</span>.
          </p>

          {error ? <p role="alert" className="mt-4 text-[12px] font-semibold leading-5 text-[#a3261c]">{error}</p> : null}
          {message && !error ? <p role="status" className="mt-4 text-[12px] leading-5 text-[#395e52]">{message}</p> : null}
        </section>

        <section className="flex flex-col items-center gap-3">
          <canvas
            ref={canvasRef}
            width={BOOKING_FLYER_TEMPLATE.width}
            height={BOOKING_FLYER_TEMPLATE.height}
            aria-label={`Booking flyer for ${area.label}`}
            className="h-auto w-full max-w-[620px] rounded-[8px] bg-white shadow-[0_12px_40px_rgba(21,63,62,0.18)]"
          />
          <p className="text-center text-[12px] leading-5 text-[#667471]">
            {busy === "loading" && !error
              ? "Loading flyer artwork…"
              : <>Showing <strong className="text-[#192725]">{area.label}</strong> — QR opens {url}</>}
          </p>
        </section>
      </div>
    </main>
  );
}

"use client";

import { Download, FileArchive, LoaderCircle, QrCode } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  CHECKPOINT_CODES,
  checkpointPermanentUrl,
  isCheckpointCode,
  type CheckpointCode,
} from "@/lib/checkpoints/config";
import {
  FLYER_TEMPLATE,
  FLYER_TEMPLATE_SRC,
  FLYER_ZIP_FILENAME,
  drawCheckpointFlyer,
  flyerFilename,
  pngWithFlyerPrintSize,
  zipCheckpointFlyers,
  type FlyerFile,
  type FlyerScale,
} from "@/lib/checkpoints/flyer";

type Busy = "loading" | "single" | "all" | null;

function canvasToPng(canvas: HTMLCanvasElement, scale: FlyerScale): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("The browser could not create the PNG."));
        return;
      }
      blob.arrayBuffer().then(
        (buffer) => resolve(pngWithFlyerPrintSize(new Uint8Array(buffer), scale)),
        reject,
      );
    }, "image/png");
  });
}

function saveFile(bytes: Uint8Array, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const link = document.createElement("a"); link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export default function FlyerGeneratorClient() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const templateRef = useRef<HTMLImageElement | null>(null);
  const [selected, setSelected] = useState<CheckpointCode>(CHECKPOINT_CODES[0]);
  const [shown, setShown] = useState<CheckpointCode | null>(null);
  const [scale, setScale] = useState<FlyerScale>(2);
  const [busy, setBusy] = useState<Busy>("loading");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      templateRef.current = image;
      if (canvasRef.current) drawCheckpointFlyer(canvasRef.current, image, null, 2);
      setBusy(null);
    };
    image.onerror = () => {
      if (cancelled) return;
      setError("The flyer artwork could not be loaded. Refresh the page to try again.");
    };
    image.src = FLYER_TEMPLATE_SRC;
    return () => { cancelled = true; };
  }, []);

  function redraw(code: CheckpointCode | null, nextScale: FlyerScale) {
    if (!canvasRef.current || !templateRef.current) return;
    drawCheckpointFlyer(canvasRef.current, templateRef.current, code, nextScale);
  }

  function report(caught: unknown) {
    setMessage("");
    setError(caught instanceof Error ? caught.message : "The flyer could not be generated.");
  }

  function generate() {
    if (busy) return;
    setError("");
    try {
      redraw(selected, scale);
      setShown(selected);
      setMessage(`${selected} generated.`);
    } catch (caught) { report(caught); }
  }

  function changeScale(nextScale: FlyerScale) {
    setScale(nextScale);
    try { redraw(shown, nextScale); } catch (caught) { report(caught); }
  }

  async function downloadShown() {
    if (busy || !shown || !canvasRef.current) return;
    setBusy("single"); setError("");
    try {
      saveFile(await canvasToPng(canvasRef.current, scale), "image/png", flyerFilename(shown));
      setMessage(`${flyerFilename(shown)} downloaded.`);
    } catch (caught) { report(caught); }
    finally { setBusy(null); }
  }

  async function downloadAll() {
    if (busy || !templateRef.current) return;
    setBusy("all"); setError(""); setMessage(""); setProgress(0);
    try {
      const work = document.createElement("canvas");
      const files: FlyerFile[] = [];
      for (const code of CHECKPOINT_CODES) {
        drawCheckpointFlyer(work, templateRef.current, code, scale);
        files.push({ code, png: await canvasToPng(work, scale) });
        setProgress(files.length);
      }
      saveFile(zipCheckpointFlyers(files), "application/zip", FLYER_ZIP_FILENAME);
      setMessage(`All ${files.length} flyers downloaded as one ZIP.`);
    } catch (caught) { report(caught); }
    finally { setBusy(null); }
  }

  const fieldClass = "mt-1.5 min-h-11 w-full rounded-[11px] border border-black/[0.1] bg-white px-3 text-[13px] text-[#192725] shadow-sm disabled:opacity-60";
  const labelClass = "text-[11px] font-semibold text-[#586562]";

  return (
    <main className="mx-auto w-full max-w-[1680px] px-4 py-7 sm:px-7 lg:px-10 lg:py-10">
      <div>
        <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[1.5px] text-[#497a73]">
          <span className="h-px w-5 bg-[#79a89d]" />
          Print materials
        </div>
        <h1 className="text-[31px] font-semibold tracking-[-1.25px] text-[#192725] sm:text-[38px]">
          Mental Battery flyers
        </h1>
        <p className="mt-2 max-w-[660px] text-[13px] leading-5 text-[#667471]">
          Put any checkpoint&apos;s permanent QR code on the Mental Battery flyer. Only the QR code changes; the rest of the artwork stays exactly as designed.
        </p>
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
        <section className="rounded-[16px] border border-black/[0.07] bg-white p-5 shadow-sm">
          <label className={labelClass}>
            Checkpoint
            <select
              value={selected}
              disabled={Boolean(busy)}
              onChange={(event) => { if (isCheckpointCode(event.target.value)) setSelected(event.target.value); }}
              className={fieldClass}
            >
              {CHECKPOINT_CODES.map((code) => <option key={code} value={code}>{code}</option>)}
            </select>
          </label>
          <p className="mt-2 break-all rounded-[9px] bg-[#f4f6f4] px-3 py-2 font-mono text-[11.5px] text-[#40504d]">
            {checkpointPermanentUrl(selected)}
          </p>
          <button type="button" onClick={generate} disabled={Boolean(busy)}
            className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[12px] bg-[#1e5f5a] px-5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-[#174d48] disabled:opacity-60">
            <QrCode size={17} aria-hidden="true" />Generate QR Code
          </button>
          <button type="button" onClick={() => void downloadShown()} disabled={Boolean(busy) || !shown}
            className="mt-2 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[12px] border border-black/[0.1] bg-white px-5 text-[13px] font-semibold text-[#1f625c] shadow-sm transition hover:border-black/20 disabled:opacity-50">
            {busy === "single" ? <LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> : <Download size={17} aria-hidden="true" />}
            {shown ? `Download ${flyerFilename(shown)}` : "Download PNG"}
          </button>

          <div className="mt-5 border-t border-black/[0.07] pt-5">
            <label className={labelClass}>
              Export size
              <select
                value={scale}
                disabled={Boolean(busy)}
                onChange={(event) => changeScale(event.target.value === "1" ? 1 : 2)}
                className={fieldClass}
              >
                <option value={2}>Print — {FLYER_TEMPLATE.width * 2} × {FLYER_TEMPLATE.height * 2} px (2×)</option>
                <option value={1}>Original — {FLYER_TEMPLATE.width} × {FLYER_TEMPLATE.height} px</option>
              </select>
            </label>
            <p className="mt-2 text-[11px] leading-5 text-[#667471]">Both print at US Letter size. The QR code is redrawn sharp at either size.</p>
          </div>

          <div className="mt-5 border-t border-black/[0.07] pt-5">
            <p className={labelClass}>All {CHECKPOINT_CODES.length} checkpoints</p>
            <button type="button" onClick={() => void downloadAll()} disabled={Boolean(busy)}
              className="mt-1.5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[12px] bg-[#153f3e] px-5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-[#0f302f] disabled:opacity-60">
              {busy === "all" ? <LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> : <FileArchive size={17} aria-hidden="true" />}
              {busy === "all" ? `Generating ${Math.min(progress + 1, CHECKPOINT_CODES.length)} of ${CHECKPOINT_CODES.length}…` : "Generate All (ZIP)"}
            </button>
            {busy === "all" ? <progress max={CHECKPOINT_CODES.length} value={progress} className="mt-3 h-2 w-full accent-[#1e5f5a]" /> : null}
            <p className="mt-2 text-[11px] leading-5 text-[#667471]">One ZIP containing {flyerFilename(CHECKPOINT_CODES[0])} through {flyerFilename(CHECKPOINT_CODES[CHECKPOINT_CODES.length - 1])}.</p>
          </div>

          {error ? <p role="alert" className="mt-4 text-[12px] font-semibold leading-5 text-[#a3261c]">{error}</p> : null}
          {message && !error ? <p role="status" className="mt-4 text-[12px] leading-5 text-[#395e52]">{message}</p> : null}
        </section>

        <section className="flex flex-col items-center gap-3">
          <canvas
            ref={canvasRef}
            width={FLYER_TEMPLATE.width}
            height={FLYER_TEMPLATE.height}
            aria-label={shown ? `Mental Battery flyer for ${shown}` : "Original Mental Battery flyer"}
            className="h-auto w-full max-w-[620px] rounded-[8px] bg-white shadow-[0_12px_40px_rgba(21,63,62,0.18)]"
          />
          <p className="text-center text-[12px] leading-5 text-[#667471]">
            {busy === "loading" && !error
              ? "Loading flyer artwork…"
              : shown
                ? <>Showing <strong className="text-[#192725]">{shown}</strong> — QR opens {checkpointPermanentUrl(shown)}</>
                : "Showing the original artwork. Choose a checkpoint and press Generate QR Code."}
          </p>
        </section>
      </div>
    </main>
  );
}

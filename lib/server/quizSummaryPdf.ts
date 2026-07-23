/**
 * Server-side PDF generator for the quiz summary.
 *
 * PRIVACY BY CONSTRUCTION: the input model deliberately has NO fields for
 * name, email, phone, address, IP, device info, or free-text comments —
 * the attachment can never contain contact information because there is
 * nowhere to put it. Identification happens only via the anonymous
 * reference id, which the clinic can cross-reference with the email body.
 */

import fs from "fs";
import path from "path";
import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb } from "pdf-lib";

export type QuizSummaryPdfModel = {
  referenceId: string;
  submittedAtLabel: string;
  quizVersion: string;
  scoringVersion: string;
  contactConsent:
    | {
        status: "not_requested";
      }
    | {
        status: "granted";
        timestampLabel: string;
      };
  /** Check-In Score (higher = steadier). Null when every question was skipped. */
  score: number | null;
  scoreMax: number;
  scoreBand: string;
  /** Qualitative domain snapshot — labels only, no clinical numbers. */
  dimensions: Array<{ label: string; band: string }>;
  suggestedTherapist: { name: string; title: string } | null;
  matchReasons: string[];
};

/**
 * Visible consent metadata used by the PDF. Keeping this transformation
 * separate makes it impossible for an access-stage summary to accidentally
 * inherit the consent-stage "Yes" label or timestamp.
 */
export function getQuizSummaryConsentMetadata(
  contactConsent: QuizSummaryPdfModel["contactConsent"],
): Array<[string, string]> {
  return contactConsent.status === "granted"
    ? [
        ["Consent to be contacted", "Yes"],
        ["Consent timestamp", contactConsent.timestampLabel],
      ]
    : [["Consent to be contacted", "No — not requested"]];
}

const TEAL = rgb(42 / 255, 127 / 255, 127 / 255);
const TEAL_DARK = rgb(30 / 255, 107 / 255, 107 / 255);
const GOLD = rgb(198 / 255, 161 / 255, 91 / 255);
const INK = rgb(44 / 255, 44 / 255, 44 / 255);
const INK_SOFT = rgb(95 / 255, 94 / 255, 90 / 255);
const CANVAS = rgb(247 / 255, 244 / 255, 239 / 255);
const WHITE = rgb(1, 1, 1);

const PAGE_WIDTH = 612; // US Letter
const PAGE_HEIGHT = 792;
const MARGIN = 56;

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function loadLogo(doc: PDFDocument): Promise<PDFImage | null> {
  try {
    const logoPath = path.join(process.cwd(), "public", "valisen-logo.png");
    const bytes = fs.readFileSync(logoPath);
    return await doc.embedPng(bytes);
  } catch {
    // Serverless bundles may omit /public — fall back to the text wordmark.
    return null;
  }
}

export async function buildQuizSummaryPdf(model: QuizSummaryPdfModel): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle("Valisen Mental Health — Quiz Summary");
  doc.setAuthor("Valisen Mental Health");
  doc.setSubject(`Quiz summary ${model.referenceId}`);

  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const sansBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const contentWidth = PAGE_WIDTH - MARGIN * 2;
  let y = PAGE_HEIGHT;

  /* ── Branded header band ── */
  const headerHeight = 96;
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - headerHeight, width: PAGE_WIDTH, height: headerHeight, color: TEAL_DARK });
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - headerHeight - 3, width: PAGE_WIDTH, height: 3, color: GOLD });

  const logo = await loadLogo(doc);
  let textStartX = MARGIN;
  if (logo) {
    const logoSize = 52;
    page.drawImage(logo, {
      x: MARGIN,
      y: PAGE_HEIGHT - headerHeight / 2 - logoSize / 2,
      width: logoSize,
      height: logoSize,
    });
    textStartX = MARGIN + logoSize + 16;
  }
  page.drawText("Valisen Mental Health", {
    x: textStartX,
    y: PAGE_HEIGHT - 44,
    size: 20,
    font: serifBold,
    color: WHITE,
  });
  page.drawText("Quiz Summary", {
    x: textStartX,
    y: PAGE_HEIGHT - 66,
    size: 13,
    font: sans,
    color: rgb(181 / 255, 212 / 255, 212 / 255),
  });

  y = PAGE_HEIGHT - headerHeight - 28;

  /* ── Reference / consent metadata ── */
  const metaRows: Array<[string, string]> = [
    ["Reference ID", model.referenceId],
    ["Submitted", model.submittedAtLabel],
    ["Quiz version", model.quizVersion],
    ["Scoring rules version", model.scoringVersion],
    ...getQuizSummaryConsentMetadata(model.contactConsent),
  ];
  const metaBoxHeight = metaRows.length * 16 + 24;
  page.drawRectangle({
    x: MARGIN,
    y: y - metaBoxHeight,
    width: contentWidth,
    height: metaBoxHeight,
    color: CANVAS,
    borderColor: rgb(0.9, 0.88, 0.84),
    borderWidth: 0.75,
  });
  let metaY = y - 24;
  for (const [label, value] of metaRows) {
    page.drawText(label.toUpperCase(), { x: MARGIN + 16, y: metaY, size: 7.5, font: sansBold, color: INK_SOFT });
    page.drawText(value, { x: MARGIN + 180, y: metaY, size: 9.5, font: sans, color: INK });
    metaY -= 16;
  }
  y -= metaBoxHeight + 30;

  /* ── Score ── */
  page.drawText("Mental Health Check-In Score", { x: MARGIN, y, size: 16, font: serifBold, color: TEAL_DARK });
  y -= 30;
  const scoreLabel = model.score === null ? "Not calculated" : `${model.score} / ${model.scoreMax}`;
  page.drawText(scoreLabel, { x: MARGIN, y: y - 6, size: 30, font: serifBold, color: INK });
  const scoreLabelWidth = serifBold.widthOfTextAtSize(scoreLabel, 30);
  page.drawText(model.scoreBand, { x: MARGIN + scoreLabelWidth + 14, y: y - 1, size: 11.5, font: sansBold, color: TEAL });
  y -= 20;
  page.drawText("Higher scores reflect steadier answers; lower scores reflect more reported strain.", {
    x: MARGIN,
    y,
    size: 9,
    font: sans,
    color: INK_SOFT,
  });
  y -= 28;

  /* ── Domain snapshot ── */
  page.drawText("Where the answers landed", { x: MARGIN, y, size: 13, font: serifBold, color: TEAL_DARK });
  y -= 20;
  for (const dim of model.dimensions) {
    page.drawCircle({ x: MARGIN + 4, y: y + 3, size: 2, color: TEAL });
    page.drawText(dim.label, { x: MARGIN + 14, y, size: 10, font: sansBold, color: INK });
    page.drawText(dim.band, { x: MARGIN + 220, y, size: 10, font: sans, color: INK_SOFT });
    y -= 17;
  }
  y -= 14;

  /* ── Suggested therapist ── */
  page.drawText("Suggested therapist", { x: MARGIN, y, size: 13, font: serifBold, color: TEAL_DARK });
  y -= 19;
  if (model.suggestedTherapist) {
    page.drawText(`${model.suggestedTherapist.name} — ${model.suggestedTherapist.title}`, {
      x: MARGIN,
      y,
      size: 11,
      font: sansBold,
      color: INK,
    });
    y -= 18;
    for (const reason of model.matchReasons) {
      const lines = wrapText(reason, sans, 9.5, contentWidth - 14);
      for (const line of lines) {
        page.drawText(line === lines[0] ? `•  ${line}` : `    ${line}`, {
          x: MARGIN,
          y,
          size: 9.5,
          font: sans,
          color: INK_SOFT,
        });
        y -= 14;
      }
    }
  } else {
    const lines = wrapText(
      "No single clear match was identified from the answers. The Valisen team can help this person choose a therapist.",
      sans,
      9.5,
      contentWidth,
    );
    for (const line of lines) {
      page.drawText(line, { x: MARGIN, y, size: 9.5, font: sans, color: INK_SOFT });
      y -= 14;
    }
  }
  y -= 16;

  /* ── Disclaimer ── */
  drawDisclaimer(page, y, contentWidth, serif, sans);

  return doc.save();
}

function drawDisclaimer(
  page: PDFPage,
  y: number,
  contentWidth: number,
  serif: PDFFont,
  sans: PDFFont,
) {
  const boxTop = Math.min(y, 168);
  const disclaimer =
    "This quiz is a self-reflection tool for general informational purposes. It is not a diagnosis, an assessment, or a substitute for professional evaluation or care. The suggested therapist is generated from the answers provided and verified therapist profile information; it does not replace professional judgment.";
  const lines = wrapText(disclaimer, serif, 9.5, contentWidth - 32);
  const boxHeight = lines.length * 13 + 26;
  page.drawRectangle({
    x: MARGIN,
    y: boxTop - boxHeight,
    width: contentWidth,
    height: boxHeight,
    color: CANVAS,
    borderColor: GOLD,
    borderWidth: 0.75,
  });
  let lineY = boxTop - 20;
  for (const line of lines) {
    page.drawText(line, { x: MARGIN + 16, y: lineY, size: 9.5, font: serif, color: INK });
    lineY -= 13;
  }

  page.drawText(
    "Valisen Mental Health · Virtual psychotherapy across Ontario · valisenmentalhealth.com",
    { x: MARGIN, y: 40, size: 8, font: sans, color: INK_SOFT },
  );
}

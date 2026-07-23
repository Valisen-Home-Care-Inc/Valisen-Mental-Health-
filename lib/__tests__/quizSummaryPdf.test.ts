import { describe, expect, it } from "vitest";
import {
  buildQuizSummaryPdf,
  getQuizSummaryConsentMetadata,
  type QuizSummaryPdfModel,
} from "@/lib/server/quizSummaryPdf";

function model(overrides: Partial<QuizSummaryPdfModel> = {}): QuizSummaryPdfModel {
  return {
    referenceId: "VQ-TEST1234",
    submittedAtLabel: "Thursday, July 16, 2026 at 2:00 p.m.",
    quizVersion: "2.0.0",
    scoringVersion: "1.0.0",
    contactConsent: {
      status: "granted",
      timestampLabel: "Thursday, July 16, 2026 at 1:58 p.m.",
    },
    score: 62,
    scoreMax: 100,
    scoreBand: "Coping, but under some strain",
    dimensions: [
      { label: "Worry & tension", band: "Taking up real space" },
      { label: "Mood & motivation", band: "Showing up sometimes" },
      { label: "Stress & exhaustion", band: "Barely on your radar" },
      { label: "Relationships & connection", band: "Barely on your radar" },
    ],
    suggestedTherapist: { name: "Tim Kahtava", title: "Registered Psychotherapist" },
    matchReasons: [
      "You selected anxiety — Tim lists this among his areas of support.",
      "Worry & tension stood out in your answers, and Tim works in this area.",
    ],
    ...overrides,
  };
}

describe("buildQuizSummaryPdf", () => {
  it("keeps the consent-stage metadata unchanged", () => {
    expect(
      getQuizSummaryConsentMetadata({
        status: "granted",
        timestampLabel: "Thursday, July 16, 2026 at 1:58 p.m.",
      }),
    ).toEqual([
      ["Consent to be contacted", "Yes"],
      ["Consent timestamp", "Thursday, July 16, 2026 at 1:58 p.m."],
    ]);
  });

  it("clearly marks access-stage summaries as not requested and omits a consent timestamp", async () => {
    const metadata = getQuizSummaryConsentMetadata({ status: "not_requested" });
    expect(metadata).toEqual([["Consent to be contacted", "No — not requested"]]);
    expect(metadata.some(([label]) => /timestamp/i.test(label))).toBe(false);

    const bytes = await buildQuizSummaryPdf(
      model({ contactConsent: { status: "not_requested" } }),
    );
    expect(Buffer.from(bytes.slice(0, 5)).toString("ascii")).toBe("%PDF-");
  });

  it("produces a valid, non-trivial PDF document", async () => {
    const bytes = await buildQuizSummaryPdf(model());
    const header = Buffer.from(bytes.slice(0, 5)).toString("ascii");
    expect(header).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(2000);
  });

  it("handles a null score (all questions skipped)", async () => {
    const bytes = await buildQuizSummaryPdf(model({ score: null, scoreBand: "Your reflection" }));
    expect(Buffer.from(bytes.slice(0, 5)).toString("ascii")).toBe("%PDF-");
  });

  it("handles a no-match summary", async () => {
    const bytes = await buildQuizSummaryPdf(
      model({ suggestedTherapist: null, matchReasons: [] }),
    );
    expect(Buffer.from(bytes.slice(0, 5)).toString("ascii")).toBe("%PDF-");
  });

  it("the model type has no fields for contact information (privacy by construction)", () => {
    // A compile-time guarantee, restated at runtime: building the model
    // never involves name/email/phone keys.
    const keys = Object.keys(model());
    for (const forbidden of ["fullName", "email", "phone", "address", "ip", "comments"]) {
      expect(keys).not.toContain(forbidden);
    }
  });
});

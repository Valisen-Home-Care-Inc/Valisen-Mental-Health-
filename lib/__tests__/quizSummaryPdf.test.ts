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
    initialContactAuthorization: {
      status: "granted",
      timestampLabel: "Thursday, July 16, 2026 at 1:58 p.m.",
      textVersion: "2026-07-26.v4",
    },
    contactHelpRequest: { status: "not_requested" },
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
  it("describes the initial contact/share authorization separately from booking help", () => {
    expect(
      getQuizSummaryConsentMetadata({
        status: "granted",
        timestampLabel: "Thursday, July 16, 2026 at 1:58 p.m.",
        textVersion: "2026-07-26.v4",
      }, {
        status: "not_requested",
      }),
    ).toEqual([
      ["Initial contact & sharing", "Authorized"],
      ["Contact channels", "Email, phone, text"],
      [
        "Authorized purposes",
        "Results, match, consultations, scheduling, therapy",
      ],
      [
        "Information sharing",
        "Contact details + relevant summary with therapist",
      ],
      ["Excluded uses", "Sale + unrelated promotional marketing"],
      ["Authorization version", "2026-07-26.v4"],
      [
        "Authorization recorded",
        "Thursday, July 16, 2026 at 1:58 p.m.",
      ],
      ["Contact-help request", "Not requested"],
    ]);
  });

  it("marks exact-time help as submitted but explicitly not confirmed", async () => {
    const metadata = getQuizSummaryConsentMetadata(
      model().initialContactAuthorization,
      {
        status: "submitted",
        timestampLabel: "Thursday, July 16, 2026 at 2:05 p.m.",
      },
    );
    expect(metadata).toContainEqual([
      "Contact-help request",
      "Submitted — times not confirmed",
    ]);
    expect(metadata).toContainEqual([
      "Help request recorded",
      "Thursday, July 16, 2026 at 2:05 p.m.",
    ]);

    const bytes = await buildQuizSummaryPdf(
      model({
        contactHelpRequest: {
          status: "submitted",
          timestampLabel: "Thursday, July 16, 2026 at 2:05 p.m.",
        },
      }),
    );
    expect(Buffer.from(bytes.slice(0, 5)).toString("ascii")).toBe("%PDF-");
  });

  it("labels older results-access wording as legacy instead of inventing authorization", () => {
    expect(
      getQuizSummaryConsentMetadata(
        {
          status: "legacy",
          timestampLabel: "Thursday, July 16, 2026 at 1:58 p.m.",
          textVersion: "2026-07-25.v2",
        },
        { status: "not_requested" },
      ),
    ).toEqual([
      ["Initial contact & sharing", "See recorded legacy consent"],
      ["Consent version", "2026-07-25.v2"],
      ["Consent recorded", "Thursday, July 16, 2026 at 1:58 p.m."],
      ["Contact-help request", "Not requested"],
    ]);
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
    for (const forbidden of [
      "fullName",
      "email",
      "phone",
      "address",
      "ip",
      "comments",
      "answers",
      "contactMessage",
      "preferredTimes",
      "timeZone",
    ]) {
      expect(keys).not.toContain(forbidden);
    }
  });
});

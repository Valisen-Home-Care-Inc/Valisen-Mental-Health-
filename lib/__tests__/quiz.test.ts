import { describe, expect, it } from "vitest";
import {
  QUESTIONS,
  QUIZ_VERSION,
  SCORING_VERSION,
  TOTAL_QUESTIONS,
  bandFor,
  quizIntentForAnswers,
  scoreBandFor,
  scoreQuiz,
} from "@/lib/quiz";

describe("therapist-matching questionnaire", () => {
  it("uses a new major version and exactly 12 approved screens", () => {
    expect(QUIZ_VERSION).toBe("6.0.0");
    expect(SCORING_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(TOTAL_QUESTIONS).toBe(12);
    expect(QUESTIONS.map((question) => question.id)).toEqual([
      "support_type",
      "concerns",
      "primary_concern",
      "therapy_goals",
      "therapy_history",
      "therapist_style",
      "gender_preference",
      "matching_considerations",
      "language",
      "availability",
      "start_timing",
      "payment_readiness",
    ]);
  });

  it("contains no age or residency question", () => {
    const serialized = JSON.stringify(QUESTIONS);
    expect(serialized).not.toMatch(/\b18\b|18\+|years of age|residen(?:cy|t)|eligibility/i);
  });

  it("is matching-focused rather than a symptom or wellness assessment", () => {
    expect(QUESTIONS.some((question) => question.kind === "scored")).toBe(false);
    expect(QUESTIONS.some((question) => question.kind === "safety")).toBe(false);
    expect(QUESTIONS.at(-1)).toMatchObject({
      id: "payment_readiness",
      text: expect.stringContaining("$160–$180"),
    });
    expect(scoreQuiz({ concerns: ["anxiety"] })).toMatchObject({
      score: null,
      answeredCount: 0,
    });
  });

  it("uses the actual roster languages and matching preferences", () => {
    expect(QUESTIONS.find((question) => question.id === "language")?.options.map((option) => option.value)).toEqual([
      "english", "french", "arabic", "mandarin", "no-preference", "other",
    ]);
    expect(QUESTIONS.find((question) => question.id === "gender_preference")?.options.map((option) => option.value)).toEqual([
      "woman", "man", "no-preference", "discuss",
    ]);
  });

  it("caps the focused multi-select questions and makes undecided choices exclusive", () => {
    expect(QUESTIONS.find((question) => question.id === "concerns")).toMatchObject({
      kind: "multi", required: true, maxSelections: 3, exclusiveValues: ["not-sure"],
    });
    expect(QUESTIONS.find((question) => question.id === "therapy_goals")).toMatchObject({
      kind: "multi", required: true, maxSelections: 3,
    });
    expect(QUESTIONS.find((question) => question.id === "therapist_style")).toMatchObject({
      kind: "multi", required: true, maxSelections: 3,
    });
  });

  it("derives the existing private intent category from start timing", () => {
    expect(quizIntentForAnswers({ start_timing: "asap" })).toBe("ready_to_speak");
    expect(quizIntentForAnswers({ start_timing: "within-two-weeks" })).toBe("ready_to_speak");
    expect(quizIntentForAnswers({ start_timing: "this-month" })).toBe("brief_consultation");
    expect(quizIntentForAnswers({ start_timing: "next-few-months" })).toBe("exploring");
    expect(quizIntentForAnswers({ start_timing: "exploring" })).toBe("exploring");
  });

  it("keeps sequential progress reaching 100 percent", () => {
    const lastIndex = QUESTIONS.length - 1;
    expect(Math.round((lastIndex / (QUESTIONS.length - 1)) * 100)).toBe(100);
  });
});

describe("result bands — every band and its boundaries", () => {
  it.each([
    [98, "Generally steady right now"],
    [80, "Generally steady right now"],
    [79, "Coping, but under some strain"],
    [60, "Coping, but under some strain"],
    [59, "Carrying a real load right now"],
    [40, "Carrying a real load right now"],
    [39, "Running low — support could really help"],
    [20, "Running low — support could really help"],
  ])("score %i → %s", (score, label) => {
    expect(scoreBandFor(score)).toBe(label);
  });

  it("handles a null score", () => {
    expect(scoreBandFor(null)).toBe("Not enough answered to calculate a score");
  });

  it.each([
    [null, "Not enough to tell"],
    [0.74, "Barely on your radar"],
    [0.75, "Showing up sometimes"],
    [1.49, "Showing up sometimes"],
    [1.5, "Taking up real space"],
    [2.24, "Taking up real space"],
    [2.25, "Front and centre"],
    [3, "Front and centre"],
  ])("dimension average %s → %s", (average, label) => {
    expect(bandFor(average as number | null).label).toBe(label);
  });
});

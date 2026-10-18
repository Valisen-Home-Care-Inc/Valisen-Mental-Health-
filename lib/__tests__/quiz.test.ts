import { describe, expect, it } from "vitest";
import {
  CHECKIN_SCALE,
  QUESTIONS,
  QUIZ_VERSION,
  SCORE_BANDS,
  SCORE_MAX,
  SCORE_MIN,
  SCORING_VERSION,
  TOTAL_QUESTIONS,
  bandFor,
  quizIntentForAnswers,
  scoreBandDetailsFor,
  scoreBandFor,
  scoreQuiz,
  type Answers,
} from "@/lib/quiz";

const CHECKINS = ["checkin_worry", "checkin_mood", "checkin_sleep", "checkin_coping"] as const;

function checkins(value: number): Answers {
  return Object.fromEntries(CHECKINS.map((id) => [id, value]));
}

describe("version 7 questionnaire", () => {
  it("uses a new major version and exactly 17 approved screens", () => {
    expect(QUIZ_VERSION).toBe("7.0.0");
    expect(SCORING_VERSION).toBe("2.0.0");
    expect(TOTAL_QUESTIONS).toBe(17);
    expect(QUESTIONS.map((question) => question.id)).toEqual([
      "main_concern",
      "duration",
      "impact",
      "checkin_worry",
      "checkin_mood",
      "checkin_sleep",
      "checkin_coping",
      "safety",
      "feel_different",
      "start_reason",
      "tried_so_far",
      "start_timing",
      "support_type",
      "language",
      "therapist_style",
      "payment_readiness",
      "call_time",
    ]);
  });

  it("contains no age, residency, gender-preference or faith question", () => {
    const serialized = JSON.stringify(QUESTIONS);
    expect(serialized).not.toMatch(/\b18\b|18\+|years of age|residen(?:cy|t)|eligibility/i);
    expect(QUESTIONS.some((question) => question.id === "gender_preference")).toBe(false);
    expect(serialized).not.toMatch(/faith|religio/i);
  });

  it("asks four labelled two-week check-in sliders", () => {
    const sliders = QUESTIONS.filter((question) => question.kind === "scored");
    expect(sliders.map((question) => question.id)).toEqual([...CHECKINS]);
    for (const slider of sliders) {
      expect(slider).toMatchObject({ input: "slider", options: CHECKIN_SCALE });
      expect(slider.text).toMatch(/^Over the past two weeks/);
    }
    expect(CHECKIN_SCALE.map((option) => option.value)).toEqual([0, 1, 2, 3, 4]);
    expect(CHECKIN_SCALE.every((option) => option.label.length > 0)).toBe(true);
  });

  it("restores the on-device safety check right after the check-in", () => {
    const safety = QUESTIONS.find((question) => question.kind === "safety");
    expect(QUESTIONS.indexOf(safety!)).toBe(7);
    expect(safety).toMatchObject({ id: "safety", concerningValues: ["sometimes", "often"] });
  });

  it("uses the actual roster languages without an unsupported 'other' choice", () => {
    expect(QUESTIONS.find((question) => question.id === "language")?.options.map((option) => option.value)).toEqual([
      "english", "french", "arabic", "mandarin", "no-preference",
    ]);
  });

  it("caps the multi-select questions and makes undecided choices exclusive", () => {
    expect(QUESTIONS.find((question) => question.id === "feel_different")).toMatchObject({
      kind: "multi", required: true, maxSelections: 2, exclusiveValues: ["not-sure"],
    });
    expect(QUESTIONS.find((question) => question.id === "tried_so_far")).toMatchObject({
      kind: "multi", required: true, exclusiveValues: ["nothing-yet"],
    });
  });

  it("states the session fee in the payment question", () => {
    expect(QUESTIONS.find((question) => question.id === "payment_readiness")?.text).toContain("$160–$180");
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

describe("wellbeing score (1–100, higher = doing better)", () => {
  it("scores the full range from the check-in, duration and impact", () => {
    expect(SCORE_MIN).toBe(1);
    expect(SCORE_MAX).toBe(100);
    expect(scoreQuiz({ ...checkins(0), duration: "a-few-weeks", impact: "a-little" }).score).toBe(100);
    expect(
      scoreQuiz({ ...checkins(4), duration: "as-long-as-i-remember", impact: "hard-to-get-through-the-day" }).score,
    ).toBe(1);
  });

  it("follows the documented formula", () => {
    // 3 + 1 + 3 + 2 = 9 slider points, over a year = 2, noticeably = 1 → 12 of 22.
    const outcome = scoreQuiz({
      checkin_worry: 3,
      checkin_mood: 1,
      checkin_sleep: 3,
      checkin_coping: 2,
      duration: "over-a-year",
      impact: "noticeably",
    });
    expect(outcome.score).toBe(Math.round(100 - (12 / 22) * 99));
    expect(outcome.answeredCount).toBe(4);
    expect(outcome.duration).toBe("over-a-year");
    expect(outcome.impact).toBe("noticeably");
  });

  it("goes down as answers report more strain", () => {
    const lighter = scoreQuiz({ ...checkins(1), duration: "a-few-months", impact: "a-little" }).score!;
    const heavier = scoreQuiz({ ...checkins(3), duration: "a-few-months", impact: "a-little" }).score!;
    expect(heavier).toBeLessThan(lighter);
  });

  it("excludes skipped sliders from both the points and the maximum", () => {
    const answered = scoreQuiz({ checkin_worry: 4, checkin_mood: null, checkin_sleep: null, checkin_coping: null });
    expect(answered.answeredCount).toBe(1);
    expect(answered.score).toBe(1);
  });

  it("returns no score when no check-in question was answered", () => {
    expect(scoreQuiz({ main_concern: "anxiety", duration: "over-a-year", impact: "a-lot" })).toMatchObject({
      score: null,
      answeredCount: 0,
    });
  });

  it("normalizes dimensions to the 0–3 band scale", () => {
    const outcome = scoreQuiz({ ...checkins(4), duration: "a-few-weeks", impact: "a-little" });
    const worry = outcome.scores.find((score) => score.dimension === "worry");
    expect(worry?.average).toBe(3);
    expect(outcome.scores.find((score) => score.dimension === "relationships")?.average).toBeNull();
    expect(scoreQuiz({ ...checkins(0), duration: "a-few-weeks", impact: "a-little" }).resultKey).toBe("mild");
  });
});

describe("score bands — every band and its boundaries", () => {
  it.each([
    [100, "well", "You're doing well overall"],
    [80, "well", "You're doing well overall"],
    [79, "managing", "You're managing, with some strain"],
    [60, "managing", "You're managing, with some strain"],
    [59, "struggling", "You're struggling more than usual"],
    [40, "struggling", "You're struggling more than usual"],
    [39, "hard", "You're having a hard time"],
    [1, "hard", "You're having a hard time"],
  ])("score %i → %s", (score, key, label) => {
    expect(scoreBandDetailsFor(score)?.key).toBe(key);
    expect(scoreBandFor(score)).toBe(label);
  });

  it("covers 1–100 with no gaps or overlaps", () => {
    for (let score = 1; score <= 100; score += 1) {
      expect(SCORE_BANDS.filter((band) => score >= band.min && score <= band.max)).toHaveLength(1);
    }
  });

  it("handles a null score", () => {
    expect(scoreBandDetailsFor(null)).toBeNull();
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

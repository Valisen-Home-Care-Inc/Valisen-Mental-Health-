import { describe, expect, it } from "vitest";
import {
  FREQUENCY_SCALE,
  QUESTIONS,
  QUIZ_VERSION,
  SCORE_BANDS,
  SCORE_MAX,
  SCORE_MIN,
  SCORING_VERSION,
  TOTAL_QUESTIONS,
  bandFor,
  quizAnswerHighlights,
  quizIntentForAnswers,
  scoreBandDetailsFor,
  scoreBandFor,
  scoreQuiz,
  type Answers,
} from "@/lib/quiz";

const CHECKINS = [
  "worry_1", "mood_1", "stress_1", "worry_2", "mood_2", "relationships_1",
  "stress_2", "worry_3", "mood_3", "stress_3", "relationships_2", "sleep",
] as const;

function checkins(value: number): Answers {
  return Object.fromEntries(CHECKINS.map((id) => [id, value]));
}

describe("version 7 questionnaire", () => {
  it("keeps the original 19-screen flow with forward-looking closing questions", () => {
    expect(QUIZ_VERSION).toBe("7.0.0");
    expect(SCORING_VERSION).toBe("2.0.0");
    expect(TOTAL_QUESTIONS).toBe(19);
    expect(QUESTIONS.map((question) => question.id)).toEqual([
      "intro",
      ...CHECKINS,
      "duration",
      "impact",
      "concerns",
      "safety",
      "feel_different",
      "call_time",
    ]);
  });

  it("contains no age, residency, gender-preference, faith or self-sorting next-step question", () => {
    const serialized = JSON.stringify(QUESTIONS);
    expect(serialized).not.toMatch(/\b18\b|18\+|years of age|residen(?:cy|t)|eligibility/i);
    expect(QUESTIONS.some((question) => question.id === "gender_preference")).toBe(false);
    expect(QUESTIONS.some((question) => question.kind === "intent")).toBe(false);
    expect(serialized).not.toMatch(/faith|religio/i);
  });

  it("asks the 12 check-in questions on one two-week frequency scale", () => {
    const checkinQuestions = QUESTIONS.filter((question) => question.kind === "scored");
    expect(checkinQuestions.map((question) => question.id)).toEqual([...CHECKINS]);
    for (const question of checkinQuestions) {
      expect(question).toMatchObject({ helper: "Over the last two weeks…", options: FREQUENCY_SCALE });
    }
    expect(FREQUENCY_SCALE.map((option) => option.value)).toEqual([0, 1, 2, 3, null]);
  });

  it("asks the on-device safety check before the closing questions, with a lead-in", () => {
    const safety = QUESTIONS.find((question) => question.kind === "safety");
    expect(QUESTIONS.indexOf(safety!)).toBe(16);
    expect(safety).toMatchObject({
      id: "safety",
      helper: "One question we ask everyone",
      concerningValues: ["sometimes", "often"],
    });
  });

  it("caps the feelings question at two and makes 'not sure' exclusive", () => {
    expect(QUESTIONS.find((question) => question.id === "feel_different")).toMatchObject({
      kind: "multi", required: true, maxSelections: 2, exclusiveValues: ["not-sure"],
    });
    expect(QUESTIONS.find((question) => question.id === "concerns")).toMatchObject({ kind: "multi" });
    expect(QUESTIONS.find((question) => question.id === "concerns")).not.toHaveProperty("required");
  });

  it("ends by selling the free call and promising results either way", () => {
    const last = QUESTIONS[QUESTIONS.length - 1];
    expect(last.id).toBe("call_time");
    expect(last.helper).toBe("Last one · Your results are next");
    expect(last.text).toContain("free 20-minute call");
    expect("note" in last && last.note).toContain("You'll see your score and matches either way");
    expect(last.options.map((option) => option.value)).toContain("after-results");
  });

  it("never routes anyone to a softer 'just exploring' result", () => {
    expect(quizIntentForAnswers({ call_time: "weekday-evenings" })).toBe("ready_to_speak");
    expect(quizIntentForAnswers({ call_time: "weekends" })).toBe("ready_to_speak");
    expect(quizIntentForAnswers({ call_time: "after-results" })).toBe("see_recommended_therapist");
    expect(quizIntentForAnswers({ intro: "curious" })).toBe("ready_to_speak");
  });

  it("keeps sequential progress reaching 100 percent", () => {
    const lastIndex = QUESTIONS.length - 1;
    expect(Math.round((lastIndex / (QUESTIONS.length - 1)) * 100)).toBe(100);
  });
});

describe("answer highlights for the clinic's new-lead email", () => {
  it("summarizes what helps the first call, in the visitor's own answer wording", () => {
    expect(quizAnswerHighlights({
      intro: "specific",
      ...checkins(2),
      duration: "months",
      impact: "moderate",
      concerns: ["anxiety", "grief"],
      feel_different: ["worry-less", "feel-like-myself"],
      call_time: "weekday-evenings",
    })).toEqual([
      { label: "What brought them here", value: "Something specific has been weighing on me" },
      { label: "Going on for", value: "1 to 6 months" },
      { label: "Effect on daily life", value: "Quite a bit" },
      { label: "Wants support with", value: "Anxiety or worry, Grief or loss" },
      { label: "A month from now, wants to feel", value: "Calmer, with less worry; Like myself again" },
      { label: "Best time for the free call", value: "Weekday evenings" },
    ]);
  });

  it("says when no specific support was chosen and skips unknown or missing answers", () => {
    expect(quizAnswerHighlights({ concerns: [], call_time: "after-results", safety: "often" })).toEqual([
      { label: "Wants support with", value: "Nothing specific chosen" },
      { label: "Best time for the free call", value: "I'll decide after I see my results" },
    ]);
    expect(quizAnswerHighlights({ intro: "made-up" })).toEqual([]);
  });
});

describe("wellbeing score (1–100, higher = doing better)", () => {
  it("scores the full range from the check-in, duration and impact", () => {
    expect(SCORE_MIN).toBe(1);
    expect(SCORE_MAX).toBe(100);
    expect(scoreQuiz({ ...checkins(0), duration: "acute", impact: "none" }).score).toBe(100);
    expect(scoreQuiz({ ...checkins(3), duration: "chronic", impact: "severe" }).score).toBe(1);
  });

  it("follows the documented formula", () => {
    // 12 check-ins at 2 = 24 points, 1 to 6 months = 2, a little = 1 → 27 of 42.
    const outcome = scoreQuiz({ ...checkins(2), duration: "months", impact: "mild" });
    expect(outcome.score).toBe(Math.round(100 - (27 / 42) * 99));
    expect(outcome.answeredCount).toBe(12);
    expect(outcome.duration).toBe("months");
    expect(outcome.impact).toBe("mild");
  });

  it("goes down as answers report more strain", () => {
    const lighter = scoreQuiz({ ...checkins(1), duration: "weeks", impact: "mild" }).score!;
    const heavier = scoreQuiz({ ...checkins(3), duration: "weeks", impact: "mild" }).score!;
    expect(heavier).toBeLessThan(lighter);
  });

  it("excludes 'prefer not to answer' from both the points and the maximum", () => {
    const answers: Answers = { ...checkins(0), worry_1: 3 };
    for (const id of CHECKINS.slice(1)) answers[id] = null;
    const outcome = scoreQuiz(answers);
    expect(outcome.answeredCount).toBe(1);
    expect(outcome.score).toBe(1);
  });

  it("returns no score when no check-in question was answered", () => {
    expect(scoreQuiz({ intro: "curious", duration: "chronic", impact: "severe" })).toMatchObject({
      score: null,
      answeredCount: 0,
    });
  });

  it("keeps dimension averages on the 0–3 band scale", () => {
    const outcome = scoreQuiz({ ...checkins(0), worry_1: 3, worry_2: 3, worry_3: 3, duration: "acute", impact: "none" });
    expect(outcome.scores.find((score) => score.dimension === "worry")?.average).toBe(3);
    expect(outcome.resultKey).toBe("worry");
    expect(scoreQuiz({ ...checkins(0), duration: "acute", impact: "none" }).resultKey).toBe("mild");
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

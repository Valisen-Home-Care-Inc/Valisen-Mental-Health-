import { describe, expect, it } from "vitest";
import {
  QUESTIONS,
  QUIZ_VERSION,
  SCORING_VERSION,
  TOTAL_QUESTIONS,
  SCORE_MAX,
  SCORE_MIN,
  bandFor,
  scoreBandFor,
  scoreQuiz,
  type Answers,
} from "@/lib/quiz";

const scoredIds = QUESTIONS.filter((q) => q.kind === "scored").map((q) => q.id);

function answersWithAllScored(value: number | null): Answers {
  const answers: Answers = {};
  for (const id of scoredIds) answers[id] = value;
  return answers;
}

describe("versioning", () => {
  it("exports version identifiers", () => {
    expect(QUIZ_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(SCORING_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("bumped the quiz version after removing the language question", () => {
    expect(QUIZ_VERSION).toBe("4.0.0");
  });
});

describe("removed language preference", () => {
  it("has no language question or language-preference options", () => {
    expect(QUESTIONS.find((q) => q.id === "language")).toBeUndefined();

    const forbidden = /\blanguage\b|\bEnglish\b|\bMandarin\b|普通话/i;
    for (const question of QUESTIONS) {
      expect(question.text).not.toMatch(forbidden);
      for (const option of question.options) {
        expect(String(option.label)).not.toMatch(forbidden);
        expect(String(option.value)).not.toMatch(forbidden);
      }
    }
  });

  it("keeps the remaining 18 screens contiguous with safety last", () => {
    expect(TOTAL_QUESTIONS).toBe(18);
    expect(TOTAL_QUESTIONS).toBe(QUESTIONS.length);
    expect(QUESTIONS.at(-1)?.kind).toBe("safety");
  });
});

describe("removed questions (age & Ontario residency)", () => {
  it("has no eligibility question", () => {
    expect(QUESTIONS.find((q) => q.id === "eligibility")).toBeUndefined();
  });

  it("no question text or option mentions age (18) or Ontario residency", () => {
    const forbidden = /\b18\b|18\+|years of age|\bOntario\b|residency|reside/i;
    for (const q of QUESTIONS) {
      expect(q.text).not.toMatch(forbidden);
      if ("options" in q) {
        for (const option of q.options) {
          expect(String(option.label)).not.toMatch(forbidden);
        }
      }
    }
  });

  it("can be completed and scored without any eligibility answer", () => {
    const answers = answersWithAllScored(1);
    const outcome = scoreQuiz(answers);
    expect(outcome.score).not.toBeNull();
    expect(outcome.resultKey).toBeTruthy();
  });

  it("keeps question numbering sequential (progress reaches 100%)", () => {
    // Progress in the UI is index / (TOTAL_QUESTIONS - 1); the last index → 100%.
    const lastIndex = QUESTIONS.length - 1;
    expect(Math.round((lastIndex / (QUESTIONS.length - 1)) * 100)).toBe(100);
    // The safety check remains the final screen.
    expect(QUESTIONS[lastIndex].kind).toBe("safety");
  });
});

describe("scoreQuiz — overall score", () => {
  it("gives the maximum score when nothing is bothering the visitor", () => {
    const outcome = scoreQuiz(answersWithAllScored(0));
    expect(outcome.score).toBe(SCORE_MAX);
  });

  it("gives the minimum score at maximum reported strain", () => {
    const outcome = scoreQuiz(answersWithAllScored(3));
    expect(outcome.score).toBe(SCORE_MIN);
  });

  it("returns null when every scored question is skipped", () => {
    const outcome = scoreQuiz(answersWithAllScored(null));
    expect(outcome.score).toBeNull();
    expect(outcome.resultKey).toBe("mild");
  });

  it("higher strain always lowers the score (direction check)", () => {
    const low = scoreQuiz(answersWithAllScored(1));
    const high = scoreQuiz(answersWithAllScored(2));
    expect(low.score).toBeGreaterThan(high.score as number);
  });

  it("is deterministic", () => {
    const answers = answersWithAllScored(2);
    expect(scoreQuiz(answers)).toEqual(scoreQuiz(answers));
  });

  it("ignores non-numeric values on scored questions", () => {
    const answers = answersWithAllScored(0);
    answers[scoredIds[0]] = "3" as unknown as number;
    const outcome = scoreQuiz(answers);
    expect(outcome.score).toBe(SCORE_MAX);
  });
});

describe("scoreQuiz — result key", () => {
  it("picks the dominant dimension", () => {
    const answers = answersWithAllScored(0);
    answers["worry_1"] = 3;
    answers["worry_2"] = 3;
    answers["worry_3"] = 3;
    expect(scoreQuiz(answers).resultKey).toBe("worry");
  });

  it("returns mixed when two dimensions are close and both present", () => {
    const answers = answersWithAllScored(0);
    answers["worry_1"] = 3;
    answers["worry_2"] = 3;
    answers["worry_3"] = 3;
    answers["mood_1"] = 3;
    answers["mood_2"] = 3;
    answers["mood_3"] = 3;
    answers["sleep"] = 3; // sleep feeds the mood average too
    expect(scoreQuiz(answers).resultKey).toBe("mixed");
  });

  it("returns mild when nothing reaches the floor", () => {
    const answers = answersWithAllScored(0);
    expect(scoreQuiz(answers).resultKey).toBe("mild");
  });

  it("keeps context answers out of the score", () => {
    const answers = answersWithAllScored(1);
    const withContext = { ...answers, duration: "chronic", impact: "severe" };
    expect(scoreQuiz(withContext).score).toBe(scoreQuiz(answers).score);
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
    expect(scoreBandFor(null)).toBe("Your reflection");
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

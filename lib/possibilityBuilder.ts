import type { ConcernTag, Therapist } from "@/lib/therapists";
import { getAcceptingTherapists } from "@/lib/therapists";

export type PossibilityExperienceId =
  | "worry"
  | "low-mood"
  | "relationships"
  | "perfectionism"
  | "past-experiences"
  | "major-change"
  | "unsure";

export type PossibilityGoal = {
  id: string;
  label: string;
  reflectionSentence: string;
  concernSignals?: ConcernTag[];
  approachSignal?: "Practical / structured" | "Reflective / exploratory";
};

export type PossibilityExperience = {
  id: PossibilityExperienceId;
  label: string;
  description: string;
  concernTags: ConcernTag[];
  goals: PossibilityGoal[];
  reflectionClosing: string;
};

export const POSSIBILITY_EXPERIENCES: PossibilityExperience[] = [
  {
    id: "worry",
    label: "Worry that follows me everywhere",
    description: "My mind keeps replaying, predicting or preparing.",
    concernTags: ["anxiety", "stress-burnout"],
    goals: [
      {
        id: "present",
        label: "Being present without mentally rehearsing everything",
        reflectionSentence:
          "A thought can still appear without taking all of your attention away from the moment in front of you.",
        approachSignal: "Reflective / exploratory",
      },
      {
        id: "decisions",
        label: "Making decisions with less second-guessing",
        reflectionSentence:
          "You make a decision with the information you have and spend less of the day reopening it.",
        approachSignal: "Practical / structured",
      },
      {
        id: "people",
        label: "Enjoying time with people without getting lost in my thoughts",
        reflectionSentence:
          "There is more attention available for a conversation instead of tracking every possible interpretation.",
        concernSignals: ["relationship-challenges"],
      },
      {
        id: "uncertainty",
        label: "Handling uncertainty without it controlling my day",
        reflectionSentence:
          "Uncertainty remains uncomfortable, but it no longer has to organize the entire day around it.",
        approachSignal: "Practical / structured",
      },
    ],
    reflectionClosing:
      "Therapy may offer a place to understand what keeps worry active and practise responding with more flexibility.",
  },
  {
    id: "low-mood",
    label: "Feeling low, disconnected or unlike myself",
    description:
      "Things feel heavier or harder to care about than they used to.",
    concernTags: ["depression", "stress-burnout"],
    goals: [
      {
        id: "interest",
        label: "Feeling interested and engaged in my life again",
        reflectionSentence:
          "You begin to notice small parts of the day that hold your interest instead of only moving through them.",
        approachSignal: "Practical / structured",
      },
      {
        id: "energy",
        label: "Having more energy for people and activities that matter",
        reflectionSentence:
          "There may be a little more capacity for a conversation, an activity or a plan that matters to you.",
        concernSignals: ["stress-burnout"],
      },
      {
        id: "understanding-weight",
        label: "Understanding what has been weighing on me",
        reflectionSentence:
          "What has felt heavy becomes easier to name and examine with less pressure to solve it all at once.",
        approachSignal: "Reflective / exploratory",
      },
      {
        id: "self-connection",
        label: "Feeling more connected to myself",
        reflectionSentence:
          "Your own preferences and responses feel a little easier to notice and take seriously.",
        approachSignal: "Reflective / exploratory",
      },
    ],
    reflectionClosing:
      "Therapy may help you understand what has been weighing on you and identify manageable ways forward. Progress can be gradual and is not guaranteed.",
  },
  {
    id: "relationships",
    label: "Patterns in dating or relationships",
    description:
      "Connection, trust, communication or boundaries keep feeling difficult.",
    concernTags: ["relationship-challenges", "couples-therapy"],
    goals: [
      {
        id: "relationship-clarity",
        label: "Feeling clearer about what I want from a relationship",
        reflectionSentence:
          "You enter decisions about connection with a clearer sense of what matters to you.",
        approachSignal: "Reflective / exploratory",
      },
      {
        id: "voice",
        label: "Communicating without losing my voice",
        reflectionSentence:
          "You picture entering a conversation knowing what you want to say and trusting yourself enough to say it.",
        concernSignals: ["relationship-challenges"],
      },
      {
        id: "patterns",
        label: "Recognizing unhealthy patterns sooner",
        reflectionSentence:
          "Familiar patterns become easier to notice before they decide the whole direction of a connection.",
        concernSignals: ["relationship-challenges"],
      },
      {
        id: "boundaries",
        label: "Setting boundaries without constant guilt",
        reflectionSentence:
          "A boundary can be expressed without spending the rest of the day deciding whether you were wrong to have one.",
        concernSignals: ["perfectionism-people-pleasing"],
      },
      {
        id: "healthy-connection",
        label: "Feeling more open and prepared for a healthy connection",
        reflectionSentence:
          "You feel more prepared to approach connection without abandoning your needs or ignoring what you notice.",
        approachSignal: "Reflective / exploratory",
      },
      {
        id: "conflict",
        label: "Handling conflict without immediately shutting down or escalating",
        reflectionSentence:
          "A difficult conversation can slow down enough for you to respond instead of immediately shutting down or escalating.",
        concernSignals: ["couples-therapy"],
        approachSignal: "Practical / structured",
      },
    ],
    reflectionClosing:
      "Therapy cannot promise a particular relationship. It can offer a place to understand what keeps repeating, practise different responses and work toward the kind of connection you want to be ready for.",
  },
  {
    id: "perfectionism",
    label: "Constant pressure to get everything right",
    description:
      "Overthinking, perfectionism or people-pleasing is exhausting.",
    concernTags: [
      "perfectionism-people-pleasing",
      "anxiety",
      "self-esteem",
    ],
    goals: [
      {
        id: "act-without-certainty",
        label: "Acting without needing complete certainty",
        reflectionSentence:
          "You complete a choice without needing to examine every possible way it could be wrong.",
        approachSignal: "Practical / structured",
      },
      {
        id: "rest",
        label: "Resting without feeling that I have failed",
        reflectionSentence:
          "Rest can be part of your day without immediately becoming evidence that you should be doing more.",
        concernSignals: ["stress-burnout"],
      },
      {
        id: "say-no",
        label: "Saying no without replaying it for hours",
        reflectionSentence:
          "You say no when you need to and spend less time replaying how another person might receive it.",
        concernSignals: ["relationship-challenges"],
      },
      {
        id: "values",
        label: "Making choices based on what matters to me",
        reflectionSentence:
          "A choice can come from what matters to you, not only from what is most likely to please someone else.",
        approachSignal: "Reflective / exploratory",
      },
      {
        id: "approval",
        label: "Feeling less controlled by other people’s approval",
        reflectionSentence:
          "Other people’s reactions still matter, but they do not have to carry the entire weight of your self-evaluation.",
        concernSignals: ["self-esteem"],
      },
    ],
    reflectionClosing:
      "Therapy may give you space to understand where that pressure comes from and work toward a less exhausting relationship with yourself.",
  },
  {
    id: "past-experiences",
    label: "Past experiences affecting the present",
    description:
      "Something I went through still shapes how I feel or respond.",
    concernTags: ["trauma"],
    goals: [
      {
        id: "grounded-present",
        label: "Feeling more grounded in the present",
        reflectionSentence:
          "You notice what is happening now with a little more room between the present and what came before.",
        approachSignal: "Practical / structured",
      },
      {
        id: "less-judgment",
        label: "Understanding my reactions with less self-judgment",
        reflectionSentence:
          "A strong reaction becomes something you can approach with curiosity instead of immediate self-criticism.",
        approachSignal: "Reflective / exploratory",
      },
      {
        id: "express-needs",
        label: "Feeling safer expressing what I need",
        reflectionSentence:
          "You become more able to name a need without assuming it will automatically create danger or disconnection.",
        concernSignals: ["relationship-challenges"],
      },
      {
        id: "old-patterns",
        label: "Building relationships without old patterns deciding everything",
        reflectionSentence:
          "Old patterns become easier to notice without having to decide every relationship response for you.",
        concernSignals: ["relationship-challenges"],
      },
      {
        id: "response-choice",
        label: "Having more choice in how I respond",
        reflectionSentence:
          "There can be a little more time and choice between what you feel and how you respond.",
        approachSignal: "Practical / structured",
      },
    ],
    reflectionClosing:
      "Therapy may offer a paced place to understand present-day reactions and practise different responses. It does not erase the past or promise a particular outcome.",
  },
  {
    id: "major-change",
    label: "Feeling stuck during a major change",
    description:
      "I’m having trouble finding my footing or knowing what comes next.",
    concernTags: ["life-transitions", "cultural-adjustment"],
    goals: [
      {
        id: "grounded-change",
        label: "Feeling grounded while life is changing",
        reflectionSentence:
          "The situation can still be unsettled while your day has a little more steadiness inside it.",
        approachSignal: "Practical / structured",
      },
      {
        id: "stand-behind",
        label: "Making a decision I can stand behind",
        reflectionSentence:
          "You make a decision that reflects what matters to you without needing certainty about every outcome.",
        approachSignal: "Reflective / exploratory",
      },
      {
        id: "direction",
        label: "Rebuilding a sense of direction",
        reflectionSentence:
          "The next step becomes specific enough to take, even if the full direction is not clear yet.",
        approachSignal: "Practical / structured",
      },
      {
        id: "sense-of-self",
        label: "Adjusting without losing my sense of self",
        reflectionSentence:
          "You make room for change while staying connected to the parts of yourself you want to carry forward.",
        concernSignals: ["cultural-adjustment"],
      },
      {
        id: "less-alone",
        label: "Feeling less alone in figuring out what comes next",
        reflectionSentence:
          "There is a private place to sort through the change instead of carrying every decision by yourself.",
        approachSignal: "Reflective / exploratory",
      },
    ],
    reflectionClosing:
      "Therapy may provide a place to sort through competing needs, understand the impact of change and identify a next step you can evaluate.",
  },
  {
    id: "unsure",
    label: "I’m not sure—I just want something to change",
    description: "I may not have the words for it yet.",
    concernTags: [],
    goals: [
      {
        id: "understand-self",
        label: "Understanding why I have not felt like myself",
        reflectionSentence:
          "What has felt hard to name begins to have language you can examine without rushing to a conclusion.",
        approachSignal: "Reflective / exploratory",
      },
      {
        id: "decision-confidence",
        label: "Feeling more confident in my decisions",
        reflectionSentence:
          "You begin to make choices with a clearer sense of what belongs to you and what deserves more thought.",
        approachSignal: "Practical / structured",
      },
      {
        id: "healthier-relationships",
        label: "Having healthier relationships",
        reflectionSentence:
          "You notice more clearly what supports connection and what leaves you feeling smaller or less like yourself.",
        concernSignals: ["relationship-challenges"],
      },
      {
        id: "emotions",
        label: "Managing difficult emotions more effectively",
        reflectionSentence:
          "A difficult emotion can be noticed and responded to without needing it to disappear immediately.",
        approachSignal: "Practical / structured",
      },
      {
        id: "daily-presence",
        label: "Feeling more present in my day-to-day life",
        reflectionSentence:
          "More of your attention becomes available for the day you are actually living.",
        approachSignal: "Reflective / exploratory",
      },
      {
        id: "private-space",
        label: "Having a private space to sort things out",
        reflectionSentence:
          "There is a confidential place to slow down and sort through what has felt tangled.",
        approachSignal: "Reflective / exploratory",
      },
    ],
    reflectionClosing:
      "Therapy can begin before you have a perfect explanation. A consultation may help you decide whether a particular therapist and approach are worth exploring.",
  },
];

export type PossibilityReflection = {
  heading: string;
  firstParagraph: string;
  secondParagraph: string;
};

export function getPossibilityExperience(
  id: PossibilityExperienceId,
): PossibilityExperience | undefined {
  return POSSIBILITY_EXPERIENCES.find((experience) => experience.id === id);
}

export function getSelectedPossibilityGoals(
  experienceId: PossibilityExperienceId,
  goalIds: string[],
): PossibilityGoal[] {
  const experience = getPossibilityExperience(experienceId);
  if (!experience) return [];
  return goalIds.flatMap((goalId) => {
    const goal = experience.goals.find((item) => item.id === goalId);
    return goal ? [goal] : [];
  });
}

export function buildPossibilityReflection(
  experienceId: PossibilityExperienceId,
  goalIds: string[],
): PossibilityReflection | undefined {
  const experience = getPossibilityExperience(experienceId);
  const goals = getSelectedPossibilityGoals(experienceId, goalIds).slice(0, 2);
  if (!experience || goals.length === 0) return undefined;

  return {
    heading:
      goals.length === 1
        ? `Making a little more room for ${goals[0].label.toLowerCase()}`
        : "A possible direction, grounded in everyday life",
    firstParagraph: goals
      .map((goal) => goal.reflectionSentence)
      .join(" "),
    secondParagraph: experience.reflectionClosing,
  };
}

export type PossibilityRecommendation = {
  therapist: Therapist;
  score: number;
  reasons: string[];
};

function tagLabel(tag: ConcernTag): string {
  const labels: Record<ConcernTag, string> = {
    anxiety: "anxiety",
    depression: "depression and low mood",
    "stress-burnout": "stress and burnout",
    "relationship-challenges": "relationship patterns and communication",
    "couples-therapy": "couples and relationship concerns",
    trauma: "trauma-related concerns",
    adhd: "ADHD",
    "perfectionism-people-pleasing": "perfectionism and people-pleasing",
    "self-esteem": "self-esteem",
    addiction: "addiction-related concerns",
    "cultural-adjustment": "cultural adjustment",
    "life-transitions": "life transitions",
    grief: "grief",
  };
  return labels[tag];
}

export function recommendPossibilityTherapists(
  experienceId: PossibilityExperienceId,
  goalIds: string[],
  roster: Therapist[] = getAcceptingTherapists(),
): PossibilityRecommendation[] {
  const experience = getPossibilityExperience(experienceId);
  const goals = getSelectedPossibilityGoals(experienceId, goalIds);
  if (!experience || goals.length === 0) return [];

  const scored = roster
    .filter(
      (therapist) =>
        therapist.acceptingNewClients && !therapist.comingSoon,
    )
    .map((therapist) => {
      const baseTags = experience.concernTags.filter((tag) =>
        therapist.matching.concernTags.includes(tag),
      );
      const goalConcernTags = goals.flatMap((goal) =>
        (goal.concernSignals ?? []).filter((tag) =>
          therapist.matching.concernTags.includes(tag),
        ),
      );
      let score = baseTags.length > 0 ? 8 + baseTags.length : 0;

      for (const goal of goals) {
        if (
          goal.concernSignals?.some((tag) =>
            therapist.matching.concernTags.includes(tag),
          )
        ) {
          score += 2;
        }
        if (
          goal.approachSignal &&
          therapist.approachStyles.includes(goal.approachSignal)
        ) {
          score += 1;
        }
      }
      if (baseTags.length === 0 && goalConcernTags.length === 0) {
        score = 0;
      }

      const factualTags = Array.from(
        new Set([
          ...baseTags,
          ...goalConcernTags,
        ]),
      ).slice(0, 2);
      const reasons: string[] = [];
      if (factualTags.length > 0) {
        reasons.push(
          `Works with ${factualTags.map(tagLabel).join(" and ")}.`,
        );
      }
      if (therapist.approachStyles.length > 0) {
        reasons.push(
          `Offers a ${therapist.approachStyles[0].toLowerCase()} approach.`,
        );
      } else {
        reasons.push(
          `Provides ${therapist.formats.join(" and ").toLowerCase()} therapy in ${therapist.jurisdictions.join(" and ")}.`,
        );
      }

      return { therapist, score, reasons: reasons.slice(0, 2) };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 2);
}

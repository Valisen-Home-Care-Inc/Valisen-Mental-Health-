import type { ConcernTag, Therapist } from "@/lib/therapists";
import { getAcceptingTherapists } from "@/lib/therapists";

export const FINDER_CONCERNS = [
  {
    id: "anxiety-mood",
    label: "Anxiety, stress or low mood",
    tags: ["anxiety", "stress-burnout", "depression"],
  },
  {
    id: "relationships",
    label: "Relationships or couples concerns",
    tags: ["relationship-challenges", "couples-therapy"],
  },
  {
    id: "adhd-perfectionism",
    label: "ADHD, perfectionism or people-pleasing",
    tags: ["adhd", "perfectionism-people-pleasing"],
  },
  {
    id: "trauma",
    label: "Trauma-related concerns",
    tags: ["trauma"],
  },
  {
    id: "transitions-culture",
    label: "Life transitions or cultural adjustment",
    tags: ["life-transitions", "cultural-adjustment"],
  },
  {
    id: "unsure",
    label: "Something else / I’m not sure",
    tags: [],
  },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  tags: readonly ConcernTag[];
}>;

export type FinderConcernId = (typeof FINDER_CONCERNS)[number]["id"];

export const FINDER_PREFERENCES = [
  { id: "individual", label: "Individual therapy" },
  { id: "couples-family", label: "Couples or family therapy" },
  { id: "arabic", label: "Therapy in Arabic" },
  { id: "mandarin", label: "Therapy in Mandarin" },
  { id: "structured", label: "A practical, structured approach" },
  { id: "exploratory", label: "A reflective, exploratory approach" },
  { id: "no-preference", label: "No preference — help me choose" },
] as const;

export type FinderPreferenceId = (typeof FINDER_PREFERENCES)[number]["id"];

export const FINDER_NEXT_STEPS = [
  { id: "recommendation", label: "Show me a therapist who may fit" },
  { id: "compare", label: "Let me compare my options" },
  { id: "book", label: "I’m ready to book a free consultation" },
  { id: "help", label: "I’d like Valisen to help me decide" },
] as const;

export type FinderNextStepId = (typeof FINDER_NEXT_STEPS)[number]["id"];

export type FinderRecommendation = {
  therapist: Therapist;
  reasons: string[];
  score: number;
};

function concernFor(id: FinderConcernId) {
  return FINDER_CONCERNS.find((concern) => concern.id === id);
}

function scorePreference(
  therapist: Therapist,
  preference: FinderPreferenceId,
): { points: number; reason?: string } {
  if (preference === "no-preference") return { points: 0 };
  if (
    preference === "individual" &&
    therapist.populationsServed.some((population) =>
      population.toLowerCase().includes("individual"),
    )
  ) {
    return { points: 2, reason: "Offers individual therapy." };
  }
  if (
    preference === "couples-family" &&
    therapist.populationsServed.some(
      (population) =>
        population.toLowerCase().includes("couple") ||
        population.toLowerCase().includes("famil"),
    )
  ) {
    return { points: 3, reason: "Works with couples or families." };
  }
  if (
    preference === "arabic" &&
    therapist.languages.includes("Arabic")
  ) {
    return { points: 4, reason: "Offers therapy in Arabic and English." };
  }
  if (
    preference === "mandarin" &&
    therapist.languages.includes("Mandarin")
  ) {
    return { points: 4, reason: "Offers therapy in Mandarin and English." };
  }
  if (
    preference === "structured" &&
    therapist.approachStyles.includes("Practical / structured")
  ) {
    return { points: 2, reason: "Offers a practical, structured approach." };
  }
  if (
    preference === "exploratory" &&
    therapist.approachStyles.includes("Reflective / exploratory")
  ) {
    return { points: 2, reason: "Offers a reflective, exploratory approach." };
  }
  return { points: 0 };
}

export function recommendTherapists(
  concernId: FinderConcernId,
  preferences: FinderPreferenceId[],
  roster: Therapist[] = getAcceptingTherapists(),
): FinderRecommendation[] {
  const concern = concernFor(concernId);
  if (!concern) return [];

  const selectedPreferences = preferences.includes("no-preference")
    ? []
    : preferences;

  const scored = roster
    .filter(
      (therapist) =>
        therapist.acceptingNewClients && !therapist.comingSoon,
    )
    .map((therapist) => {
      const matchedConcernTags = concern.tags.filter((tag) =>
        therapist.matching.concernTags.includes(tag),
      );
      let score = matchedConcernTags.length > 0 ? 5 : 0;
      const reasons: string[] = [];

      if (matchedConcernTags.length > 0) {
        const relevantAreas = therapist.specialties
          .filter((specialty) =>
            matchedConcernTags.some((tag) =>
              specialty
                .toLowerCase()
                .includes(tag.split("-")[0].toLowerCase()),
            ),
          )
          .slice(0, 3);
        reasons.push(
          relevantAreas.length > 0
            ? `Works with ${relevantAreas.join(", ").toLowerCase()}.`
            : `Works with concerns in the area you selected.`,
        );
      }

      for (const preference of selectedPreferences) {
        const result = scorePreference(therapist, preference);
        score += result.points;
        if (result.reason && !reasons.includes(result.reason)) {
          reasons.push(result.reason);
        }
      }

      return { therapist, score, reasons: reasons.slice(0, 2) };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return [];

  const topScore = scored[0].score;
  const focused = scored.filter(({ score }) => score === topScore).slice(0, 2);

  return focused.map((recommendation) => ({
    ...recommendation,
    reasons:
      recommendation.reasons.length > 0
        ? recommendation.reasons
        : ["Currently accepting new clients for a free consultation."],
  }));
}

export function therapistMatchesConcern(
  therapist: Therapist,
  concernId: FinderConcernId,
): boolean {
  const concern = concernFor(concernId);
  if (!concern || concern.tags.length === 0) return true;
  return concern.tags.some((tag) =>
    therapist.matching.concernTags.includes(tag),
  );
}

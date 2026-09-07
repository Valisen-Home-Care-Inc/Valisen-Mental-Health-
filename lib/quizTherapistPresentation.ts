import type { MatchReason, MatchResult } from "@/lib/matching";
import { therapists, type Therapist } from "@/lib/therapists";

export type PresentedTherapistMatch = {
  therapist: Therapist;
  reasons: MatchReason[];
  isPrimary: boolean;
};

/** Display women first without changing the saved match, scores, or reasons. */
export function getPresentedTherapistMatches(
  match: MatchResult,
  roster: Therapist[] = therapists,
): PresentedTherapistMatch[] {
  if (match.status !== "match") return [];
  const entries = [
    { therapistSlug: match.therapistSlug, reasons: match.reasons, isPrimary: true },
    ...(match.alternative ? [{ ...match.alternative, isPrimary: false }] : []),
  ];
  const seen = new Set<string>();
  return entries.flatMap((entry) => {
    const therapist = roster.find((item) => item.slug === entry.therapistSlug);
    if (!therapist || seen.has(therapist.slug)) return [];
    seen.add(therapist.slug);
    return [{ therapist, reasons: entry.reasons, isPrimary: entry.isPrimary }];
  }).sort((a, b) => Number(b.therapist.matching.gender === "woman") - Number(a.therapist.matching.gender === "woman"));
}

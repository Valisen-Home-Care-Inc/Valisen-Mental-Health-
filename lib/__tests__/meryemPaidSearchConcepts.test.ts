import { describe, expect, it } from "vitest";
import { conceptSessionFee, consultationPoolForConcept, getPaidSearchConcept, paidSearchConcepts } from "@/lib/paidSearchConcepts";
import { PAID_SEARCH_CONCEPT_SLUGS } from "@/lib/paidSearchRoutes";
import { eligibleConsultationTherapists, scheduledConsultationMinutes } from "@/lib/consultationSchedules";
import mapping from "@/lib/paidSearchKeywordMap.json";

const slugs = ["muslim-therapy", "female-muslim-therapist", "muslim-marriage"];
describe("Meryem's third ad group", () => {
  it.each(slugs)("uses only Meryem's shared weekly capacity on %s", (slug) => {
    expect(getPaidSearchConcept(slug)?.therapists.map((row) => row.slug)).toEqual(["meryem-ibrahim"]);
    const pool = consultationPoolForConcept(slug)!;
    expect(pool).toEqual(consultationPoolForConcept("arabic"));
    expect(scheduledConsultationMinutes("2026-10-04", pool)).toHaveLength(33);
    expect(scheduledConsultationMinutes("2026-10-06", pool)).toHaveLength(27);
    expect(scheduledConsultationMinutes("2026-10-05", pool)).toEqual([]);
    expect(eligibleConsultationTherapists("2026-10-06", "5:40 PM", pool)).toEqual(["meryem-ibrahim"]);
    expect(eligibleConsultationTherapists("2026-10-06", "6:00 PM", pool)).toEqual([]);
  });
  it("keeps approved routes and concepts aligned and applies couples pricing only to couples pages", () => {
    expect(paidSearchConcepts.map((row) => row.slug).sort()).toEqual([...PAID_SEARCH_CONCEPT_SLUGS].sort());
    expect(conceptSessionFee("muslim-marriage", { fee: 180, duration: 50 })).toEqual({ fee: 200, duration: 50 });
    expect(conceptSessionFee("muslim-therapy", { fee: 180, duration: 50 })).toEqual({ fee: 180, duration: 50 });
  });
  it("maps all 30 supplied exact keywords to their appropriate intent", () => {
    const rows = mapping.filter((row) => row.adGroup === "03 - Muslim & Arabic Therapy");
    const expected = ["arabic speaking therapist ottawa", "arabic therapist", "arabic therapist near me", "arabic therapist online", "female muslim therapist", "find muslim therapist", "hijabi therapist", "islamic counselling near me", "islamic counsellor", "islamic female therapist", "islamic marriage counselling", "islamic therapist", "islamic therapist near me", "marriage counseling for muslims", "marriage counseling muslim", "muslim counselling toronto", "muslim counsellor", "muslim couples counselling", "muslim couples therapist", "muslim female counsellor", "muslim female therapist", "muslim female therapist near me", "muslim marriage counseling", "muslim therapist near me", "muslim therapist online", "muslim therapist ottawa", "muslim therapist toronto", "muslim therapy", "online muslim therapist", "therapist arabic"];
    expect(rows.map((row) => row.keyword).sort()).toEqual(expected.map((keyword) => `[${keyword}]`).sort());
    for (const row of rows) {
      expect(row.matchType).toBe("Exact match");
      const expectedSlug = /couples|marriage/.test(row.keyword) ? "muslim-marriage" : /female|hijabi/.test(row.keyword) ? "female-muslim-therapist" : /arabic/.test(row.keyword) ? "arabic" : "muslim-therapy";
      expect(row.slug).toBe(expectedSlug);
    }
  });
});

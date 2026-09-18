import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { conceptTherapists, consultationPoolForConcept, getPaidSearchConcept } from "@/lib/paidSearchConcepts";
import { getAvailableTimeSlotsForDate, getConsultationCalendarMonth } from "@/lib/paidSearchPreviewCalendar";
import { eligibleConsultationTherapists, therapistShifts } from "@/lib/consultationSchedules";
import { arabicLandingTranslations, mandarinLandingTranslations } from "@/lib/paidSearchLanguageContent";
import { landingTranslator, sharedLandingTranslations } from "@/lib/paidSearchLocale";

describe("clinic weekly schedules", () => {
  it("keeps each page within its own pool, including weekends and partial-hour shifts", () => {
    expect(getAvailableTimeSlotsForDate("2026-09-19", ["tim-kahtava"]).map((s) => s.time)).toEqual(["1:15 PM", "1:35 PM", "1:55 PM"]);
    expect(getAvailableTimeSlotsForDate("2026-09-16", ["tim-kahtava"]).map((s) => s.time)).toEqual(["3:15 PM", "3:35 PM", "3:55 PM"]);
    expect(getAvailableTimeSlotsForDate("2026-09-21", ["tim-kahtava"]).map((s) => s.time)).toEqual(["6:30 PM", "6:50 PM", "7:10 PM"]);
    expect(getAvailableTimeSlotsForDate("2026-09-20", ["meryem-ibrahim"])).toHaveLength(33);
    expect(getAvailableTimeSlotsForDate("2026-09-20", ["dayong-quan"])).toEqual([]);
    expect(getAvailableTimeSlotsForDate("2026-09-18", ["wilfred-bengnwi"])).toHaveLength(12);
    expect(getAvailableTimeSlotsForDate("2026-09-17", ["wilfred-bengnwi"])).toHaveLength(9);
    const calendar = getConsultationCalendarMonth(2026, 8, new Date(2026, 8, 14), ["meryem-ibrahim"]);
    expect(calendar.find((day) => day.date === "2026-09-20")?.selectable).toBe(true);
    expect(calendar.find((day) => day.date === "2026-09-21")?.selectable).toBe(false);
    expect(eligibleConsultationTherapists("2026-09-21", "6:00 PM", consultationPoolForConcept("couples")!)).toEqual(["ryann-simpson", "wilfred-bengnwi"]);
    expect(eligibleConsultationTherapists("2026-09-17", "6:00 PM", consultationPoolForConcept("ocd")!)).toEqual(["ryann-simpson"]);
    expect(therapistShifts("ryann-simpson", 5)).toEqual([]);
  });
  it("features Ryann for equal fits and the confirmed couples/OCD leads, while preserving language qualifications", () => {
    for (const slug of ["anxiety", "social-anxiety", "online-therapy", "free-consultation", "adhd", "perfectionism", "couples", "ocd"]) expect(conceptTherapists(getPaidSearchConcept(slug)!)[0].slug).toBe("ryann-simpson");
    expect(consultationPoolForConcept("couples")).toEqual(["ryann-simpson", "wilfred-bengnwi"]);
    expect(consultationPoolForConcept("mandarin")).toEqual(["dayong-quan"]);
    expect(consultationPoolForConcept("arabic")).toEqual(["meryem-ibrahim"]);
    expect(consultationPoolForConcept("cbt")).not.toContain("ryann-simpson");
    expect(consultationPoolForConcept("ocd")).toEqual(["ryann-simpson", "meryem-ibrahim", "wilfred-bengnwi", "dayong-quan"]);
    expect(consultationPoolForConcept("invalid")).toBeNull();
  });
});

describe("complete language-page copy", () => {
  function strings(value: unknown): string[] {
    if (typeof value === "string") return [value];
    if (Array.isArray(value)) return value.flatMap(strings);
    if (value && typeof value === "object") return Object.values(value).flatMap(strings);
    return [];
  }
  it.each([["arabic", "ar"], ["mandarin", "zh-Hans"]] as const)("translates every visitor-facing concept and qualification on %s", (slug, locale) => {
    const concept = getPaidSearchConcept(slug)!;
    const dictionary = { ...sharedLandingTranslations[locale], ...(slug === "arabic" ? arabicLandingTranslations : mandarinLandingTranslations) };
    const { label, eyebrow, headline, emphasis, introduction, cta, recognitionHeading, recognition, approachHeading, approachIntro, approach, proof, faqs, bookingHeading } = concept;
    const copy = strings({ label, eyebrow, headline, emphasis, introduction, cta, recognitionHeading, recognition, approachHeading, approachIntro, approach, proof, faqs, bookingHeading });
    for (const { therapist, heading, description, reasons } of conceptTherapists(concept)) copy.push(...strings({ heading, description, reasons, role: therapist.credentialSummary, languages: therapist.languages, qualifications: therapist.credentialsList }));
    expect(copy.filter((text) => !dictionary[text])).toEqual([]);
    for (const text of copy) expect(landingTranslator(locale, dictionary)(text)).not.toBe(text);
  });
  it("covers static interface text without silent English fallbacks", () => {
    for (const file of ["ConceptLanding.tsx", "ConceptBooking.tsx", "ConsultationReminder.tsx"]) {
      const tree = ts.createSourceFile(file, readFileSync(`components/paid-search/concepts/${file}`, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const missing: string[] = [];
      function visit(node: ts.Node) {
        if (ts.isCallExpression(node) && node.expression.getText(tree) === "t" && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
          const text = node.arguments[0].text;
          for (const locale of ["ar", "zh-Hans"] as const) if (/[A-Za-z]/.test(text) && !sharedLandingTranslations[locale][text]) missing.push(`${locale}: ${text}`);
        }
        ts.forEachChild(node, visit);
      }
      visit(tree); expect(missing).toEqual([]);
    }
  });
});

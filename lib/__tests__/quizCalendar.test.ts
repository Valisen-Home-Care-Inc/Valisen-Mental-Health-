import { describe, expect, it } from "vitest";
import { matchTherapistPair, withAlternativeTherapist } from "@/lib/matching";
import { QUESTIONS, scoreQuiz } from "@/lib/quiz";
import { therapists } from "@/lib/therapists";
import { parseQuizConsultationSlot, torontoCalendarToday } from "@/lib/quizConsultation";
import { parseResultEngagement } from "@/lib/quizResultEngagement";
import { buildQuizConsultationBookingEmail } from "@/lib/server/quizConsultationEmail";

describe("quiz therapist pairs", () => {
  it.each([0, 1, 2, 3])("offers two eligible therapists of different genders at answer level %s", (level) => {
    const outcome = scoreQuiz(Object.fromEntries(QUESTIONS.filter((q) => q.kind === "scored").map((q) => [q.id, level])));
    const result = matchTherapistPair(outcome, { concerns: ["anxiety"], genderPreference: "no-preference" });
    expect(result.status).toBe("match");
    if (result.status !== "match") throw new Error("Expected matches");
    const primary = therapists.find((t) => t.slug === result.therapistSlug)!;
    const secondary = therapists.find((t) => t.slug === result.alternative?.therapistSlug)!;
    expect(primary.matching.gender).not.toBe(secondary.matching.gender);
    for (const t of [primary, secondary]) { expect(t.acceptingNewClients).toBe(true); expect(t.comingSoon).not.toBe(true); }
    expect(result.alternative?.reasons.some((reason) => reason.chip === "Preference respected")).toBe(false);
    expect(matchTherapistPair(outcome, { concerns: ["anxiety"], genderPreference: "no-preference" }, [...therapists].reverse())).toEqual(result);
  });
  it("does not invent an unavailable alternative and preserves the old primary on restored results", () => {
    const outcome = scoreQuiz({});
    const oldMatch = { status: "match" as const, therapistSlug: "ryann-simpson", reasons: [], runnersUp: [] };
    const result = withAlternativeTherapist(oldMatch, outcome, { concerns: [], genderPreference: "no-preference" }, therapists.filter((t) => t.matching.gender === "woman"));
    expect(result).toEqual(oldMatch);
  });
});

describe("staff-managed quiz calendar", () => {
  const now = new Date("2026-09-07T15:00:00Z");
  it("validates the same preset slots and supplies a canonical Toronto label", () => {
    expect(parseQuizConsultationSlot("2026-09-08", "9:00 AM", now)).toMatchObject({ date: "2026-09-08", time: "9:00 AM", availability: "morning", label: expect.stringContaining("2026 (Toronto time)") });
  });
  it.each([["2026-09-07", "3:00 PM"], ["2026-09-12", "9:00 AM"], ["2026-10-08", "9:00 AM"], ["2026-09-31", "9:00 AM"], ["2026-09-08", "9:20 AM"], ["2026-09-08", "<script>"], ["2026-9-8", "9:00 AM"]])("rejects unavailable/invalid slots %s %s", (date, time) => expect(parseQuizConsultationSlot(date, time, now)).toBeNull());
  it("uses Toronto's date across the UTC midnight boundary", () => {
    expect(torontoCalendarToday(new Date("2026-09-08T01:00:00Z")).getDate()).toBe(7);
  });
  it("sends a concise escaped appointment email with its date, timezone, duration and phone format", () => {
    const slot = parseQuizConsultationSlot("2026-09-08", "9:00 AM", now)!;
    const email = buildQuizConsultationBookingEmail('<script>alert(1)</script>', slot);
    for (const body of [email.text, email.html]) { expect(body).toContain("20-minute phone consultation"); expect(body).toContain(slot.label); expect(body).toContain("reply to this email"); }
    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toMatch(/utm_|gclid|janeapp/i);
  });
});

describe("privacy-safe result engagement contract", () => {
  const snapshot = { viewId: "12345678-1234-4234-9234-123456789abc", sequence: 1, activeSeconds: 30, elapsedSeconds: 45, scrollDepth: 80, sections: ["summary", "booking"], lastSection: "booking", actions: { booking_clicked: 1 } };
  it("accepts bounded first-party summaries", () => expect(parseResultEngagement(snapshot)).toEqual(snapshot));
  it.each([{ email: "private@example.com" }, { answers: {} }, { actions: { typed_value: "private" } }, { sections: ["safety"] }, { lastSection: "details" }, { scrollDepth: 101 }, { activeSeconds: 46 }, { activeSeconds: -1 }, { sequence: 1.5 }, { viewId: "private" }])("rejects sensitive/invalid data %j", (patch) => expect(parseResultEngagement({ ...snapshot, ...patch })).toBeNull());
});

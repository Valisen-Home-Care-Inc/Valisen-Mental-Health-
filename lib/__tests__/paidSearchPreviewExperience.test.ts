import { afterEach, describe, expect, it, vi } from "vitest";
import { conceptSessionFee, conceptTherapists, getPaidSearchConcept } from "@/lib/paidSearchConcepts";
import { PREVIEW_REMINDER, previewSessionHas, previewSessionMark, recordConceptPreviewEvent, reminderEligible } from "@/lib/paidSearchPreviewExperience";
import mapping from "@/lib/paidSearchKeywordMap.json";

afterEach(() => vi.unstubAllGlobals());

describe("contextual preview invitation", () => {
  const eligible = { enabled: true, desktop: true, activeMs: 30_000, delayMs: PREVIEW_REMINDER.activeDelayMs, passedTherapists: true, bookingVisible: false, bookingStarted: false, alreadyShown: false, overlayOpen: false };
  it("requires the delay and completed therapist section together", () => {
    expect(reminderEligible({ ...eligible, activeMs: 29_999 })).toBe(false);
    expect(reminderEligible({ ...eligible, passedTherapists: false })).toBe(false);
    expect(reminderEligible(eligible)).toBe(true);
    expect(reminderEligible({ ...eligible, delayMs: 60_000 })).toBe(false);
  });
  it.each(["bookingVisible", "bookingStarted", "alreadyShown", "overlayOpen"] as const)("suppresses the invitation for %s", (key) => {
    expect(reminderEligible({ ...eligible, [key]: true })).toBe(false);
  });
  it("can be disabled and never uses the desktop invitation on mobile", () => {
    expect(reminderEligible({ ...eligible, enabled: false })).toBe(false);
    expect(reminderEligible({ ...eligible, desktop: false })).toBe(false);
  });
  it("remembers suppression across concept pages and fails closed if storage is blocked", () => {
    const data = new Map<string, string>();
    vi.stubGlobal("sessionStorage", { getItem: (key: string) => data.get(key), setItem: (key: string, value: string) => data.set(key, value) });
    expect(previewSessionHas("invitation")).toBe(false);
    previewSessionMark("invitation");
    expect(previewSessionHas("invitation")).toBe(true);
    vi.stubGlobal("sessionStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } });
    expect(previewSessionHas("invitation")).toBe(true);
    expect(() => previewSessionMark("invitation")).not.toThrow();
  });
  it("emits local preview events without contact fields or network requests", () => {
    const target = new EventTarget();
    const listener = vi.fn();
    const network = vi.fn();
    target.addEventListener("valisen:concept-preview", listener);
    vi.stubGlobal("window", target); vi.stubGlobal("fetch", network);
    recordConceptPreviewEvent("preview_completed", "couples", "booking", "en");
    expect(listener).toHaveBeenCalledOnce();
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({ event: "preview_completed", concept: "couples", placement: "booking", locale: "en", preview: true });
    expect(network).not.toHaveBeenCalled();
  });
});

describe("service-specific booking information", () => {
  it("charges the confirmed couples fee for either clinician without changing individual rates", () => {
    for (const { therapist } of conceptTherapists(getPaidSearchConcept("couples")!)) {
      const individual = { fee: therapist.therapySessionPriceMinimum, duration: therapist.therapySessionDurationMinutes };
      expect(conceptSessionFee("couples", individual)).toEqual({ fee: 200, duration: 50 });
      expect(conceptSessionFee("anxiety", individual)).toEqual(individual);
    }
  });
  it("routes explicit psychotherapist keywords to an RP-led concept", () => {
    for (const keyword of ["[book a psychotherapist]", "[online psychotherapist ontario]"]) {
      expect(mapping.find((entry) => entry.keyword === keyword)?.slug).toBe("psychotherapists");
    }
  });
});

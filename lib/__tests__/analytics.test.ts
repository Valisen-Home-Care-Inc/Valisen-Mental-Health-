import { afterEach, describe, expect, it } from "vitest";
import {
  getDeviceCategory,
  trackFunnelEvent,
  trackQuizEvent,
  type SafeFunnelEventProperties,
  type SafeQuizEventProperties,
} from "@/lib/analytics";

const originalWindow = globalThis.window;

function installWindow(width: number) {
  const dataLayer: Record<string, unknown>[] = [];
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      dataLayer,
      location: { search: "", pathname: "/" },
      sessionStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
      matchMedia: (query: string) => {
        const maxWidth = Number(query.match(/max-width:\s*(\d+)px/)?.[1]);
        return { matches: Number.isFinite(maxWidth) && width <= maxWidth };
      },
    },
  });
  return dataLayer;
}

afterEach(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: originalWindow,
  });
});

describe("privacy-safe quiz analytics", () => {
  it("emits the stable Jane event and only its allowed non-sensitive fields", () => {
    const dataLayer = installWindow(390);
    const properties = {
      intent: "ready_to_speak",
      therapistId: "tim-kahtava",
      ctaPlacement: "mobile_sticky",
      submissionReference: "VQ-ABC123",
      campaignSource: "google",
      campaignName: "therapy-search",
      deviceCategory: getDeviceCategory(),
      // A runtime caller cannot smuggle clinical or contact data through the
      // typed event helper because unknown properties are never copied.
      score: 24,
      email: "private@example.com",
      concern: "anxiety",
    } as SafeQuizEventProperties;

    trackQuizEvent("jane_booking_clicked", properties);

    expect(dataLayer).toEqual([
      {
        event: "jane_booking_clicked",
        quiz_intent: "ready_to_speak",
        therapist_id: "tim-kahtava",
        cta_placement: "mobile_sticky",
        quiz_submission_reference: "VQ-ABC123",
        campaign_source: "google",
        campaign_name: "therapy-search",
        device_category: "mobile",
      },
    ]);
    expect(dataLayer[0]).not.toHaveProperty("score");
    expect(dataLayer[0]).not.toHaveProperty("email");
    expect(dataLayer[0]).not.toHaveProperty("concern");
  });

  it("classifies the existing responsive breakpoints consistently", () => {
    installWindow(390);
    expect(getDeviceCategory()).toBe("mobile");

    installWindow(768);
    expect(getDeviceCategory()).toBe("tablet");

    installWindow(1280);
    expect(getDeviceCategory()).toBe("desktop");
  });

  it("emits a stable privacy-safe event for the exploring therapist profile link", () => {
    const dataLayer = installWindow(390);

    trackQuizEvent("therapist_profile_clicked", {
      intent: "exploring",
      therapistId: "dayong-quan",
      profileLinkPlacement: "exploring_match_card",
      submissionReference: "VQ-PROFILE1",
      campaignSource: "quiz",
      deviceCategory: getDeviceCategory(),
      // Unknown fields are not copied into the data layer.
      email: "private@example.com",
      concern: "anxiety",
    } as SafeQuizEventProperties);

    expect(dataLayer).toEqual([
      {
        event: "therapist_profile_clicked",
        quiz_intent: "exploring",
        therapist_id: "dayong-quan",
        profile_link_placement: "exploring_match_card",
        quiz_submission_reference: "VQ-PROFILE1",
        campaign_source: "quiz",
        device_category: "mobile",
      },
    ]);
    expect(dataLayer[0]).not.toHaveProperty("email");
    expect(dataLayer[0]).not.toHaveProperty("concern");
  });
});

describe("privacy-safe acquisition funnel analytics", () => {
  it("emits only allow-listed context and never copies finder answers or contact data", () => {
    const dataLayer = installWindow(390);
    const properties = {
      page: "homepage",
      ctaPlacement: "finder_result",
      landingPageVariant: "paid",
      finderUsed: true,
      funnelStep: 3,
      attribution: {
        source: "google",
        medium: "cpc",
        campaign: "ontario-therapy",
        content: "finder-a",
      },
      concern: "trauma",
      recommendation: "tim-kahtava",
      email: "private@example.com",
      phone: "613-555-0100",
      quizResult: "high",
    } as SafeFunnelEventProperties;

    trackFunnelEvent("therapist_recommendation_jane_clicked", properties);

    expect(dataLayer).toEqual([
      {
        event: "therapist_recommendation_jane_clicked",
        page: "homepage",
        device_category: "mobile",
        cta_placement: "finder_result",
        landing_page_variant: "paid",
        finder_used: true,
        funnel_step: 3,
        utm_source: "google",
        utm_medium: "cpc",
        utm_campaign: "ontario-therapy",
        utm_content: "finder-a",
      },
    ]);
    expect(JSON.stringify(dataLayer[0])).not.toMatch(
      /trauma|tim-kahtava|private@|613-555|high/i,
    );
  });

  it("tracks Possibility Builder progress without copying selections, reflection, or therapist match", () => {
    const dataLayer = installWindow(1280);
    trackFunnelEvent(
      "possibility_reflection_viewed",
      {
        page: "homepage",
        funnelStep: 3,
        funnelCompleted: true,
        finderUsed: true,
        attribution: { source: "google", medium: "cpc" },
        selectedProblem: "relationship patterns",
        selectedGoals: ["healthier connection"],
        reflection: "private reflection copy",
        matchedTherapist: "private match",
      } as SafeFunnelEventProperties,
    );

    expect(dataLayer).toEqual([
      {
        event: "possibility_reflection_viewed",
        page: "homepage",
        device_category: "desktop",
        finder_used: true,
        funnel_step: 3,
        funnel_completed: true,
        utm_source: "google",
        utm_medium: "cpc",
      },
    ]);
    expect(JSON.stringify(dataLayer[0])).not.toMatch(
      /relationship|healthier|reflection copy|private match/i,
    );
  });
});

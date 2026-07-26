import { afterEach, describe, expect, it } from "vitest";
import {
  getDeviceCategory,
  trackQuizEvent,
  type SafeQuizEventProperties,
} from "@/lib/analytics";

const originalWindow = globalThis.window;

function installWindow(width: number) {
  const dataLayer: Record<string, unknown>[] = [];
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      dataLayer,
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

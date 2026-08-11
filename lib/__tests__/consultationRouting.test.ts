import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  JANE_BOOKING_URL,
  MATCHING_FORM_URL,
  getConsultationRequestUrl,
  getSecondaryJaneUrl,
  getTherapistIntakeUrl,
} from "@/lib/intake";

describe("consultation routing", () => {
  it("routes every primary booking helper to the consultation form", () => {
    expect(MATCHING_FORM_URL).toBe("/consultation?source=website");
    expect(getTherapistIntakeUrl("tim-kahtava")).toBe(
      "/consultation?therapist=tim-kahtava&source=therapist_profile",
    );
    expect(getConsultationRequestUrl("dayong-quan", "profile_card")).toBe(
      "/consultation?therapist=dayong-quan&source=profile_card",
    );
  });

  it("drops unverified therapist and unsafe source values", () => {
    expect(getConsultationRequestUrl("not-a-therapist", "hero<script>")).toBe(
      "/consultation?source=website",
    );
  });

  it("keeps Jane available only through the explicit secondary helper", () => {
    expect(getSecondaryJaneUrl("tim-kahtava")).toBe(
      "https://valisenmentalhealth.janeapp.com/#/staff_member/5",
    );
    expect(getSecondaryJaneUrl()).toBe(JANE_BOOKING_URL);
  });

  it("never places the private quiz capability in a consultation URL", () => {
    const privateToken =
      "v1.VQ-123456789ABC.abcdefghijklmnopqrstuvwxyz0123456789_-";
    const url = getConsultationRequestUrl("tim-kahtava", "quiz_result");

    expect(url).toBe(
      "/consultation?therapist=tim-kahtava&source=quiz_result",
    );
    expect(url).not.toContain(privateToken);
    expect(url).not.toMatch(/submissionToken|resultToken|token=/i);
  });

  it("marks both explicitly tracked quiz consultation anchors to prevent global double-counting", () => {
    const source = readFileSync(
      resolve(process.cwd(), "components/quiz/ResultsReveal.tsx"),
      "utf8",
    );

    expect(source).toMatch(
      /href=\{bookingUrl\}\s+data-funnel-tracked="true"\s+onClick=\{onClick\}/,
    );
    expect(source).toMatch(
      /href=\{bookingUrl\}\s+data-funnel-tracked="true"\s+onClick=\{\(\) => handleConsultationClick\("mobile_sticky"\)\}/,
    );
  });
});

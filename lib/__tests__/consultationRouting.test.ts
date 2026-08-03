import { describe, expect, it } from "vitest";
import {
  JANE_BOOKING_URL,
  MATCHING_FORM_URL,
  getConsultationRequestUrl,
  getSecondaryJaneUrl,
  getTherapistIntakeUrl,
} from "@/lib/intake";

describe("consultation routing", () => {
  it("routes every primary booking helper to the consultation form", () => {
    expect(MATCHING_FORM_URL).toBe("/consultation");
    expect(getTherapistIntakeUrl("tim-kahtava")).toBe(
      "/consultation?therapist=tim-kahtava",
    );
    expect(getConsultationRequestUrl("dayong-quan", "profile_card")).toBe(
      "/consultation?therapist=dayong-quan&source=profile_card",
    );
  });

  it("drops unverified therapist and unsafe source values", () => {
    expect(getConsultationRequestUrl("not-a-therapist", "hero<script>")).toBe(
      "/consultation?source=heroscript",
    );
  });

  it("keeps Jane available only through the explicit secondary helper", () => {
    expect(getSecondaryJaneUrl("tim-kahtava")).toBe(
      "https://valisenmentalhealth.janeapp.com/#/staff_member/5",
    );
    expect(getSecondaryJaneUrl()).toBe(JANE_BOOKING_URL);
  });
});

import { describe, expect, it } from "vitest";
import { getDirectoryMobileAction } from "@/lib/mobileTherapistAction";
import { therapists } from "@/lib/therapists";

describe("responsive directory CTA behavior", () => {
  it("shows the finder action before a therapist card is active", () => {
    expect(getDirectoryMobileAction()).toEqual({
      kind: "finder",
      label: "Find My Therapist",
      href: "#therapist-finder",
      external: false,
    });
  });

  it("switches to the active therapist-specific Jane action", () => {
    const tim = therapists.find(
      (therapist) => therapist.slug === "tim-kahtava",
    );
    if (!tim) throw new Error("Missing Tim test record");

    expect(getDirectoryMobileAction(tim)).toEqual({
      kind: "booking",
      label: "Book Free Consultation with Tim",
      href: "https://valisenmentalhealth.janeapp.com/#/staff_member/5",
      external: true,
    });
  });

  it("does not show a booking action for an unavailable therapist", () => {
    const tim = therapists.find(
      (therapist) => therapist.slug === "tim-kahtava",
    );
    if (!tim) throw new Error("Missing Tim test record");

    expect(
      getDirectoryMobileAction({
        ...tim,
        acceptingNewClients: false,
        availability: "Not currently accepting",
      }),
    ).toMatchObject({ kind: "finder", href: "#therapist-finder" });
  });
});

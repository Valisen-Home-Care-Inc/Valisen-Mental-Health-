import { describe, expect, it } from "vitest";
import { getDirectoryMobileAction } from "@/lib/mobileTherapistAction";
import { therapists } from "@/lib/therapists";

describe("responsive directory CTA behavior", () => {
  it("shows the general consultation action before a therapist card is active", () => {
    expect(getDirectoryMobileAction()).toEqual({
      kind: "booking",
      label: "Book Free Consultation",
      href: "/consultation?source=directory_help",
      external: false,
    });
  });

  it("switches to the therapist-specific consultation request", () => {
    const tim = therapists.find(
      (therapist) => therapist.slug === "tim-kahtava",
    );
    if (!tim) throw new Error("Missing Tim test record");

    expect(getDirectoryMobileAction(tim)).toEqual({
      kind: "booking",
      label: "Book Free Consultation with Tim",
      href: "/consultation?therapist=tim-kahtava&source=directory_mobile",
      external: false,
    });
  });

  it("offers a general consultation instead of an unavailable therapist", () => {
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
    ).toMatchObject({ kind: "booking", href: "/consultation?source=directory_help" });
  });
});

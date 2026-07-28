import type { Therapist } from "@/lib/therapists";

export type MobileTherapistAction =
  | {
      kind: "finder";
      label: "Find My Therapist";
      href: "#therapist-finder";
      external: false;
    }
  | {
      kind: "booking";
      label: string;
      href: string;
      external: true;
    };

export function getDirectoryMobileAction(
  activeTherapist?: Therapist,
): MobileTherapistAction {
  if (activeTherapist?.acceptingNewClients && !activeTherapist.comingSoon) {
    return {
      kind: "booking",
      label: `Book Free Consultation with ${activeTherapist.name.split(" ")[0]}`,
      href: activeTherapist.consultationBookingUrl,
      external: true,
    };
  }

  return {
    kind: "finder",
    label: "Find My Therapist",
    href: "#therapist-finder",
    external: false,
  };
}

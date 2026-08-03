import type { Therapist } from "@/lib/therapists";
import { getConsultationRequestUrl } from "@/lib/intake";

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
      external: false;
    };

export function getDirectoryMobileAction(
  activeTherapist?: Therapist,
): MobileTherapistAction {
  if (activeTherapist?.acceptingNewClients && !activeTherapist.comingSoon) {
    return {
      kind: "booking",
      label: `Book Free Consultation with ${activeTherapist.name.split(" ")[0]}`,
      href: getConsultationRequestUrl(activeTherapist.slug, "directory_mobile"),
      external: false,
    };
  }

  return {
    kind: "finder",
    label: "Find My Therapist",
    href: "#therapist-finder",
    external: false,
  };
}

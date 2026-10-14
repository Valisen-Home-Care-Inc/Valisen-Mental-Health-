import { formatTherapySession, getAcceptingTherapists } from "@/lib/therapists";
import { buildClinicianReassurance } from "./clinicianReassurance";
import type { JourneyClinician } from "./conversionModel";

/** Owner-confirmed couples capability stays scoped to the checkpoint experience. */
export function checkpointClinicians(): JourneyClinician[] {
  return getAcceptingTherapists().map(person => ({
    slug: person.slug, name: person.name, credential: person.credentialSummary,
    photo: person.photo || "", photoPosition: person.photoPosition, languages: person.languages,
    tags: person.slug === "meryem-ibrahim" ? [...person.matching.concernTags, "couples-therapy"] : person.matching.concernTags,
    couples: person.matching.populations.includes("couples") || person.slug === "meryem-ibrahim",
    fee: formatTherapySession(person), registration: person.credentials,
    consultationMinutes: person.consultationDurationMinutes,
    reassurance: buildClinicianReassurance(person, person.slug === "meryem-ibrahim"),
  }));
}

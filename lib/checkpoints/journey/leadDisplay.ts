import type { ConsultationLead } from "@/lib/consultationCrm";
import { getPreferredTherapistLabel, isSpecificTherapistSlug, normalizePreferredTherapist } from "@/lib/intake";
export function checkpointLeadEmailLabel(lead: ConsultationLead) {
  return lead.email || (lead.source === "mental_battery_checkpoint" && lead.phone ? "Phone contact only" : "Details in legacy sheet");
}
export function checkpointLeadTherapistLabel(lead: ConsultationLead) {
  const normalized = normalizePreferredTherapist(lead.preferredTherapist);
  if (lead.source === "mental_battery_checkpoint" && isSpecificTherapistSlug(normalized)) return getPreferredTherapistLabel(normalized);
  return lead.preferredTherapist || "";
}

import { isCheckpointCode } from "@/lib/checkpoints/config";
import { isUuid } from "@/lib/checkpoints/eventContract";
import { checkpointClinicians } from "./clinicians";
import { CHECKPOINT_JOURNEY_VERSION } from "./contract";
import { CALL_CONSENT_TEXT, CALL_CONSENT_VERSION, validateContact } from "./contact";
import { formatReferralPhone } from "@/lib/phoneFormatting";

export type CheckpointCallRequest = { checkpointCode: string; sessionId: string; clientSubmissionId: string; firstName: string; phone: string; therapist: string; therapistName: string; language: string; service: "individual" | "couples"; token: string };
const KEYS = new Set(["checkpointCode","funnelVersion","firstName","preferredContactMethod","contact","optionalMessage","consent","consentText","consentVersion","preferredTherapist","consultationLanguage","requestedService","clientSubmissionId","sessionId","formStartedAt","turnstileToken"]);
export function parseCheckpointCallRequest(input: unknown, now = Date.now()): { value?: CheckpointCallRequest; error?: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { error: "Invalid request." };
  const v = input as Record<string, unknown>;
  if (Object.keys(v).some(key => !KEYS.has(key)) || !isCheckpointCode(v.checkpointCode) || !isUuid(v.sessionId) || !isUuid(v.clientSubmissionId) || v.funnelVersion !== CHECKPOINT_JOURNEY_VERSION || v.preferredContactMethod !== "phone" || v.optionalMessage !== "") return { error: "Invalid request details." };
  if (typeof v.firstName !== "string" || typeof v.contact !== "string" || v.contact.length > 30) return { error: "Your name and phone number are required." };
  const errors = validateContact({ firstName: v.firstName, phone: v.contact, consent: v.consent === true });
  if (Object.keys(errors).length) return { error: errors.firstName || errors.contact || errors.consent };
  if (v.consentText !== CALL_CONSENT_TEXT || v.consentVersion !== CALL_CONSENT_VERSION) return { error: "Please refresh and confirm your permission to be contacted." };
  if (typeof v.formStartedAt !== "number" || !Number.isFinite(v.formStartedAt) || v.formStartedAt > now + 30_000 || v.formStartedAt < now - 24 * 60 * 60_000) return { error: "Please reopen the form and try again." };
  const clinicians = checkpointClinicians();
  const person = clinicians.find(p => p.slug === v.preferredTherapist);
  if ((!person && v.preferredTherapist !== "team-help") || !["individual","couples"].includes(String(v.requestedService)) || (v.requestedService === "couples" && person && !person.couples)) return { error: "Please choose an available therapist for this service." };
  const language = v.consultationLanguage;
  if (typeof language !== "string" || !["English","French","Arabic","Mandarin"].includes(language) || (person && !person.languages.includes(language))) return { error: "Please choose a consultation language offered by your selected therapist." };
  if (typeof v.turnstileToken !== "string" || !v.turnstileToken || v.turnstileToken.length > 2048) return { error: "Please complete the security check and try again." };
  return { value: { checkpointCode: v.checkpointCode, sessionId: v.sessionId, clientSubmissionId: v.clientSubmissionId, firstName: v.firstName.trim(), phone: formatReferralPhone(v.contact,v.contact.length).formatted, therapist: person?.slug || "team-help", therapistName: person?.name || "Our team will help select a therapist", language, service: v.requestedService as "individual" | "couples", token: v.turnstileToken } };
}

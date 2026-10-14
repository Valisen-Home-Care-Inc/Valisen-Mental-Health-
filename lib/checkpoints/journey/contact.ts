export type ContactDraft = {
  firstName: string; method: "phone" | "email"; phone: string; email: string;
  message: string; consent: boolean;
};
export type ContactErrors = Partial<Record<"firstName" | "contact" | "consent", string>>;
export const CALL_CONSENT_VERSION = "checkpoint-free-call-v3";
export const CALL_CONSENT_TEXT = "I agree that Valisen Mental Health may contact me about this free consultation request and help arrange a therapist and time.";

export function validateContact(draft: Pick<ContactDraft, "firstName" | "phone" | "consent"> & Partial<Pick<ContactDraft, "method" | "email">>): ContactErrors {
  const errors: ContactErrors = {};
  if (!draft.firstName.trim()) errors.firstName = "Enter your first name.";
  else if (draft.firstName.trim().length > 80 || /[\r\n\u0000]/.test(draft.firstName)) errors.firstName = "Enter a name using 80 characters or fewer.";
  const digits = draft.phone.replace(/\D/g, "");
  if (!/^[+\d\s().-]+$/.test(draft.phone.trim()) || !(/^[2-9]\d{2}[2-9]\d{6}$/.test(digits) || /^1[2-9]\d{2}[2-9]\d{6}$/.test(digits))) {
    errors.contact = "Enter a 10-digit Canadian phone number, with country code +1 if needed.";
  }
  if (!draft.consent) errors.consent = "Please give permission for us to contact you about your request.";
  return errors;
}

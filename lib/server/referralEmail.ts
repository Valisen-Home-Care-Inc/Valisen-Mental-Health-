import nodemailer from "nodemailer";
import { after } from "next/server";
import { REFERRAL_CONSENT, REFERRAL_CONSENT_VERSION, type ReferralFields } from "@/lib/referrals";
import { getTherapistBySlug } from "@/lib/therapists";
import { getCompletedSubmission, markSubmissionCompleted } from "@/lib/server/rateLimit";

export const REFERRAL_EMAIL_TO = "info@valisenmentalhealth.com";
const inFlight = new Map<string, Promise<void>>();

export function buildProviderAcknowledgement(providerEmail: string, id: string) {
  return {
    to: providerEmail,
    replyTo: REFERRAL_EMAIL_TO,
    subject: `Referral received | Valisen Mental Health | VR-${id}`,
    messageId: `<provider-referral-receipt-${id}@valisenmentalhealth.com>`,
    text: `Thank you for referring to Valisen Mental Health.

Your referral has been received.
Reference: VR-${id}

Our team will review the referral and contact the patient using their preferred contact method to discuss clinician fit, availability and next steps.

This acknowledgement confirms receipt only. An appointment has not been booked, and it does not confirm acceptance for treatment or authorize clinical updates to the referring provider.

For privacy, no patient details are included in this email. If you have a question, quote the reference above and avoid including patient information in your reply.

Valisen Mental Health
613-707-0333
info@valisenmentalhealth.com
https://valisenmentalhealth.com/referrals`,
  };
}

async function sendProviderAcknowledgement(providerEmail: string, id: string, user: string, password: string) {
  const transporter = nodemailer.createTransport({
    service: "gmail", auth: { user, pass: password }, requireTLS: true,
    connectionTimeout: 8_000, greetingTimeout: 8_000, socketTimeout: 15_000,
    logger: false, debug: false,
  });
  try {
    const result = await transporter.sendMail({
      from: { name: "Valisen Patient Referrals", address: user },
      ...buildProviderAcknowledgement(providerEmail, id),
    });
    const accepted = result.accepted?.some((address: string | { address: string }) =>
      (typeof address === "string" ? address : address.address).toLowerCase() === providerEmail.toLowerCase());
    if (!accepted) throw new Error("Acknowledgement not accepted.");
  } catch {
    // Do not log the recipient, message, reference, or upstream error body.
    console.warn("provider-referral: acknowledgement delivery unavailable");
  } finally { transporter.close(); }
}

export function buildReferralEmail(fields: ReferralFields, id: string) {
  return {
    to: REFERRAL_EMAIL_TO,
    subject: `PATIENT REFERRAL | Healthcare Provider | VR-${id}`,
    replyTo: fields.providerEmail,
    messageId: `<patient-referral-${id}@valisenmentalhealth.com>`,
    text: `PATIENT REFERRAL - HEALTHCARE PROVIDER
Action required: review this referral and contact the patient.
Reference: VR-${id}
Received: ${new Date().toISOString()}

REFERRING PROVIDER
Name: ${fields.providerName}
Role: ${fields.providerRole}
Clinic / organization: ${fields.organization}
Phone: ${fields.providerPhone}
Email: ${fields.providerEmail}

PATIENT CONTACT
Name: ${fields.patientName}
Phone: ${fields.patientPhone || "Not provided"}
Email: ${fields.patientEmail || "Not provided"}
Preferred contact method: ${fields.contactMethod}

REFERRAL DETAILS
General reason: ${fields.reason}
Language: ${fields.language}
Therapist preference: ${getTherapistBySlug(fields.therapist)?.name || "No preference"}
Coordination notes:
${fields.notes || "None"}

PATIENT AUTHORIZATION
Confirmed by referring provider. Version: ${REFERRAL_CONSENT_VERSION}
${REFERRAL_CONSENT}

This referral has not booked an appointment. Reply goes to the referring provider, not the patient. Contact the patient using their preferred method above. Clinical updates to the referrer require separate authorization.
Confidential patient information: handle only within the authorized referral team.`,
  };
}

export async function sendReferralEmail(fields: ReferralFields, id: string): Promise<void> {
  const user = process.env.GMAIL_USER?.trim();
  const password = process.env.GMAIL_APP_PASSWORD?.trim();
  if (!user || !password) throw new Error("Referral email is not configured.");
  // No database or patient data persisted. Retry deduplication is per warm
  // server instance; stable Message-ID identifies cross-instance retries.
  const key = `provider-referral:${id}`;
  if (getCompletedSubmission(key)) return;
  const pending = inFlight.get(key);
  if (pending) return pending;
  const operation = (async () => {
    const transporter = nodemailer.createTransport({
      service: "gmail", auth: { user, pass: password }, requireTLS: true,
      connectionTimeout: 8_000, greetingTimeout: 8_000, socketTimeout: 15_000,
      logger: false, debug: false,
    });
    try {
      const result = await transporter.sendMail({
        from: { name: "Valisen Patient Referrals", address: user },
        ...buildReferralEmail(fields, id),
      });
      const accepted = result.accepted?.some((address: string | { address: string }) =>
        (typeof address === "string" ? address : address.address).toLowerCase() === REFERRAL_EMAIL_TO);
      if (!accepted) throw new Error("Referral email was not accepted.");
      markSubmissionCompleted(key, id);
      // Next keeps this task alive after the response. A receipt failure must
      // never turn an accepted clinic referral into an error or cause a resend.
      // Capture only the provider address and reference, never the patient fields.
      const providerEmail = fields.providerEmail;
      try {
        after(() => sendProviderAcknowledgement(providerEmail, id, user, password));
      } catch {
        console.warn("provider-referral: acknowledgement scheduling unavailable");
      }
    } finally { transporter.close(); }
  })();
  inFlight.set(key, operation);
  try { await operation; } finally { inFlight.delete(key); }
}

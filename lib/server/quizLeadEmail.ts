/**
 * Builds the two distinct internal quiz notifications.
 *
 * Results access is an administrative submission notice only. It must never
 * imply that the visitor asked Valisen or a therapist to contact them.
 * Therapist-contact consent uses a separate builder with the exact recorded
 * consent details.
 */

import { escapeHtml } from "@/lib/quizLead";

export type QuizResultsAccessEmailModel = {
  referenceId: string;
  firstName: string;
  email: string;
  phone?: string;
  resultCategory: string;
  scoreBand: string;
  recommendedTherapistName: string | null;
  submittedAtLabel: string;
  privacyAcknowledgedAtLabel: string;
  adminUrl?: string;
};

export type QuizLeadEmailModel = {
  referenceId: string;
  firstName: string;
  email: string;
  phone?: string;
  resultCategory: string;
  scoreBand: string;
  recommendedTherapistName: string | null;
  consentTimestampLabel: string;
  consentText: string;
  consentTextVersion: string;
  adminUrl?: string;
};

type BuiltEmail = {
  subject: string;
  text: string;
  html: string;
};

function subjectSafeFirstName(firstName: string): string {
  // Defend mail headers even if a legacy row predates current single-line
  // validation. Nodemailer also rejects newline-bearing header values.
  return firstName.replace(/[\r\n]+/g, " ").trim();
}

function submissionText(referenceId: string, adminUrl?: string): string {
  return adminUrl
    ? `Secure submission link: ${adminUrl}`
    : `Internal submission reference: ${referenceId}`;
}

function submissionHtml(referenceId: string, adminUrl?: string): string {
  return adminUrl
    ? `<a href="${escapeHtml(adminUrl)}" style="color:#1E6B6B;font-weight:600">Open the secure submission</a>`
    : `Internal submission reference: <strong>${escapeHtml(referenceId)}</strong>`;
}

/**
 * Internal notification sent when the required results-access form succeeds.
 * This is deliberately neutral: it reports a saved quiz result but provides
 * no authority to contact the visitor about therapy.
 */
export function buildQuizResultsAccessEmail(
  model: QuizResultsAccessEmailModel,
): BuiltEmail {
  const therapistName = model.recommendedTherapistName ?? "No clear automated match";
  const phone = model.phone || "Not provided";
  const subject = `New Quiz Results Submission — ${subjectSafeFirstName(model.firstName)}`;
  const adminLine = submissionText(model.referenceId, model.adminUrl);
  const e = escapeHtml;
  const adminHtml = submissionHtml(model.referenceId, model.adminUrl);

  const text = `NEW QUIZ RESULTS SUBMISSION

${model.firstName} completed the mental-health quiz and unlocked their personalized results. Their recommended therapist is ${therapistName}.

RESULTS ACCESS ONLY — THERAPIST CONTACT NOT REQUESTED
This submission does not authorize Valisen Mental Health or the recommended therapist to contact the visitor regarding therapy services. A separate therapist-contact request is required before follow-up.

CONTACT INFORMATION
First name: ${model.firstName}
Email: ${model.email}
Phone: ${phone}

QUIZ SUMMARY
Result category: ${model.resultCategory}
Score band: ${model.scoreBand}
Recommended therapist: ${therapistName}

SUBMISSION
Submitted: ${model.submittedAtLabel}
Privacy acknowledgement recorded: ${model.privacyAcknowledgedAtLabel}
Reference ID: ${model.referenceId}
${adminLine}

CONFIDENTIALITY NOTICE
This message contains personal and quiz information submitted through the Valisen Mental Health website. Handle it under the clinic's privacy policy and do not forward it outside the intake team. This inbox is not monitored continuously and this email is not an emergency alert.`;

  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;color:#2C2C2C;line-height:1.6">
  <div style="background:#1E6B6B;border-radius:12px 12px 0 0;padding:20px 24px">
    <p style="margin:0;color:#ffffff;font-size:18px;font-weight:600">New Quiz Results Submission</p>
    <p style="margin:4px 0 0;color:#B5D4D4;font-size:13px">Reference ${e(model.referenceId)}</p>
  </div>
  <div style="border:1px solid #e5e2dc;border-top:0;border-radius:0 0 12px 12px;padding:24px;background:#ffffff">
    <p style="margin:0 0 18px"><strong>${e(model.firstName)}</strong> completed the mental-health quiz and unlocked their personalized results. Their recommended therapist is <strong>${e(therapistName)}</strong>.</p>

    <div style="margin:0 0 18px;border:2px solid #C6A15B;border-radius:10px;background:#FFF9EC;padding:14px 16px">
      <h3 style="margin:0 0 6px;font-size:13px;color:#7A5417;text-transform:uppercase;letter-spacing:1px">Results Access Only — Therapist Contact Not Requested</h3>
      <p style="margin:0;color:#5B4727">This submission does not authorize Valisen Mental Health or the recommended therapist to contact the visitor regarding therapy services. A separate therapist-contact request is required before follow-up.</p>
    </div>

    <h3 style="margin:0 0 8px;font-size:13px;color:#1E6B6B;text-transform:uppercase;letter-spacing:1px">Contact Information</h3>
    <p style="margin:0 0 4px"><strong>First name:</strong> ${e(model.firstName)}</p>
    <p style="margin:0 0 4px"><strong>Email:</strong> ${e(model.email)}</p>
    <p style="margin:0 0 18px"><strong>Phone:</strong> ${e(phone)}</p>

    <h3 style="margin:0 0 8px;font-size:13px;color:#1E6B6B;text-transform:uppercase;letter-spacing:1px">Quiz Summary</h3>
    <p style="margin:0 0 4px"><strong>Result category:</strong> ${e(model.resultCategory)}</p>
    <p style="margin:0 0 4px"><strong>Score band:</strong> ${e(model.scoreBand)}</p>
    <p style="margin:0 0 18px"><strong>Recommended therapist:</strong> ${e(therapistName)}</p>

    <h3 style="margin:0 0 8px;font-size:13px;color:#1E6B6B;text-transform:uppercase;letter-spacing:1px">Submission</h3>
    <p style="margin:0 0 4px"><strong>Submitted:</strong> ${e(model.submittedAtLabel)}</p>
    <p style="margin:0 0 4px"><strong>Privacy acknowledgement recorded:</strong> ${e(model.privacyAcknowledgedAtLabel)}</p>
    <p style="margin:0 0 4px"><strong>Reference ID:</strong> ${e(model.referenceId)}</p>
    <p style="margin:0 0 18px">${adminHtml}</p>

    <p style="margin:0;font-size:12px;color:#888780">This message contains personal and quiz information submitted through the Valisen Mental Health website. Handle it under the clinic's privacy policy and do not forward it outside the intake team. This inbox is not monitored continuously and this email is not an emergency alert.</p>
  </div>
</div>`;

  return { subject, text, html };
}

export function buildQuizLeadEmail(model: QuizLeadEmailModel): {
  subject: string;
  text: string;
  html: string;
} {
  const subjectFirstName = subjectSafeFirstName(model.firstName);
  const therapistName = model.recommendedTherapistName ?? "No clear automated match";
  const phone = model.phone || "Not provided";
  const adminLine = submissionText(model.referenceId, model.adminUrl);
  const subject = `New Therapist Contact Request — ${subjectFirstName}`;

  const text = `NEW THERAPIST CONTACT REQUEST

${model.firstName} completed the mental-health quiz and explicitly requested to be contacted regarding therapy services. Their recommended therapist is ${therapistName}. Please review the submission and follow up appropriately.

CONTACT INFORMATION
First name: ${model.firstName}
Email: ${model.email}
Phone: ${phone}

QUIZ SUMMARY
Result category: ${model.resultCategory}
Score band: ${model.scoreBand}
Recommended therapist: ${therapistName}

EXPLICIT CONTACT CONSENT
User requested contact: Yes
Consent date and time: ${model.consentTimestampLabel}
Consent language shown: ${model.consentText}
Consent text version: ${model.consentTextVersion}

SUBMISSION
Reference ID: ${model.referenceId}
${adminLine}

CONFIDENTIALITY NOTICE
This message contains personal and quiz information submitted through the Valisen Mental Health website. Handle it under the clinic's privacy policy and do not forward it outside the intake team. This inbox is not monitored continuously and this email is not an emergency alert.`;

  const e = escapeHtml;
  const adminHtml = submissionHtml(model.referenceId, model.adminUrl);

  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;color:#2C2C2C;line-height:1.6">
  <div style="background:#1E6B6B;border-radius:12px 12px 0 0;padding:20px 24px">
    <p style="margin:0;color:#ffffff;font-size:18px;font-weight:600">New Therapist Contact Request</p>
    <p style="margin:4px 0 0;color:#B5D4D4;font-size:13px">Reference ${e(model.referenceId)}</p>
  </div>
  <div style="border:1px solid #e5e2dc;border-top:0;border-radius:0 0 12px 12px;padding:24px;background:#ffffff">
    <p style="margin:0 0 18px"><strong>${e(model.firstName)}</strong> completed the mental-health quiz and explicitly requested to be contacted regarding therapy services. Their recommended therapist is <strong>${e(therapistName)}</strong>. Please review the submission and follow up appropriately.</p>

    <h3 style="margin:0 0 8px;font-size:13px;color:#1E6B6B;text-transform:uppercase;letter-spacing:1px">Contact Information</h3>
    <p style="margin:0 0 4px"><strong>First name:</strong> ${e(model.firstName)}</p>
    <p style="margin:0 0 4px"><strong>Email:</strong> ${e(model.email)}</p>
    <p style="margin:0 0 18px"><strong>Phone:</strong> ${e(phone)}</p>

    <h3 style="margin:0 0 8px;font-size:13px;color:#1E6B6B;text-transform:uppercase;letter-spacing:1px">Quiz Summary</h3>
    <p style="margin:0 0 4px"><strong>Result category:</strong> ${e(model.resultCategory)}</p>
    <p style="margin:0 0 4px"><strong>Score band:</strong> ${e(model.scoreBand)}</p>
    <p style="margin:0 0 18px"><strong>Recommended therapist:</strong> ${e(therapistName)}</p>

    <div style="margin:0 0 18px;border-left:4px solid #C6A15B;background:#F7F4EF;padding:14px 16px">
      <h3 style="margin:0 0 8px;font-size:13px;color:#1E6B6B;text-transform:uppercase;letter-spacing:1px">Explicit Contact Consent</h3>
      <p style="margin:0 0 4px"><strong>User requested contact:</strong> Yes</p>
      <p style="margin:0 0 4px"><strong>Consent date and time:</strong> ${e(model.consentTimestampLabel)}</p>
      <p style="margin:0 0 4px"><strong>Consent language shown:</strong> ${e(model.consentText)}</p>
      <p style="margin:0"><strong>Consent text version:</strong> ${e(model.consentTextVersion)}</p>
    </div>

    <p style="margin:0 0 18px">${adminHtml}</p>
    <p style="margin:0;font-size:12px;color:#888780">This message contains personal and quiz information submitted through the Valisen Mental Health website. Handle it under the clinic's privacy policy and do not forward it outside the intake team. This inbox is not monitored continuously and this email is not an emergency alert.</p>
  </div>
</div>`;

  return { subject, text, html };
}

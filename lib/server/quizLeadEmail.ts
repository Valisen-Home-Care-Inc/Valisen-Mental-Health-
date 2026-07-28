/**
 * Transactional quiz email builders.
 *
 * The two clinic notifications are operational records. The visitor email
 * delivers only the result they requested and the next-step booking link; it
 * never opts the visitor into promotional communication.
 */

import { formatCampaignAttribution, type CampaignAttribution } from "@/lib/campaignAttribution";
import {
  escapeHtml,
  hasCurrentResultsAccessAuthorization,
  type ContactMethod,
} from "@/lib/quizLead";
import {
  getIntentRoutePresentation,
  getQuizIntentLabel,
  type QuizIntent,
} from "@/lib/quizIntent";
import {
  CLINIC_JANE_BOOKING_URL,
  getTherapistBookingConfig,
} from "@/lib/therapistBooking";

export type QuizLeadStatusSnapshot = {
  intent: QuizIntent;
  attribution: CampaignAttribution;
  resultsViewed: boolean;
  therapistMatchViewed: boolean;
  janeBookingClicked: boolean;
  janeCtaPlacement?: string;
  contactHelpRequested: boolean;
};

export type QuizResultsAccessEmailModel = QuizLeadStatusSnapshot & {
  referenceId: string;
  firstName: string;
  email: string;
  phone?: string;
  resultCategory: string;
  scoreBand: string;
  recommendedTherapistName: string | null;
  submittedAtLabel: string;
  privacyAcknowledgedAtLabel: string;
  privacyText: string;
  privacyTextVersion: string;
  adminUrl?: string;
};

export type QuizLeadEmailModel = QuizLeadStatusSnapshot & {
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
  contactMethod: ContactMethod;
  contactPhone?: string;
  preferredTimes: string[];
  timeZone: string;
  contactMessage?: string;
  adminUrl?: string;
};

export type QuizUserResultsEmailModel = {
  referenceId: string;
  firstName: string;
  resultHeading: string;
  intent: QuizIntent;
  recommendedTherapistSlug?: string;
  recommendedTherapistName: string | null;
  privateResultsUrl: string;
};

type BuiltEmail = {
  subject: string;
  text: string;
  html: string;
};

type QuizLeadHeatModel = QuizLeadStatusSnapshot & {
  phone?: string;
  contactPhone?: string;
  preferredTimes?: string[];
};

export type QuizLeadHeatRating = {
  score: number;
  label: string;
  verdict: string;
  evidence: string[];
  blockers: string[];
};

const INTENT_HEAT_POINTS: Record<QuizIntent, number> = {
  exploring: 0,
  see_recommended_therapist: 1,
  brief_consultation: 2,
  ready_to_speak: 3,
};

const LEAD_HEAT_LABELS = [
  "",
  "ICE COLD",
  "VERY COLD",
  "COLD",
  "COOL",
  "LUKEWARM",
  "WARM",
  "HOT",
  "VERY HOT",
  "BLAZING",
  "SOLAR HOT",
] as const;

const LEAD_HEAT_VERDICTS = [
  "",
  "Quiz-only curiosity. Do not treat this as booking-ready.",
  "Minimal intent. Treat this as information gathering.",
  "Low intent. Interest is present; booking behavior is not.",
  "Some stated intent, but no decisive booking action.",
  "Mixed intent. Normal follow-up; no reason to rush.",
  "Meaningful interest, still short of a high-intent action.",
  "Strong intent. A real scheduling signal is present.",
  "Very strong intent. Prioritize prompt human follow-up.",
  "Exceptional intent across multiple booking signals.",
  "Maximum observed intent: the strongest unconfirmed lead state in this funnel.",
] as const;

/**
 * Conservative behavioral lead scoring for internal triage.
 *
 * Symptom severity and quiz result category are deliberately excluded: mental
 * health strain is not purchase intent. Results and match views also receive
 * zero points because the results page records them automatically.
 */
export function scoreQuizLeadHeat(
  model: QuizLeadHeatModel,
): QuizLeadHeatRating {
  let score = 1;
  const evidence = ["Completed the quiz (+1)"];
  const blockers: string[] = [];
  const intentPoints = INTENT_HEAT_POINTS[model.intent];
  const hasPhone = Boolean(model.phone?.trim() || model.contactPhone?.trim());
  const preferredTimesCount =
    model.preferredTimes?.filter((time) => time.trim().length > 0).length ?? 0;

  score += intentPoints;
  evidence.push(
    `${getQuizIntentLabel(model.intent)} (+${intentPoints})`,
  );

  if (hasPhone) {
    score += 1;
    evidence.push("Provided a usable phone channel (+1)");
  } else {
    blockers.push("No phone number was provided.");
  }

  if (model.janeBookingClicked) {
    score += 2;
    evidence.push("Clicked a Jane booking CTA (+2)");
  } else {
    blockers.push("No Jane booking click has been observed.");
  }

  if (model.contactHelpRequested) {
    score += 2;
    evidence.push("Explicitly requested booking help (+2)");
  } else {
    blockers.push("No explicit booking-help request has been completed.");
  }

  if (model.contactHelpRequested && preferredTimesCount >= 2) {
    score += 1;
    evidence.push("Supplied at least two exact consultation times (+1)");
  } else {
    blockers.push("No completed request with at least two exact times.");
  }

  if (model.intent !== "ready_to_speak") {
    blockers.unshift("They did not say they are ready to speak with a therapist.");
  }

  const boundedScore = Math.max(1, Math.min(10, score));
  return {
    score: boundedScore,
    label: LEAD_HEAT_LABELS[boundedScore],
    verdict: LEAD_HEAT_VERDICTS[boundedScore],
    evidence,
    blockers,
  };
}

function leadHeatSubject(rating: QuizLeadHeatRating): string {
  return `[LEAD ${rating.score}/10 | ${rating.label}]`;
}

function leadHeatText(rating: QuizLeadHeatRating): string {
  return `LEAD HEAT: ${rating.score}/10 — ${rating.label}
Verdict: ${rating.verdict}
Evidence:
${rating.evidence.map((item) => `- ${item}`).join("\n")}
Why this is not hotter:
${rating.blockers.length > 0 ? rating.blockers.map((item) => `- ${item}`).join("\n") : "- Nothing. Every maximum-intent signal is present."}
Guardrail: symptom severity is not lead intent and earns no points. Results/match views earn no points because they are recorded automatically. A Jane click is still not a confirmed booking.`;
}

function leadHeatHtml(rating: QuizLeadHeatRating): string {
  const e = escapeHtml;
  const palette =
    rating.score <= 3
      ? { border: "#7B98A8", background: "#F1F6F8", text: "#314B59" }
      : rating.score <= 6
        ? { border: "#C6A15B", background: "#FFF9EC", text: "#5B4727" }
        : { border: "#C55A2D", background: "#FFF2EC", text: "#6F2E17" };
  const evidence = rating.evidence
    .map((item) => `<li>${e(item)}</li>`)
    .join("");
  const blockers = (
    rating.blockers.length > 0
      ? rating.blockers
      : ["Nothing. Every maximum-intent signal is present."]
  )
    .map((item) => `<li>${e(item)}</li>`)
    .join("");

  return `<div style="margin:0 0 18px;border:3px solid ${palette.border};border-radius:10px;background:${palette.background};padding:15px 17px;color:${palette.text}">
    <p style="margin:0 0 4px;font-size:20px;font-weight:800">Lead Heat: ${rating.score}/10 — ${e(rating.label)}</p>
    <p style="margin:0 0 10px;font-weight:700">${e(rating.verdict)}</p>
    <p style="margin:0 0 3px;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.8px">Evidence</p>
    <ul style="margin:0 0 10px;padding-left:20px">${evidence}</ul>
    <p style="margin:0 0 3px;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.8px">Why this is not hotter</p>
    <ul style="margin:0 0 10px;padding-left:20px">${blockers}</ul>
    <p style="margin:0;font-size:11px;line-height:1.5">Symptom severity earns no lead points. Results/match views earn no points because they are recorded automatically. A Jane click is not a confirmed booking.</p>
  </div>`;
}

function subjectSafeFirstName(firstName: string): string {
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

function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

function operationalStatusText(model: QuizLeadStatusSnapshot): string {
  return `INTENT AND ATTRIBUTION
Intent: ${getQuizIntentLabel(model.intent)}
Campaign attribution: ${formatCampaignAttribution(model.attribution)}

FUNNEL STATUS AT TIME OF THIS EMAIL
Results viewed: ${yesNo(model.resultsViewed)}
Recommended therapist viewed: ${yesNo(model.therapistMatchViewed)}
Jane booking CTA clicked: ${yesNo(model.janeBookingClicked)}
Jane CTA placement: ${model.janeCtaPlacement || "Not clicked"}
Separate contact-help request completed: ${yesNo(model.contactHelpRequested)}
Booking confirmed: No confirmation data available

Important: a Jane outbound click is not a confirmed appointment or booking.`;
}

function operationalStatusHtml(model: QuizLeadStatusSnapshot): string {
  const e = escapeHtml;
  return `<h3 style="margin:0 0 8px;font-size:13px;color:#1E6B6B;text-transform:uppercase;letter-spacing:1px">Intent and Attribution</h3>
    <p style="margin:0 0 4px"><strong>Intent:</strong> ${e(getQuizIntentLabel(model.intent))}</p>
    <p style="margin:0 0 18px"><strong>Campaign attribution:</strong> ${e(formatCampaignAttribution(model.attribution))}</p>

    <h3 style="margin:0 0 8px;font-size:13px;color:#1E6B6B;text-transform:uppercase;letter-spacing:1px">Funnel Status at Time of This Email</h3>
    <p style="margin:0 0 4px"><strong>Results viewed:</strong> ${yesNo(model.resultsViewed)}</p>
    <p style="margin:0 0 4px"><strong>Recommended therapist viewed:</strong> ${yesNo(model.therapistMatchViewed)}</p>
    <p style="margin:0 0 4px"><strong>Jane booking CTA clicked:</strong> ${yesNo(model.janeBookingClicked)}</p>
    <p style="margin:0 0 4px"><strong>Jane CTA placement:</strong> ${e(model.janeCtaPlacement || "Not clicked")}</p>
    <p style="margin:0 0 4px"><strong>Separate contact-help request completed:</strong> ${yesNo(model.contactHelpRequested)}</p>
    <p style="margin:0 0 10px"><strong>Booking confirmed:</strong> No confirmation data available</p>
    <p style="margin:0 0 18px;font-size:12px;color:#7A5417"><strong>Important:</strong> a Jane outbound click is not a confirmed appointment or booking.</p>`;
}

export function buildQuizResultsAccessEmail(
  model: QuizResultsAccessEmailModel,
): BuiltEmail {
  const leadHeat = scoreQuizLeadHeat(model);
  const therapistName =
    model.recommendedTherapistName ?? "No clear automated match";
  const phone = model.phone || "Not provided";
  const subject = `${leadHeatSubject(leadHeat)} New Quiz Results Submission — ${subjectSafeFirstName(model.firstName)}`;
  const adminLine = submissionText(model.referenceId, model.adminUrl);
  const e = escapeHtml;
  const contactSharingAuthorized =
    hasCurrentResultsAccessAuthorization(
      model.privacyText,
      model.privacyTextVersion,
    );
  const authorizationText = contactSharingAuthorized
    ? `RESULTS-ACCESS CONSENT — CONTACT AND THERAPIST SHARING AUTHORIZED
The visitor authorized Valisen's authorized staff and their recommended or matched therapist to contact them by email, phone, or text about quiz results, the therapist match, consultations, scheduling, and related Valisen therapy services.
The visitor also authorized Valisen to share their contact details and relevant quiz summary with that therapist for those purposes. This consent does not authorize sale of their information or enrollment in unrelated promotional marketing.`
    : `RESULTS-ACCESS CONSENT — LEGACY VERSION; REVIEW REQUIRED
The recorded consent does not exactly match the current results-access authorization. Do not infer authorization for therapist contact or disclosure from this email. Review the exact stored consent before any contact or sharing.
Recorded consent version: ${model.privacyTextVersion}`;
  const authorizationHtml = contactSharingAuthorized
    ? `<div style="margin:0 0 18px;border:2px solid #C6A15B;border-radius:10px;background:#FFF9EC;padding:14px 16px">
      <h3 style="margin:0 0 6px;font-size:13px;color:#7A5417;text-transform:uppercase;letter-spacing:1px">Results-Access Consent — Contact and Therapist Sharing Authorized</h3>
      <p style="margin:0 0 8px;color:#5B4727">The visitor authorized Valisen's authorized staff and their recommended or matched therapist to contact them by email, phone, or text about quiz results, the therapist match, consultations, scheduling, and related Valisen therapy services.</p>
      <p style="margin:0;color:#5B4727">The visitor also authorized Valisen to share their contact details and relevant quiz summary with that therapist for those purposes. This consent does not authorize sale of their information or enrollment in unrelated promotional marketing.</p>
    </div>`
    : `<div style="margin:0 0 18px;border:2px solid #A63D40;border-radius:10px;background:#FFF4F4;padding:14px 16px">
      <h3 style="margin:0 0 6px;font-size:13px;color:#7C2528;text-transform:uppercase;letter-spacing:1px">Results-Access Consent — Legacy Version; Review Required</h3>
      <p style="margin:0 0 8px;color:#602426">The recorded consent does not exactly match the current results-access authorization. Do not infer authorization for therapist contact or disclosure from this email. Review the exact stored consent before any contact or sharing.</p>
      <p style="margin:0;color:#602426"><strong>Recorded consent version:</strong> ${e(model.privacyTextVersion)}</p>
    </div>`;

  const text = `NEW QUIZ RESULTS SUBMISSION

${model.firstName} completed the mental-health quiz. Their recommended therapist is ${therapistName}.

${leadHeatText(leadHeat)}

${authorizationText}

CONTACT INFORMATION
First name: ${model.firstName}
Email: ${model.email}
Phone: ${phone}

QUIZ SUMMARY
Result category: ${model.resultCategory}
Score band: ${model.scoreBand}
Recommended therapist: ${therapistName}

${operationalStatusText(model)}

SUBMISSION
Submitted: ${model.submittedAtLabel}
Results-access consent recorded: ${model.privacyAcknowledgedAtLabel}
Results-access consent version: ${model.privacyTextVersion}
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
    <p style="margin:0 0 18px"><strong>${e(model.firstName)}</strong> completed the mental-health quiz. Their recommended therapist is <strong>${e(therapistName)}</strong>.</p>
    ${leadHeatHtml(leadHeat)}
    ${authorizationHtml}
    <h3 style="margin:0 0 8px;font-size:13px;color:#1E6B6B;text-transform:uppercase;letter-spacing:1px">Contact Information</h3>
    <p style="margin:0 0 4px"><strong>First name:</strong> ${e(model.firstName)}</p>
    <p style="margin:0 0 4px"><strong>Email:</strong> ${e(model.email)}</p>
    <p style="margin:0 0 18px"><strong>Phone:</strong> ${e(phone)}</p>
    <h3 style="margin:0 0 8px;font-size:13px;color:#1E6B6B;text-transform:uppercase;letter-spacing:1px">Quiz Summary</h3>
    <p style="margin:0 0 4px"><strong>Result category:</strong> ${e(model.resultCategory)}</p>
    <p style="margin:0 0 4px"><strong>Score band:</strong> ${e(model.scoreBand)}</p>
    <p style="margin:0 0 18px"><strong>Recommended therapist:</strong> ${e(therapistName)}</p>
    ${operationalStatusHtml(model)}
    <h3 style="margin:0 0 8px;font-size:13px;color:#1E6B6B;text-transform:uppercase;letter-spacing:1px">Submission</h3>
    <p style="margin:0 0 4px"><strong>Submitted:</strong> ${e(model.submittedAtLabel)}</p>
    <p style="margin:0 0 4px"><strong>Results-access consent recorded:</strong> ${e(model.privacyAcknowledgedAtLabel)}</p>
    <p style="margin:0 0 4px"><strong>Results-access consent version:</strong> ${e(model.privacyTextVersion)}</p>
    <p style="margin:0 0 4px"><strong>Reference ID:</strong> ${e(model.referenceId)}</p>
    <p style="margin:0 0 18px">${submissionHtml(model.referenceId, model.adminUrl)}</p>
    <p style="margin:0;font-size:12px;color:#888780">This message contains personal and quiz information. Handle it under the clinic's privacy policy. This inbox is not monitored continuously and this email is not an emergency alert.</p>
  </div>
</div>`;

  return { subject, text, html };
}

export function buildQuizLeadEmail(model: QuizLeadEmailModel): BuiltEmail {
  const leadHeat = scoreQuizLeadHeat(model);
  const therapistName =
    model.recommendedTherapistName ?? "No clear automated match";
  const phone = model.phone || "Not provided";
  const contactPhone =
    model.contactMethod === "email"
      ? "Not requested"
      : model.contactPhone || "Not provided";
  const message = model.contactMessage || "None";
  const preferredTimesText = model.preferredTimes
    .map((time) => `- ${time} (${model.timeZone})`)
    .join("\n");
  const preferredTimesHtml = model.preferredTimes
    .map(
      (time) =>
        `<li><code>${escapeHtml(time)}</code> (${escapeHtml(model.timeZone)})</li>`,
    )
    .join("");
  const subject = `${leadHeatSubject(leadHeat)} Booking Help Requested — ${subjectSafeFirstName(model.firstName)}`;
  const e = escapeHtml;

  const text = `BOOKING HELP REQUEST

${model.firstName} explicitly asked Valisen to help with booking. Their recommended therapist is ${therapistName}.

${leadHeatText(leadHeat)}

CONTACT INFORMATION
First name: ${model.firstName}
Email: ${model.email}
Existing phone on submission: ${phone}
Preferred contact method: ${model.contactMethod}
Contact phone: ${contactPhone}
Optional message: ${message}

PROPOSED CONSULTATION TIMES — NOT CONFIRMED
Time zone: ${model.timeZone}
${preferredTimesText}
These are availability preferences only. No appointment is booked until the visitor receives confirmation.

QUIZ SUMMARY
Result category: ${model.resultCategory}
Score band: ${model.scoreBand}
Recommended therapist: ${therapistName}

AVAILABILITY COORDINATION REQUEST
User requested scheduling help: Yes
Consent date and time: ${model.consentTimestampLabel}
Consent language shown: ${model.consentText}
Consent text version: ${model.consentTextVersion}

${operationalStatusText(model)}

SUBMISSION
Reference ID: ${model.referenceId}
${submissionText(model.referenceId, model.adminUrl)}

CONFIDENTIALITY NOTICE
This message contains personal and quiz information submitted through the Valisen Mental Health website. Handle it under the clinic's privacy policy and do not forward it outside the intake team. This inbox is not monitored continuously and this email is not an emergency alert.`;

  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;color:#2C2C2C;line-height:1.6">
  <div style="background:#1E6B6B;border-radius:12px 12px 0 0;padding:20px 24px">
    <p style="margin:0;color:#ffffff;font-size:18px;font-weight:600">Booking Help Requested</p>
    <p style="margin:4px 0 0;color:#B5D4D4;font-size:13px">Reference ${e(model.referenceId)}</p>
  </div>
  <div style="border:1px solid #e5e2dc;border-top:0;border-radius:0 0 12px 12px;padding:24px;background:#ffffff">
    <p style="margin:0 0 18px"><strong>${e(model.firstName)}</strong> explicitly asked Valisen to help with booking. Their recommended therapist is <strong>${e(therapistName)}</strong>.</p>
    ${leadHeatHtml(leadHeat)}
    <h3 style="margin:0 0 8px;font-size:13px;color:#1E6B6B;text-transform:uppercase;letter-spacing:1px">Contact Preferences</h3>
    <p style="margin:0 0 4px"><strong>Email:</strong> ${e(model.email)}</p>
    <p style="margin:0 0 4px"><strong>Existing phone on submission:</strong> ${e(phone)}</p>
    <p style="margin:0 0 4px"><strong>Preferred contact method:</strong> ${e(model.contactMethod)}</p>
    <p style="margin:0 0 4px"><strong>Contact phone:</strong> ${e(contactPhone)}</p>
    <p style="margin:0 0 18px;white-space:pre-wrap"><strong>Optional message:</strong> ${e(message)}</p>
    <div style="margin:0 0 18px;border:2px solid #C6A15B;border-radius:10px;background:#FFF9EC;padding:14px 16px">
      <h3 style="margin:0 0 6px;font-size:13px;color:#7A5417;text-transform:uppercase;letter-spacing:1px">Proposed Consultation Times — Not Confirmed</h3>
      <p style="margin:0 0 6px"><strong>Time zone:</strong> ${e(model.timeZone)}</p>
      <ul style="margin:0 0 8px;padding-left:20px">${preferredTimesHtml}</ul>
      <p style="margin:0;color:#5B4727">These are availability preferences only. No appointment is booked until the visitor receives confirmation.</p>
    </div>
    <h3 style="margin:0 0 8px;font-size:13px;color:#1E6B6B;text-transform:uppercase;letter-spacing:1px">Quiz Summary</h3>
    <p style="margin:0 0 4px"><strong>Result category:</strong> ${e(model.resultCategory)}</p>
    <p style="margin:0 0 4px"><strong>Score band:</strong> ${e(model.scoreBand)}</p>
    <p style="margin:0 0 18px"><strong>Recommended therapist:</strong> ${e(therapistName)}</p>
    <div style="margin:0 0 18px;border-left:4px solid #C6A15B;background:#F7F4EF;padding:14px 16px">
      <h3 style="margin:0 0 8px;font-size:13px;color:#1E6B6B;text-transform:uppercase;letter-spacing:1px">Availability Coordination Request</h3>
      <p style="margin:0 0 4px"><strong>User requested scheduling help:</strong> Yes</p>
      <p style="margin:0 0 4px"><strong>Consent date and time:</strong> ${e(model.consentTimestampLabel)}</p>
      <p style="margin:0 0 4px"><strong>Consent language shown:</strong> ${e(model.consentText)}</p>
      <p style="margin:0"><strong>Consent text version:</strong> ${e(model.consentTextVersion)}</p>
    </div>
    ${operationalStatusHtml(model)}
    <p style="margin:0 0 18px">${submissionHtml(model.referenceId, model.adminUrl)}</p>
    <p style="margin:0;font-size:12px;color:#888780">This message contains personal and quiz information. Handle it under the clinic's privacy policy. This inbox is not monitored continuously and this email is not an emergency alert.</p>
  </div>
</div>`;

  return { subject, text, html };
}

export function buildQuizUserResultsEmail(
  model: QuizUserResultsEmailModel,
): BuiltEmail & { bookingUrl: string } {
  const therapist = model.recommendedTherapistSlug
    ? getTherapistBookingConfig(model.recommendedTherapistSlug)
    : undefined;
  const therapistName =
    therapist?.therapistName ?? model.recommendedTherapistName ?? null;
  const therapistFirstName = therapistName?.split(/\s+/)[0];
  const presentation = getIntentRoutePresentation(
    model.intent,
    therapistFirstName,
    { usesClinicBookingFallback: therapist?.usesClinicFallback },
  );
  const bookingUrl =
    therapist?.consultationBookingUrl ?? CLINIC_JANE_BOOKING_URL;
  const subject = `Your Valisen quiz result and next step`;
  const expectations = presentation.showConsultationExpectations
    ? `\nDuring a consultation you can:\n- Discuss what brought you here\n- Ask about the therapist's approach, availability and fees\n- Decide whether the fit feels right\n`
    : "";

  const text = `Hello ${model.firstName},

${presentation.heading}

${model.resultHeading}

${presentation.supportingCopy}
${expectations}
${presentation.ctaLabel}: ${bookingUrl}
${presentation.ctaHelper}

View your private results again: ${model.privateResultsUrl}
Reference ID: ${model.referenceId}

This quiz is a self-reflection tool, not a diagnosis or clinical assessment. A therapist match is a starting point, not a guaranteed fit.

You received this transactional email because you requested your quiz result and next step. It does not subscribe you to promotional email.`;

  const e = escapeHtml;
  const expectationsHtml = presentation.showConsultationExpectations
    ? `<p style="margin:18px 0 6px;font-weight:600">During a consultation you can:</p>
      <ul style="margin:0 0 20px;padding-left:20px">
        <li>Discuss what brought you here</li>
        <li>Ask about the therapist's approach, availability and fees</li>
        <li>Decide whether the fit feels right</li>
      </ul>`
    : "";
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;color:#2C2C2C;line-height:1.65">
  <div style="background:#1E6B6B;border-radius:12px 12px 0 0;padding:22px 26px;color:#fff">
    <p style="margin:0;font-size:19px;font-weight:600">Valisen Mental Health</p>
    <p style="margin:4px 0 0;color:#D7EAEA;font-size:13px">Your requested quiz result</p>
  </div>
  <div style="border:1px solid #e5e2dc;border-top:0;border-radius:0 0 12px 12px;padding:26px;background:#fff">
    <p style="margin:0 0 14px">Hello ${e(model.firstName)},</p>
    <h1 style="margin:0 0 10px;color:#1E6B6B;font-family:Georgia,serif;font-size:27px;line-height:1.2">${e(presentation.heading)}</h1>
    <p style="margin:0 0 12px;font-weight:600">${e(model.resultHeading)}</p>
    <p style="margin:0 0 18px">${e(presentation.supportingCopy)}</p>
    ${expectationsHtml}
    <p style="margin:24px 0;text-align:center">
      <a href="${e(bookingUrl)}" style="display:inline-block;border-radius:999px;background:#1E6B6B;color:#fff;padding:14px 24px;text-decoration:none;font-weight:700">${e(presentation.ctaLabel)}</a>
    </p>
    <p style="margin:-12px 0 20px;text-align:center;color:#666;font-size:13px">${e(presentation.ctaHelper)}</p>
    <p style="margin:0 0 18px"><a href="${e(model.privateResultsUrl)}" style="color:#1E6B6B;font-weight:600">View your private results again</a></p>
    <p style="margin:0 0 12px;color:#777;font-size:12px">Reference ${e(model.referenceId)}</p>
    <p style="margin:0 0 10px;color:#777;font-size:12px">This quiz is a self-reflection tool, not a diagnosis or clinical assessment. A therapist match is a starting point, not a guaranteed fit.</p>
    <p style="margin:0;color:#777;font-size:12px">You received this transactional email because you requested your quiz result and next step. It does not subscribe you to promotional email.</p>
  </div>
</div>`;

  return { subject, text, html, bookingUrl };
}

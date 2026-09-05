import { escapeHtml } from "@/lib/quizLead";
import { CLINIC_JANE_BOOKING_URL } from "@/lib/therapists";

/** Transactional receipt only: no intake answers or advertising identifiers. */
export function buildConsultationConfirmationEmail(model: {
  firstName: string;
  referenceId: string;
}) {
  const subject = "We've received your consultation request | Valisen";
  const text = `Hello ${model.firstName},

Thank you for requesting a free consultation with Valisen Mental Health.

Our team will contact you within 24 hours to arrange your consultation.

Prefer to book now? Choose a time on Jane, our online booking platform.

View availability on Jane: ${CLINIC_JANE_BOOKING_URL}`;

  const e = escapeHtml;
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;color:#2C2C2C;line-height:1.65">
  <div style="background:#1E6B6B;border-radius:16px 16px 0 0;padding:22px 26px;color:#fff">
    <p style="margin:0;font-size:19px;font-weight:600">Valisen Mental Health</p>
  </div>
  <div style="border:1px solid #e5e2dc;border-top:0;border-radius:0 0 16px 16px;padding:26px;background:#fff">
    <p style="margin:0 0 14px">Hello ${e(model.firstName)},</p>
    <p>Thank you for requesting a free consultation with Valisen Mental Health.</p>
    <p>Our team will <strong>contact you within 24 hours</strong> to arrange your consultation.</p>
    <div style="margin:24px 0;border:1px solid #cfe0da;border-radius:12px;background:#f3f8f5;padding:22px;text-align:center">
      <p style="margin:0 0 18px;font-size:14px"><strong>Prefer to book now?</strong> Choose a time on Jane, our online booking platform.</p>
      <a href="${e(CLINIC_JANE_BOOKING_URL)}" style="display:inline-block;border-radius:999px;background:#1E6B6B;color:#fff;padding:14px 22px;text-decoration:none;font-weight:700">View availability on Jane</a>
    </div>
  </div>
</div>`;

  return { subject, text, html };
}

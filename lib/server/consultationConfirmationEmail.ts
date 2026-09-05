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
  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f3ee">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f3ee">
    <tr><td align="center" style="padding:24px 12px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid #dce5df;border-radius:18px;font-family:Arial,Helvetica,sans-serif;color:#243532;font-size:18px;line-height:29px">
        <tr><td align="center" style="padding:28px 24px;border-bottom:1px solid #dce5df">
          <img src="https://valisenmentalhealth.com/valisen-logo.png" alt="Valisen Mental Health" width="240" style="display:block;width:240px;max-width:100%;height:auto;border:0;color:#1E6B6B;font-size:20px">
        </td></tr>
        <tr><td style="padding:28px 24px;font-size:18px;line-height:29px">
          <p style="margin:0 0 18px;font-size:22px;line-height:30px;font-weight:700">Hello ${e(model.firstName)},</p>
          <p style="margin:0 0 18px">Thank you for requesting a free consultation with Valisen Mental Health.</p>
          <p style="margin:0 0 26px">Our team will <strong style="color:#1E6B6B">contact you within 24 hours</strong> to arrange your consultation.</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f0f7f3;border:1px solid #cfe0da;border-radius:12px">
            <tr><td align="center" style="padding:22px 16px;font-size:18px;line-height:28px">
              <p style="margin:0 0 8px;font-size:20px;line-height:28px;font-weight:700;color:#1E6B6B">Prefer to book now?</p>
              <p style="margin:0 0 20px">Choose a time on Jane, our online booking platform.</p>
              <a href="${e(CLINIC_JANE_BOOKING_URL)}" style="display:block;border-radius:12px;background:#1E6B6B;color:#ffffff;padding:16px 12px;text-decoration:none;font-size:18px;line-height:26px;font-weight:700;text-align:center">View availability on Jane</a>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

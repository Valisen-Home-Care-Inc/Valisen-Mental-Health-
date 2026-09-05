import { escapeHtml } from "@/lib/quizLead";
import { CLINIC_JANE_BOOKING_URL } from "@/lib/therapists";

/** Transactional receipt only: no intake answers or advertising identifiers. */
export function buildConsultationConfirmationEmail(model: {
  firstName: string;
  referenceId: string;
}) {
  const subject = "We've received your consultation request | Valisen";
  const text = `Hello ${model.firstName},

Thank you for reaching out to Valisen Mental Health. Your free consultation request is in.

Our team will reach out within 24 hours to coordinate your consultation. Please watch your email and phone for our response. Your requested time is a preference, not a confirmed appointment, until our team confirms it with you.

Can't wait to take the next step?
Browse available appointments and book directly through Jane, our online booking platform:
${CLINIC_JANE_BOOKING_URL}

Prefer to wait? No further action is needed. We'll still be in touch about your request. If you book through Jane, just let us know when we contact you.

Questions? Reply to this email or call 613-707-0333.

Warmly,
The Valisen Mental Health team

Reference: ${model.referenceId}
You received this confirmation because you submitted a consultation request. It does not subscribe you to promotional emails.`;

  const e = escapeHtml;
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;color:#2C2C2C;line-height:1.65">
  <div style="background:#1E6B6B;border-radius:16px 16px 0 0;padding:22px 26px;color:#fff">
    <p style="margin:0;font-size:19px;font-weight:600">Valisen Mental Health</p>
    <p style="margin:4px 0 0;color:#D7EAEA;font-size:13px">Your consultation request</p>
  </div>
  <div style="border:1px solid #e5e2dc;border-top:0;border-radius:0 0 16px 16px;padding:26px;background:#fff">
    <p style="margin:0 0 14px">Hello ${e(model.firstName)},</p>
    <h1 style="margin:0 0 14px;color:#1E6B6B;font-family:Georgia,serif;font-size:28px;line-height:1.2">Your next step starts here.</h1>
    <p>Thank you for reaching out to Valisen Mental Health. Your free consultation request is in.</p>
    <p><strong>Our team will reach out within 24 hours</strong> to coordinate your consultation. Please watch your email and phone for our response.</p>
    <p style="color:#555;font-size:14px">Your requested time is a preference, not a confirmed appointment, until our team confirms it with you.</p>
    <div style="margin:24px 0;border:1px solid #cfe0da;border-radius:12px;background:#f3f8f5;padding:22px;text-align:center">
      <h2 style="margin:0 0 10px;color:#1E6B6B;font-family:Georgia,serif;font-size:23px;line-height:1.3">Can’t wait to take the next step?</h2>
      <p style="margin:0 0 18px;font-size:14px">Browse available appointments and book directly through Jane, our online booking platform.</p>
      <a href="${e(CLINIC_JANE_BOOKING_URL)}" style="display:inline-block;border-radius:999px;background:#1E6B6B;color:#fff;padding:14px 22px;text-decoration:none;font-weight:700">View availability on Jane</a>
    </div>
    <p>Prefer to wait? No further action is needed. We’ll still be in touch about your request. If you book through Jane, just let us know when we contact you.</p>
    <p>Questions? Reply to this email or call <a href="tel:613-707-0333" style="color:#1E6B6B">613-707-0333</a>.</p>
    <p>Warmly,<br>The Valisen Mental Health team</p>
    <p style="margin:24px 0 8px;color:#666;font-size:12px">Reference: ${e(model.referenceId)}</p>
    <p style="margin:0;color:#666;font-size:12px">You received this confirmation because you submitted a consultation request. It does not subscribe you to promotional emails.</p>
  </div>
</div>`;

  return { subject, text, html };
}

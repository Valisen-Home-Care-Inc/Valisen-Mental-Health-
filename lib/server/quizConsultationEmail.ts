import { escapeHtml } from "@/lib/quizLead";
import type { QuizConsultationSlot } from "@/lib/quizConsultation";

export function buildQuizConsultationBookingEmail(firstName: string, slot: QuizConsultationSlot) {
  return {
    subject: "Your 20-minute consultation is booked | Valisen",
    text: `Hello ${firstName},\n\nYour free 20-minute phone consultation with Valisen Mental Health is booked.\n\n${slot.label}\n\nWe'll call the phone number you provided. To change or cancel, reply to this email.\n\nValisen Mental Health`,
    html: `<div style="max-width:600px;margin:0 auto;padding:24px;font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:1.6;color:#243532;background:#ffffff;border:1px solid #dce5df;border-radius:18px">
      <img src="https://valisenmentalhealth.com/valisen-logo.png" alt="Valisen Mental Health" width="240" style="display:block;max-width:100%;height:auto;margin:0 auto 28px">
      <p>Hello ${escapeHtml(firstName)},</p>
      <p>Your free <strong>20-minute phone consultation</strong> with Valisen Mental Health is booked.</p>
      <p style="padding:18px;background:#f0f7f3;border-radius:12px;color:#1e6b6b;font-weight:700">${escapeHtml(slot.label)}</p>
      <p>We'll call the phone number you provided. To change or cancel, reply to this email.</p>
    </div>`,
  };
}

import { formatPreferredSlotLabel, getAvailableTimeSlotsForDate, type ConsultationAvailability } from "@/lib/consultation";

export const QUIZ_BOOKING_CONSENT_VERSION = "quiz-consultation-booking-v1";
export const QUIZ_BOOKING_CONSENT_TEXT = "I agree that Valisen Mental Health may use the contact details I already provided to book and contact me about my free 20-minute phone consultation at the selected time.";

export type QuizConsultationSlot = { date: string; time: string; label: string; availability: ConsultationAvailability };

/** All quiz appointment dates are interpreted in Toronto, not the browser/server timezone. */
export function torontoCalendarToday(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => Number(parts.find((entry) => entry.type === type)?.value);
  return new Date(part("year"), part("month") - 1, part("day"));
}

export function parseQuizConsultationSlot(date: unknown, time: unknown, now = new Date()): QuizConsultationSlot | null {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || typeof time !== "string") return null;
  const [year, month, day] = date.split("-").map(Number);
  const candidate = new Date(year, month - 1, day);
  if (candidate.getFullYear() !== year || candidate.getMonth() !== month - 1 || candidate.getDate() !== day) return null;
  const today = torontoCalendarToday(now);
  const end = new Date(today);
  end.setDate(end.getDate() + 30);
  if (candidate <= today || candidate > end) return null;
  const slot = getAvailableTimeSlotsForDate(date).find((entry) => entry.time === time);
  return slot ? { date, time, availability: slot.availability, label: `${formatPreferredSlotLabel(date, time)}, ${year} (Toronto time)` } : null;
}

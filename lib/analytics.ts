/**
 * Meta- and Google-safe funnel tracking.
 *
 * Pushes ONLY generic funnel events to the GTM dataLayer. Deliberately never
 * transmits: the result category, individual answers, dimension scores,
 * safety responses, free text, or any health signal tied to a person.
 *
 * Anything sensitive stays first-party (the lead email + Google Sheet).
 */

export type QuizEvent =
  | "quiz_page_viewed"
  | "quiz_started"
  | "quiz_progressed"
  | "quiz_completed"
  | "results_access_submitted"
  | "results_viewed"
  | "recommended_therapist_displayed"
  | "therapist_contact_requested"
  | "consultation_clicked"
  | "therapist_directory_clicked"
  | "booking_clicked";

type DataLayerWindow = Window & { dataLayer?: Record<string, unknown>[] };

/**
 * @param event  one of the whitelisted generic funnel events
 * @param step   optional non-sensitive step index (a number only — never an answer)
 */
export function trackQuizEvent(event: QuizEvent, step?: number) {
  if (typeof window === "undefined") return;
  const w = window as DataLayerWindow;
  w.dataLayer = w.dataLayer || [];
  const payload: Record<string, unknown> = { event };
  if (typeof step === "number") payload.quiz_step = step;
  w.dataLayer.push(payload);
}

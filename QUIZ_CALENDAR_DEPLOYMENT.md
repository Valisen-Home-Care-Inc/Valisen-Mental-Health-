# Quiz calendar and results engagement

## Before deployment

Run `supabase/migrations/20260907000000_quiz_result_engagement.sql`, followed by `supabase/migrations/20260909000000_consultation_slot_bookings.sql`, in the Supabase SQL editor. The second migration adds the service-role-only shared booking ledger and atomic slot functions used by both `/welcome` and `/quiz`. Both migrations are transactional and safe to rerun.

Deploy both migrations before the application. Without the engagement migration, post-result activity is not saved. Without the slot-booking migration, the calendars intentionally fail closed rather than risk accepting duplicate appointments.

## Booking operation

- Quiz version 6.0 has 12 therapist-matching screens covering support type, concerns, goals, therapy history, therapist style, gender preference, cultural considerations, language, availability, desired start timing, and payment/insurance readiness. It has no age or residency question and no symptom/wellness score questions. Existing saved results remain readable.
- Required matching selections are validated on both the page and server. Concern, goal, and therapist-style questions accept up to three choices; undecided/private choices cannot be combined with conflicting answers. The primary concern must come from the concerns selected on the previous screen.
- The results page shows the two therapist recommendations and the shared consultation calendar. The former score, detailed wellness breakdown, and PDF action are removed.
- New results include the strongest eligible match and the strongest eligible therapist of the other roster-recorded gender. Unavailable therapists are never invented to fill a card.
- `/welcome` and `/quiz` use one shared Toronto-time booking ledger. A specific appointment claimed on either page is disabled and labelled “Booked” on both pages; an atomic database claim prevents race-condition duplicates. `/welcome` retains its flexible-time request branch, which does not claim an appointment.
- Existing saved quiz contact details are verified by the server and reused; there are no repeat contact fields. Consent and bot verification are still required.
- Once a slot is claimed and the CRM saves the consultation, the CRM conversion stage becomes “Consultation booked.” The visitor receives the existing 20-minute appointment confirmation email. The clinic receives a high-priority `ACTION REQUIRED` email that clearly identifies the official date and time.
- **Valisen remains responsible for adding the appointment to its operational calendar and honouring the call.** The website prevents duplicate website bookings, but it does not create a Jane appointment or detect bookings made outside these two website calendars.
- A visitor-email delivery failure is logged without undoing the already-saved consultation or clinic notification. This uses the existing Gmail credentials, with replies directed to the clinic inbox.

## Results analytics

The quiz CRM has an “After submission” panel with active/elapsed time, maximum scroll depth, sections seen, last section seen, and counts for calendar selection, consent changes, booking attempts/errors/completion, profile clicks and restart. Tracking starts only on saved results. No answers, DOM text, selected appointment dates/times or contact details enter these summaries.

Active time excludes hidden tabs and pauses after 60 seconds without interaction. Summaries flush periodically and on exit; browser blocking or abrupt termination can prevent the final update. Repeated or out-of-order updates do not inflate the totals. Known test leads are excluded. Reports use the start time of each results view within the selected reporting range, and display the latest 100 visitors. The existing JSON export includes de-identified result summaries, not submission references.

Old and current quiz positions differ at Q17–Q19; the aggregate question chart labels both versions rather than relabelling historical activity.

## Verification

### Calendar and results visual refresh

The shared `/welcome` and quiz-results calendar uses the site's sage/cream styling, clearer date controls, a compact scrollable list, and live booked-slot states.

Quiz results display the female therapist first without changing the saved strongest match or its reasons. Phones use swipeable cards with accessible previous/next controls; larger screens show both cards. The page discreetly clarifies that the two recommendations come from Valisen's broader therapist team.

### Checks

- `npm test`
- `npm run typecheck`
- `npm run lint`
- With a local dev server: `npm run test:quiz-calendar-ui` (defaults to `http://127.0.0.1:3010`; use `SITE_URL` to override). Checks 320/375/390/768/1024/1440px layouts, female-first display, touch swipes and keyboard controls, calendar selection, the `/welcome` flexible-time option, consent, booking retries, and privacy-safe result metrics. Uses mocked APIs and blocks external requests; sends no real leads or emails. Screenshots go to a temporary directory.
- Optional isolated SQL check: `node scripts/quiz-result-engagement-sql-qa.cjs <path-to-@electric-sql/pglite>`.

`test:quiz-ui` and `test:quiz-calendar-ui` both exercise the current flow. The older `scripts/quiz-flow-smoke.mjs` is retained as a legacy test of the retired 19-question/contact-help layout.

# Quiz calendar and results engagement

## Before deployment

Run `supabase/migrations/20260907000000_quiz_result_engagement.sql` in the Supabase SQL editor. It adds a separate, service-role-only results-engagement table and two RPC functions; it does not change existing quiz records or CRM stages. The migration is transactional and safe to rerun.

Without the migration, the quiz and booking still work, but results engagement is not saved and its CRM panel reports that it is unavailable. Deploy the migration before the application to avoid a reporting gap. Historical visits cannot acquire metrics retroactively.

## Booking operation

- Quiz version 5.1 has 18 screens: gender preference is removed. Existing saved results remain readable. New results include the strongest eligible match and the strongest eligible therapist of the other roster-recorded gender. Unavailable therapists are never invented to fill a card.
- The embedded calendar reuses `/welcome`'s preset weekday times. Dates are explicitly Toronto time, tomorrow through 30 days ahead. The quiz requires a specific date and time; it does not offer the flexible-time branch.
- Existing saved quiz contact details are verified by the server and reused; there are no repeat contact fields. Consent and bot verification are still required.
- Once the CRM saves the consultation and the clinic notification succeeds, the visitor sees a booking confirmation and is sent a 20-minute phone-consultation email. The clinic notification contains the selected date/time and a prominent instruction to manually schedule and fulfil it.
- **Valisen is responsible for manually scheduling and honouring these appointments.** There is no Jane reservation, live availability check, calendar sync or automatic double-booking prevention. This is the staff-managed preset workflow approved for this change.
- The existing CRM request/notification workflow is retained. Staff still manage confirmed-booking/completion stages; a browser click never becomes a staff-confirmed CRM stage automatically. The new engagement panel separately shows completed website booking submissions.
- A visitor-email delivery failure is logged without undoing the already-saved consultation or clinic notification. This uses the existing Gmail credentials, with replies directed to the clinic inbox.

## Results analytics

The quiz CRM has an “After submission” panel with active/elapsed time, maximum scroll depth, sections seen, last section seen, and counts for calendar selection, consent changes, booking attempts/errors/completion, profile clicks, detail expansion, PDF clicks and restart. Tracking starts only on saved results. No answers, DOM text, selected appointment dates/times or contact details enter these summaries.

Active time excludes hidden tabs and pauses after 60 seconds without interaction. Summaries flush periodically and on exit; browser blocking or abrupt termination can prevent the final update. Repeated or out-of-order updates do not inflate the totals. Known test leads are excluded. Reports use the start time of each results view within the selected reporting range, and display the latest 100 visitors. The existing JSON export includes de-identified result summaries, not submission references.

Old and current quiz positions differ at Q17–Q19; the aggregate question chart labels both versions rather than relabelling historical activity.

## Verification

### Calendar and results visual refresh

The shared `/welcome` and quiz-results calendar now uses the site's sage/cream styling, clearer date controls, and a compact scrollable list containing all the original time slots. Booking rules, consent, submissions, email delivery, and CRM tracking are unchanged.

Quiz results display the female therapist first without changing the saved strongest match or its reasons. Phones use swipeable cards with accessible previous/next controls; larger screens show both cards. The full result breakdown and match explanations expand on demand. No additional database migration or configuration is required for this visual refresh.

### Checks

- `npm test`
- `npm run typecheck`
- `npm run lint`
- With a local dev server: `npm run test:quiz-calendar-ui` (defaults to `http://127.0.0.1:3010`; use `SITE_URL` to override). Checks 320/375/390/768/1024/1440px layouts, female-first display, touch swipes and keyboard controls, expandable details, calendar selection, the `/welcome` flexible-time option, consent, booking retries, and privacy-safe result metrics. Uses mocked APIs and blocks external requests; sends no real leads or emails. Screenshots go to a temporary directory.
- Optional isolated SQL check: `node scripts/quiz-result-engagement-sql-qa.cjs <path-to-@electric-sql/pglite>`.

`test:quiz-ui` and `test:quiz-calendar-ui` both exercise the current flow. The older `scripts/quiz-flow-smoke.mjs` is retained as a legacy test of the retired 19-question/contact-help layout.

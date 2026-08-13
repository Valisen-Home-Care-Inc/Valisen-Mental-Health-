# Valisen Quiz-to-Consultation System

This document describes quiz version `5.0.0`: the self-reflection score,
therapist matching, intent-adaptive results, consultation-request journey, private
result delivery, optional contact help, persistence, email, and analytics.

The primary conversion is an internal click to the consultation-request form,
with the matched therapist preselected when available. Jane remains an
explicitly secondary self-scheduling route. Neither a consultation request nor
a Jane click is treated as a confirmed appointment.

## User journey

1. **Quiz (`/quiz`)**: 19 one-question screens: an opener, 12 scored
   reflection questions, duration and impact context, an optional concerns
   multi-select, an optional therapist-gender preference, the safety check,
   and the required intent question. The intent question is last, immediately
   after safety.
2. **Safety handling**: a concerning safety answer pauses the quiz and presents
   crisis resources. The safety answer remains in the browser and is removed
   before any API, email, persistence, or analytics request.
3. **Results-access gate**: first name, email, and phone are required, along
    with an unchecked, versioned privacy acknowledgement. The acknowledgement
    permits Valisen to save and deliver the requested result; authorizes
    Valisen's authorized staff and the recommended or matched therapist to
    contact the visitor by email, phone, or text about the result, match,
    consultations, scheduling, and related Valisen therapy services; and
    authorizes Valisen to share contact details and the relevant quiz summary
    with that therapist for those purposes. It does not authorize sale of the
    information or unrelated promotional marketing.
    The browser submits the exact displayed wording and version; the server
    rejects a missing or stale pair instead of recording newer consent against
    an older page that was already open.
4. **Authoritative save**: `POST /api/quiz-lead` validates a complete v5 answer
   set, rejects retired/unknown fields, recalculates the score and match on the
   server, and claims a service-role-only Supabase registry row before touching
   Google Sheets. The registry assigns one stable `VQ-*` reference per client
   submission ID and fingerprints the immutable result payload. A fenced lease
   serializes the Sheet append across serverless instances; a retry reconciles
   an already-appended row by its stable reference instead of appending a
   duplicate. The API then returns that reference plus an opaque private-result
   token.
5. **Transactional email attempts**: after persistence, the API independently
   attempts an internal administrative summary and a visitor results email.
   Email failure produces a warning but does not invalidate or hide an
   already-saved result.
6. **Intent-adaptive result**: one reusable results component changes its
   hierarchy and CTA wording for the selected intent. Intent does not change
   the score or therapist match. Every route keeps one dominant consultation-request CTA above
   the detailed score explanation.
7. **Consultation request**: the primary CTA opens `/consultation` with the
   matched therapist preselected. A mobile sticky CTA appears only after the
   original CTA has scrolled above the viewport and is hidden while contact
   help is open.
8. **Contact-help fallback**: “Can’t find a suitable time? Share your time
   options” expands a secondary form that reuses the saved contact details and
   collects two to four exact future local dates/times plus the browser's
   recognized time zone. After the visitor completes it, a calm confirmation
   dialog first offers **Choose a Time in Jane Now**; the visitor can instead
   send the proposed times. The options are scheduling preferences, not a
   booked appointment, until Valisen or the therapist confirms one.
9. **Private return path**: the visitor email links to
   `/quiz#result=<opaque-token>`. The browser restores the minimum result view
   through a JSON-body `POST /api/quiz-lead/result`; refreshes in the same
   browser session also use the saved session token. Restoration never places
   the capability in an API URL.
10. **Private PDF**: the very bottom of the results journey offers
    **Download My Results PDF**. The browser sends the opaque capability token
    only in the JSON body of `POST /api/quiz-lead/pdf`; the server creates the
    PDF on demand and returns a `no-store` attachment. The token never appears
    in the PDF URL.

## Intent routing

The persisted intent enum and its human-readable answer are defined in
`lib/quizIntent.ts`. The page and visitor email use the same presentation
function so their CTA wording cannot drift.

| Intent enum | Result hierarchy | Primary CTA |
| --- | --- | --- |
| `ready_to_speak` | Booking and compact matched-therapist card first | **Request My Free Consultation** |
| `brief_consultation` | Consultation explanation and expectations first | **Request a Consultation with {first name}** |
| `see_recommended_therapist` | Therapist profile and factual match reasons first | **Request a Consultation with {first name}** |
| `exploring` | Short result snapshot, then a gentle matched-therapist bridge | **Request a Free Consultation** |

All four routes:

- retain the same server-calculated result and deterministic match;
- place the matched consultation CTA before the long score breakdown;
- explain that Valisen coordinates the request and confirmation;
- keep the therapist directory, alternative therapists, and retake action
  visually below the primary journey;
- use progressive disclosure for detailed dimension results;
- suppress competing generic booking actions in the results header; and
- avoid diagnosis, guaranteed fit, guaranteed outcomes, real-time availability,
  or other unverified claims.

## Scoring and matching

- `QUIZ_VERSION` is `5.0.0`; `SCORING_VERSION` remains independently versioned.
- Intent is required for a completed v5 submission but is deliberately omitted
  from both `scoreQuiz` and `matchTherapist`.
- The overall Check-In Score runs from 20 to 98. **Higher means the answers
  reflect greater steadiness; lower means more reported strain.**
- Dimension averages run from 0 to 3 in the opposite direction:
  **higher means that concern appeared more often in the answers.**
- `answeredCount` discloses how many of the 12 scored questions contributed.
  If all scored questions are skipped, the score is `null` and the result says
  there is not enough information for a clear snapshot; it does not imply that
  the visitor is doing well.
- The score is an educational reflection, not a diagnosis, clinical
  assessment, or promise of treatment outcome.
- Matching uses selected concerns, present result dimensions, optional
  therapist-gender preference, accepting-new-client status, and the centralized
  verified booking configuration.
- Matching is deterministic. Ties use the explicit stable order in
  `lib/matching.ts`, not the public therapist-grid order.
- The strongest eligible therapist is always recommended. If the answers do
  not separate the roster, the engine uses its documented stable order and
  frames the result as a starting point to confirm during the free consultation.

Scoring thresholds, result language, matching weights, and therapist metadata
still require Valisen's clinical and operational approval.

## Centralized Jane configuration

`lib/therapistBooking.ts` is the only source of therapist booking destinations
and consultation facts used by matching, results, and visitor email.

| Therapist ID | Verified consultation destination | Status |
| --- | --- | --- |
| `ryann-simpson` | `https://valisenmentalhealth.janeapp.com/#/staff_member/8` | Verified staff link |
| `wilfred-bengnwi` | `https://valisenmentalhealth.janeapp.com/#/staff_member/6` | Verified staff link |
| `meryem-ibrahim` | `https://valisenmentalhealth.janeapp.com/#/staff_member/9` | Verified staff link |
| `tim-kahtava` | `https://valisenmentalhealth.janeapp.com/#/staff_member/5` | Verified staff link |
| `dayong-quan` | `https://valisenmentalhealth.janeapp.com/#/staff_member/7` | Verified staff link |

The configuration also carries the stable therapist ID/name, profile path,
service format, languages, and only explicitly verified consultation facts.
At the time of this implementation it records a free, 20-minute phone
consultation for each therapist. These business facts must be reconfirmed
before launch and updated centrally if they change.

Jane URL validation requires HTTPS and the exact
`valisenmentalhealth.janeapp.com` host; lookalike prefix domains are rejected.
No email, phone, score, result category, concern, written message, or private
result token is added to a Jane URL. The current implementation does not append
campaign attribution parameters to Jane.

There is no Jane webhook, appointment API, or reliable booking callback in
this repository. `jane_booking_clicked` means only that the visitor clicked an
outbound link. There is no `booking_confirmed` field or event.

## Results access and private restoration

The results gate and the contact-help form serve different purposes:

- **Results access** requires first name, email, phone, and the versioned
  privacy acknowledgement.
- This acknowledgement authorizes purpose-limited contact by Valisen's
  authorized staff and the recommended or matched therapist through email,
  phone, or text, and purpose-limited sharing of contact details and the
  relevant quiz summary with that therapist.
- The authorized purposes are the quiz result, therapist match, consultations,
  scheduling, and related Valisen therapy services. The acknowledgement
  expressly excludes information sale and unrelated promotional marketing.
- The API accepts the acknowledgement only when its exact submitted wording
  and version match the current form. Stored legacy or inconsistent records
  are marked for manual consent review and are not automatically described as
  authorizing therapist contact or disclosure.
- **Contact help** reuses the already-saved name, email, and mandatory phone.
  The in-memory post-submission view pre-fills the phone for phone/text; after a
  private-link restore, the API securely falls back to the phone already stored
  with the lead when the browser does not have it.
- **Consultation handoff** stages the in-memory first name, email, mandatory
  phone, and opaque result capability in a short-lived, one-time same-tab
  `sessionStorage` record only when a visitor clicks the consultation CTA. The
  consultation form consumes and deletes it on arrival. The server verifies
  the capability before linking the quiz and consultation references. No
  contact detail or capability is added to the URL or analytics.

The lead must be durably saved before the result is revealed. The returned raw
submission token is kept in browser `sessionStorage`; only its hash is stored
in the worksheet. The visitor email carries the token in the URL fragment
`#result=...`. Before analytics loads, the browser moves that token into
session storage and removes the fragment from the visible URL. It then sends
the token only as `{ submissionToken }` in the JSON body of
`POST /api/quiz-lead/result`.

The restoration endpoint is POST-only, rejects query strings, non-JSON bodies,
and extra fields, and is rate-limited and `no-store`. Its response returns
only:

- first name and internal reference;
- server-calculated outcome and match;
- intent;
- whether contact help was successfully sent; and
- the narrow, cleaned campaign attribution object.

It never returns the visitor's email, phone, raw answers, consent text, or
notification internals. The private URL is still a capability link and should
not be forwarded casually.

Browser session keys are:

- `valisen.quiz.resultToken`;
- `valisen.quiz.safetyFlagged`; and
- `valisen.quiz.attribution`.

`valisen.quiz.safetyFlagged` is only a derived true/false value used to retain
the appropriate restored-result safety message during the browser session.
The raw safety answer is never sent to Valisen or analytics and is never
persisted in browser storage.

Retaking the quiz clears the private-result and local safety state. If browser
storage is unavailable, the current in-memory result remains usable but
automatic same-session restoration may not be.

## Contact-help scheduling acknowledgement and form

The exact-time help form is secondary to the main consultation request and is not opened or submitted
automatically. It collects:

- preferred contact method: `phone`, `text`, or `email`;
- the saved phone for phone/text, with an optional valid override;
- two to four distinct future local date/time values in strict
  `YYYY-MM-DDTHH:mm` form;
- the browser's recognized IANA time zone;
- an optional message, capped and sanitized; and
- a separate, unchecked scheduling acknowledgement:

> I understand that the proposed times I provide are preferences, not
> confirmed appointments. I ask Valisen and my matched therapist to coordinate
> with me about these times using my selected contact method. I understand
> that an appointment is booked only after I receive confirmation.

The form first presents a calm choice to book directly in Jane or continue
with the help request. Continuing posts the opaque submission token, form
fields, and exact versioned consent to
`POST /api/quiz-lead/contact-consent`.

The server validates the proposed local times against the submitted IANA time
zone, including daylight-saving gaps/ambiguities, and accepts only two to four
distinct future options within 365 days. It records the method, resolved phone,
exact options, time zone, optional message, acknowledgement timestamp, exact
copy, and copy version before claiming the notification. Only the configured
internal Valisen inbox is emailed directly by the website. Claim IDs, leases,
revision-aware stable Message-IDs, and a keyed process lock reduce duplicate
sends while leaving failed requests retriable. A visitor may edit a request
after a definite delivery failure; the retry persists and sends those latest
choices with a new revision ID. Only a stale in-flight claim preserves its
original payload, because SMTP delivery may be ambiguous in that state.

## Email behavior

Three transactional email paths exist:

1. **Internal results summary**: sent to `QUIZ_LEAD_TO_EMAIL` after a new result
   is persisted. It includes name, email, required phone, result category and
   score band, recommended therapist, human-readable intent, internal
   reference, safe campaign attribution, a conservative 1–10 lead-heat rating,
   and a snapshot of results/match views,
   Jane clicks, CTA placement, and contact-help status. It prominently records
   the initial Valisen/therapist contact and sharing authorization and its
   exclusions only when both the stored copy and version exactly match the
   current authorization. Legacy or inconsistent records instead carry a
   prominent manual-review warning. The email includes a privacy-limited PDF
   summary. Lead heat uses declared intent and observed booking actions only:
   quiz completion, phone availability, a Jane click, an explicit booking-help
   request, and exact proposed times. Symptom severity and auto-recorded
   result/match views earn zero points. A 10/10 requires every strongest signal
   and still does not mean a booking is confirmed.
2. **Visitor results email**: sent to the submitted email address. It delivers
   the requested result heading, the same intent-adaptive CTA language as the
   page, the matched therapist's preselected consultation-request destination, and the private
   return link. It is transactional and does not subscribe the visitor to
   promotional email.
3. **Internal contact-help request**: sent only after the separate scheduling
   acknowledgement. It includes the requested contact method, resolved phone,
   two to four exact proposed times and their time zone, optional message,
   result/match context, intent, attribution, engagement snapshot, exact
   scheduling acknowledgement, internal reference, and a PDF summary. The
   email marks the proposed times **not confirmed** and never calls them a
   booking.

The internal results summary is a snapshot at its send time, not a live
dashboard; a Jane click that happens later is persisted on the lead row but
does not retroactively change an already-delivered email.

Each email path has its own persistent pending/sending/sent/failed claim and
attempt state. The internal and visitor result-email claims are authoritative in
Supabase and use a lease plus fenced completion token across serverless
instances; their Sheet columns are a reconciliation mirror. Contact-help uses
the corresponding durable consultation-request claim. A saved result remains
available if either initial email fails. SMTP still cannot guarantee
mathematical exactly-once delivery if the provider accepts a message and the
process dies before either durable completion marker is written, so operators
should use the internal reference when resolving rare delivery ambiguity.

## Campaign attribution

`lib/campaignAttribution.ts` captures first-touch attribution once per browser
session. Only these landing-page parameters are accepted:

- `utm_source` → `source`;
- `utm_medium` → `medium`;
- `utm_campaign` → `campaign`; and
- `utm_content` → `content`.

Values are control-character stripped, whitespace normalized, trimmed, and
capped at 120 characters. The API applies a strict key allow-list; unknown
keys or non-string values are rejected at the persistence boundary.

Search terms (`utm_term`), advertising click identifiers (`gclid`, `fbclid`,
`msclkid`), contact data, quiz responses, scores, concern names, and written
messages are not campaign attribution. They are neither captured into this
object nor sent to Jane.

## Analytics and first-party engagement

The quiz uses the site's existing `window.dataLayer` architecture through
`lib/analytics.ts`; it does not install a second analytics or pixel stack.

Browser data-layer events are:

- `quiz_started`;
- `quiz_question_viewed`;
- `quiz_question_answered`;
- `quiz_back_clicked`;
- `quiz_access_form_viewed`;
- `quiz_completed`;
- `quiz_intent_selected`;
- `lead_details_submitted`;
- `results_viewed`;
- `therapist_match_viewed`;
- `consultation_request_clicked`;
- `jane_booking_clicked`;
- `contact_help_opened`; and
- `contact_help_submitted`.

The implementation also emits the existing supporting events
`quiz_page_viewed`, `quiz_progressed`, and
`therapist_directory_clicked`.

The analytics API has no generic property escape hatch. Depending on the
event, it can emit only quiz step, therapist ID, allow-listed CTA placement,
submission reference, safe campaign source/medium/name/content, and device
category. The selected Q19 intent is a fixed four-value enum sent only on the
dedicated `quiz_intent_selected` event to Valisen's first-party collector; the
enum is deliberately omitted from GTM/dataLayer.
It cannot represent answers, scores, result/concern categories, safety
responses, written messages, names, email addresses, or phone numbers.

Jane CTA placements are stable and allow-listed:

- `results_primary`;
- `mobile_sticky`; and
- `contact_help_dialog`.

Separately, `POST /api/quiz-lead/engagement` persists these non-sensitive
events against the private result token:

- `results_viewed`;
- `therapist_match_viewed`;
- `jane_booking_clicked` with required CTA placement; and
- `contact_help_opened`.

The endpoint accepts only `{ submissionToken, event, ctaPlacement? }`.
Contact-help completion is represented by the separately consented form record,
while the browser also emits `contact_help_submitted` to the data layer.

## Persistence model

Quiz payload records use a dedicated Google Sheets worksheet (default:
**Quiz Leads**) through the existing service account. They never mix with
general intake rows. The worksheet remains the payload store during this
transition, but it is no longer the cross-instance uniqueness or delivery-lock
authority.

Supabase contains three service-role-only, privacy-separated structures:

- `quiz_result_submissions` maps one client submission ID to one stable `VQ-*`
  reference, an immutable SHA-256 payload fingerprint, Sheet reconciliation
  state/row number, and a fenced storage lease. It contains no contact details,
  answers, score, safety response, or free text.
- `quiz_result_email_deliveries` stores one durable claim per `VQ-*` reference
  and delivery kind (`internal_results` or `visitor_results`). It contains only
  operational delivery state, lease tokens, attempts, and timestamps.
- `quiz_lead_links` stores the `VQ-*` reference, quiz/scoring versions,
  anonymous funnel session and attempt, intent, and recommended therapist. It
  powers `/admin/checkpoints/quiz` without mixing anonymous behavior with the
  consented Sheet payload.

Persistence is append-oriented in two distinct ways:

- each new, non-duplicate quiz submission uses `INSERT_ROWS`; and
- schema migrations only append recognized trailing headers. They never
  rename, reorder, or rewrite existing columns.

The original 29-column lead schema (`A:AC`) remains the fixed prefix. The six
existing internal-results notification columns (`AD:AI`) remain untouched.
Version 5 appends conversion and visitor-email fields after `AI`, including:

- intent and safe campaign attribution;
- results-viewed, therapist-match-viewed, Jane-click, and contact-help-opened
  timestamps/counts;
- the allow-listed Jane CTA placement;
- contact method, resolved phone, legacy coarse preferred-time field, and
  message; and
- six independent visitor-results-email delivery-state fields.

The exact-time scheduling update appends two more recognized trailing columns,
bringing the current schema to 58 columns:

- `Preferred Contact Times JSON`; and
- `Preferred Contact Time Zone`.

The legacy `Preferred Contact Time` column remains in place for backward
readability and is not reused for the new exact-time values.

An exact 29-column, 35-column, or partially migrated known prefix is expanded
only with its missing trailing headers. Any renamed, reordered, or otherwise
incompatible header row fails closed. Existing rows are not moved. Later
engagement, consent, and email status changes update only their designated
cells in the original lead row; “append-only schema” does not mean those
operational state cells are immutable.

For backward readability, a row without the v5 conversion columns defaults to
intent `exploring`, zero engagement counts, empty attribution, and visitor
email state `not_applicable`.

The worksheet contains personal and mental-health-related information. Limit
access to the service account and authorized Valisen staff, use filtered views
instead of manual row reordering, and follow the clinic-approved retention and
deletion schedule.

## Files that matter

| Concern | File |
| --- | --- |
| Questions, score direction, result copy, versions | `lib/quiz.ts` |
| Intent enum, labels, and shared route/email presentation | `lib/quizIntent.ts` |
| Therapist roster and verified matching metadata | `lib/therapists.ts` |
| Matching weights, threshold, and stable tie order | `lib/matching.ts` |
| Central Jane destinations and consultation facts | `lib/therapistBooking.ts` |
| Narrow campaign capture and cleaning | `lib/campaignAttribution.ts` |
| Access/contact/engagement contracts and validation | `lib/quizLead.ts` |
| Quiz state, submission, session restoration | `components/quiz/QuizFlow.tsx` |
| Results-access gate | `components/quiz/ResultsAccessForm.tsx` |
| Intent-adaptive results, Jane CTAs, contact fallback | `components/quiz/ResultsReveal.tsx` |
| Result save and internal/user email delivery | `app/api/quiz-lead/route.ts` |
| Body-only private result restoration | `app/api/quiz-lead/result/route.ts` |
| First-party engagement persistence | `app/api/quiz-lead/engagement/route.ts` |
| Contact-help scheduling request and notification | `app/api/quiz-lead/contact-consent/route.ts` |
| Private on-demand results PDF | `app/api/quiz-lead/pdf/route.ts` |
| Durable worksheet store and schema migration | `lib/server/quizLeadStore.ts` |
| Protected failed-submission recovery registry | `supabase/migrations/20260812000000_quiz_submission_recovery.sql` |
| Internal tester flags and statistics exclusions | `supabase/migrations/20260814000000_quiz_test_data_flags.sql` |
| Transactional email builders | `lib/server/quizLeadEmail.ts` |
| Privacy-limited PDF summary generator | `lib/server/quizSummaryPdf.ts` |
| Existing data-layer event adapter | `lib/analytics.ts` |
| Focused tests | `lib/__tests__/*.test.ts` |

## Configuration

See `.env.example`.

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, and
  `GOOGLE_SHEET_ID`: required for quiz persistence and the existing general
  intake integration.
- `SUPABASE_URL` plus `SUPABASE_SECRET_KEY` (or the legacy
  `SUPABASE_SERVICE_ROLE_KEY`): required for the stable quiz registry,
  cross-instance Sheet lease, delivery claims, funnel attribution, and CRM.
- `QUIZ_LEADS_SHEET_NAME`: optional dedicated worksheet name; defaults to
  `Quiz Leads`.
- `QUIZ_LEAD_TOKEN_SECRET`: production HMAC secret for opaque private-result,
  engagement, contact-help, and PDF capability tokens. Generate a long random
  value. `GOOGLE_PRIVATE_KEY` is only a compatibility fallback.
- `GMAIL_USER` and `GMAIL_APP_PASSWORD`: required for the internal results
  summary, visitor transactional result, consented contact-help notification,
  and existing intake email.
- `QUIZ_LEAD_TO_EMAIL`: internal recipient for the administrative result and
  consented contact-help emails; defaults to
  `info@valisenmentalhealth.com`.
- `QUIZ_LEAD_ADMIN_URL`: optional HTTPS internal link/template containing
  `{referenceId}`.
- `NEXT_PUBLIC_SITE_URL`: public origin used to build the visitor's private
  `/quiz#result=...` link; defaults to
  `https://valisenmentalhealth.com`.

Jane destinations are code configuration, not environment variables.
Analytics uses the existing data layer and needs no additional quiz-specific
key. There is intentionally no Jane webhook or booking-confirmation secret.
Quiz scoring and therapist matching are deterministic application code. There
is no Anthropic/Claude SDK, API key, metered model call, or AI-generated result
in the quiz submission path; a Claude account balance therefore cannot explain
submission success or failure.

## Privacy and failure behavior

- The raw safety answer is never sent to or stored by Valisen or analytics.
  Server validation also strips it from a tampered payload. Only a derived
  `safetyFlagged` boolean may be retained temporarily in on-device
  `sessionStorage` for restored-result safety messaging.
- Raw answers and the calculated result are restricted to first-party
  persistence and operational result delivery. They are never analytics
  properties or Jane URL parameters.
- The quiz-to-consultation contact prefill is written only on a consultation
  CTA click, expires after 15 minutes, and is deleted as soon as the
  consultation page reads it. Its private capability is submitted only in the
  consultation JSON body and is never stored in analytics or the CRM.
- Results access records express, versioned, purpose-limited authorization for
  Valisen staff and the recommended/matched therapist to contact the visitor,
  and for Valisen to share the contact details and relevant quiz summary with
  that therapist. It excludes sale and unrelated promotional marketing.
- No proposed scheduling times, time zone, or optional message are recorded or
  emailed before the visitor submits the separate unchecked scheduling
  acknowledgement.
- The private result API is a same-origin, body-only POST that rejects query
  strings and extra fields, is rate-limited and `no-store`; the opaque token is
  hashed at rest. It returns the already-consented email and phone only through
  that capability-protected response so a restored result can restage the
  short-lived consultation autofill.
- The PDF endpoint is `POST`-only, rejects query strings and extra fields, is
  rate-limited and `no-store`, and builds its model without name, email, phone,
  raw answers, contact preferences, or free-text messages.
- The results-access and contact-help writes execute invisible Cloudflare
  Turnstile challenges only on valid submission and verify distinct expected
  actions on the server. Failed or expired challenges reset before retry.
- Strict streaming payload limits, same-origin checks, allow-lists, honeypots,
  per-IP rate limits, durable claim leases, stable submission IDs, payload
  fingerprints, and fenced completions reduce abuse and duplicates.
- Server logs use internal references and error classes rather than submitted
  contact details or quiz answers.
- A valid consented request atomically stores a protected Supabase recovery
  snapshot (contact fields, submitted non-safety answers, calculated outcome,
  match, consent, and attribution) when it claims its stable reference. If the
  Google Sheets mirror then fails, the CRM marks the reference `failed`, keeps
  the complete snapshot in the protected recovery queue, and attempts an
  urgent email to `QUIZ_LEAD_TO_EMAIL`.
- If Supabase is temporarily unavailable, the route falls back to the existing
  Google Sheets path so the recovery service does not become a new single
  point of failure. If both storage providers fail, the browser keeps the
  in-memory answers for retry and the route still attempts the failure alert.
- Analytics-link and email-claim failures are warnings after a Sheet row has
  been saved; they no longer turn a successful lead save into the generic red
  submission error. Email failures do not undo a successful storage operation.
- A Jane outbound click is never labeled as a booking. Appointment completion
  must not be inferred without a future verified Jane integration.

## Commands

```bash
npm test
npm run typecheck
npm run lint
npm run build
# With a local server running on port 3000:
npm run test:quiz-ui
npm run screenshots:quiz
```

The browser smoke script must intercept quiz APIs and must not create live
worksheet rows or emails. Other browser QA should also use intercepted APIs or
test storage/mail adapters.

## Review before launch

- **Business operations**: verify every Jane staff destination, including
  Dayong's staff-member 7 link, and reconfirm consultation price, duration,
  and format.
- **Privacy/legal**: approve the mandatory results-access contact/sharing
  authorization, the separate exact-time scheduling acknowledgement, private
  link/PDF handling, worksheet retention/deletion, campaign fields, and
  contact-help workflow.
- **Clinical**: approve question/result wording, score explanation, safety
  behavior, matching weights, therapist metadata, and non-diagnostic language.
- **Analytics**: map only the allow-listed data-layer fields in GTM/GA4/Meta and
  confirm no custom tag reads quiz answers or contact form values from the DOM.
- **Operational**: verify worksheet migration on a copy of the live header,
  configure a production token secret, test all three email paths, and treat
  Jane click counts as outbound interest rather than completed bookings.
- **Hosting/idempotency**: apply the unified growth CRM migration, then
  `20260812000000_quiz_submission_recovery.sql`, and finally
  `20260813000000_quiz_crm_record_store.sql` and
  `20260814000000_quiz_test_data_flags.sql` before the application deploy.
  Verify that concurrent requests with one client
  submission ID receive the same `VQ-*` reference, that the loser receives a
  retriable `202` while the storage lease is active, and that an append-success/
  completion-failure retry reconciles the existing Sheet row rather than
  appending another one. Supabase is the exact identity/claim authority; the
  Sheet status columns are reconciliation mirrors. Confirm the protected quiz
  dashboard shows the recovery queue and that a simulated Sheet failure stores
  all non-safety submission fields with `failed` status.
- **Email recovery**: configure operational monitoring or a durable retry job
  for transactional-email failures; the current persisted failed state retries
  when the same idempotent submission or scheduling request is sent again.

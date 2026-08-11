# Consultation and funnel tracking

## Storage model

Supabase is the idempotent source of truth for anonymous site/quiz journey
events and the consented consultation pipeline. Newly accepted browser events
are mirrored to the existing Google workbook as a live operational/export
view after the database commit. Database event IDs and session sequences prevent retries from inflating
the canonical metrics shown in the protected admin dashboards; the workbook is
a reporting convenience and is never the source for CRM or conversion truth.

### What the workbook contains

The first privacy-limited event automatically creates four tabs in the
spreadsheet configured by `GOOGLE_SHEET_ID`:

- **Funnel Sessions** — one dynamically updated row per browser-tab session.
  `Last Stage / Exit Point` is the operational drop-off field. It also shows the
  highest quiz question reached, whether the quiz and results gate were
  completed, consultation CTA click count, consultation form step reached,
  consultation submission status, Jane-secondary click count, and the latest
  fixed Q19 routing-intent category when supplied.
- **Funnel Events** — an append-only, ordered event trail for precise journey
  reconstruction. `Session ID` and `Sequence` provide the join and ordering.
- **Quiz Attempts** — one dynamically updated row per distinct quiz retake.
  It shows the actual last question/stage, completion state, explicit exit,
  quiz version, the allow-listed preferred-next-step intent, and anonymous
  parent session without storing any clinical, matching, or safety answers.
- **Funnel Dashboard** — live totals and conversion formulas for quiz starts,
  quiz completions, quiz leads, consultation CTA clicks, submitted requests,
  CTA-to-request conversion, and Jane-secondary clicks.

The client batches events and flushes them after a short delay and when the
page is hidden. A `session_exit` event carries the last known stage. Internal
navigation can produce an intermediate exit, so the authoritative drop-off is
the current `Last Stage / Exit Point` on **Funnel Sessions**, which is replaced
when that session continues to another page.

The private `/admin/checkpoints/quiz` dashboard reads the canonical Supabase
event stream and shows reached, answered, and exited counts for all 19 quiz
screens. An abandoned session is classified as an exit only after an explicit
exit event or 30 minutes without activity. This avoids treating a person who is
still completing the quiz as a drop-off.

Question metrics are attempt-based. A recorded answer implies that the question
was reached even if its separate view event was lost. The exit question is the
newest current question position, including a Back action, rather than the
furthest question ever reached. Exits are split into before-answer and
after-answer counts, including Q19 after-answer abandonment.

Dashboard date ranges cohort anonymous journeys by session start. Funnel cards
are independent rates against the same `/quiz` visitor cohort; they are not
labelled as from-prior conversions because durable lead and consultation
records can arrive asynchronously.

The authoritative business counts are deliberately separate:

- **Quiz leads:** durable `quiz_lead_links` records created by a consented
  results-access submission.
- **Raw consultation requests:** one durable `consultation_requests` row per
  request reference, including requests later marked duplicate. A retry can
  refresh coordination details only before notification delivery and outside
  an active delivery lease; identity, consent purpose, source and attribution
  provenance remain collision-protected.
- **Duplicate requests:** raw request rows whose current CRM lead is marked
  duplicate.
- **Consultation opportunities:** distinct non-duplicate CRM leads. Booking
  conversion uses this denominator.
- **Booked / paid therapy:** staff-confirmed stages on non-duplicate
  opportunities only.

## Privacy boundary

The event API uses an exact event and property allow-list. It accepts page and
stage identifiers, zero-based quiz question index, CTA placement, therapist
ID, internal submission reference, device category, safe UTM fields, elapsed
time, a random per-tab session ID, and one of four allow-listed Q19 routing
intent categories. The intent category is sent only to the first-party stream,
never GTM. The API and database both reject any value outside the fixed enum.
The event API cannot accept names, email addresses, phone numbers, clinical
quiz answers, result scores, concern categories, safety responses, or free
text.

The browser session ID is random and stored only in `sessionStorage`. There is
no fingerprint, cross-device identity, or persistent visitor ID. Identified
quiz leads may be joined operationally only after submission through the
internal `Submission Reference` that the existing quiz flow already returns.

## Consultation path

All primary booking CTAs resolve to `/consultation`. Therapist-specific CTAs
carry only an allow-listed therapist slug so the form can preselect that
therapist. The form has two measured steps:

1. first name, last name, email, required phone number, and consultation context;
2. broad Monday–Sunday Toronto-time availability (9AM–12PM, 12PM–4PM, or
   4PM–8PM), exact coordination consent, Cloudflare Turnstile, and submission.

When a visitor clicks the consultation CTA immediately after submitting the
quiz results-access form, the browser stages the already-validated first name,
email, phone, and private quiz capability in a short-lived same-tab
`sessionStorage` record. The consultation page consumes and deletes that record
on arrival. The server verifies the capability against the quiz lead before it
links the `VQ-*` quiz reference to the `VC-*` consultation request. Contact
details and the capability never appear in the URL or funnel-event payload.

The Jane link remains visible below the form as the secondary path for
returning clients or people who prefer immediate self-scheduling. A Jane click
is still an outbound click, not a confirmed booking.

## Submission security

The consultation endpoint applies all of the following before producing email
or spreadsheet side effects:

- same-origin and JSON-only requests;
- strict request-size, field, value, and length validation;
- a server-checked honeypot with a non-revealing success response;
- per-IP and hashed-email rate limits;
- Cloudflare Turnstile server-side Siteverify validation, including action,
  hostname, token length, remote IP, timeout, and idempotency key;
- exact versioned consent text validation;
- stable client submission IDs and stable email Message-IDs;
- spreadsheet header compatibility checks and `RAW` values.

Turnstile production keys are required. Local development automatically uses
Cloudflare's official always-pass test pair. Configure:

```text
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
TURNSTILE_ALLOWED_HOSTNAMES=valisenmentalhealth.com,www.valisenmentalhealth.com
```

The in-memory rate limiter and submission cache are per warm application
instance. Turnstile remains the globally validated bot control. Consultation
notifications use a durable database lease with fenced completion, while stable
Message-IDs provide an additional SMTP deduplication signal. Consultation
opportunities and anonymous funnel events use database uniqueness across
instances.

## Consultation manager and conversion definitions

`/admin/checkpoints/consultations` is the protected operational list for both
Mental Battery and quiz-originated consultation requests. Contact details,
availability, source/campaign, requested therapist, and staff workflow status
are stored only after the applicable consent is submitted. They never enter the
anonymous event tables.

The conversion milestones are deliberately distinct:

1. **Consultation requested** — accepted server-side request or submitted quiz
   scheduling-help request;
2. **Consultation booked** — manually confirmed by authorized staff;
3. **Paid therapy** — manually confirmed after progression into paid therapy.

A Jane outbound click is interest only and never marks a booking. Admin updates
use optimistic row versions and append a history entry; reversing a conversion
or reopening a closed lead requires a note.

## Reading friction

- Filter **Funnel Sessions** where `Quiz Started = Yes` and
  `Quiz Completed = No`; group by `Max Quiz Question Reached` or inspect
  `Last Stage / Exit Point`.
- Filter where `Consultation CTA Clicks > 0` and
  `Consultation Submitted = No`; compare `Consultation Max Step` to separate
  landing-page exits from final-step friction.
- Compare `Consultation CTA Clicks`, `Consultation Submitted`, and
  `Jane Secondary Clicks` on **Funnel Dashboard**.
- Use **Funnel Events** only when the ordered path for a particular anonymous
  session needs to be reconstructed.

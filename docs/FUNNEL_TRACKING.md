# Consultation and funnel tracking

## What the workbook contains

The first privacy-limited event automatically creates three tabs in the
spreadsheet configured by `GOOGLE_SHEET_ID`:

- **Funnel Sessions** — one dynamically updated row per browser-tab session.
  `Last Stage / Exit Point` is the operational drop-off field. It also shows the
  highest quiz question reached, whether the quiz and results gate were
  completed, consultation CTA click count, consultation form step reached,
  consultation submission status, and Jane-secondary click count.
- **Funnel Events** — an append-only, ordered event trail for precise journey
  reconstruction. `Session ID` and `Sequence` provide the join and ordering.
- **Funnel Dashboard** — live totals and conversion formulas for quiz starts,
  quiz completions, quiz leads, consultation CTA clicks, submitted requests,
  CTA-to-request conversion, and Jane-secondary clicks.

The client batches events and flushes them after a short delay and when the
page is hidden. A `session_exit` event carries the last known stage. Internal
navigation can produce an intermediate exit, so the authoritative drop-off is
the current `Last Stage / Exit Point` on **Funnel Sessions**, which is replaced
when that session continues to another page.

## Privacy boundary

The event API uses an exact event and property allow-list. It accepts page and
stage identifiers, zero-based quiz question index, CTA placement, therapist
ID, internal submission reference, device category, safe UTM fields, elapsed
time, and a random per-tab session ID. It cannot accept names, email addresses,
phone numbers, quiz answers, result scores, concern categories, safety
responses, or free text.

The browser session ID is random and stored only in `sessionStorage`. There is
no fingerprint, cross-device identity, or persistent visitor ID. Identified
quiz leads may be joined operationally only after submission through the
internal `Submission Reference` that the existing quiz flow already returns.

## Consultation path

All primary booking CTAs resolve to `/consultation`. Therapist-specific CTAs
carry only an allow-listed therapist slug so the form can preselect that
therapist. The form has two measured steps:

1. contact and consultation context;
2. broad Monday–Friday Toronto-time availability, exact coordination consent,
   Cloudflare Turnstile, and submission.

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
instance. Turnstile remains the globally validated bot control. If strict
cross-instance request uniqueness becomes a requirement, add a transactional
database or Cloudflare Durable Object before the email send.

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

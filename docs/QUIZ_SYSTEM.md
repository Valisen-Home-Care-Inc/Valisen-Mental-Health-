# Valisen Quiz-to-Booking System

How the self-reflection quiz, required results-access step, therapist matching,
separate contact consent, persistence, and internal notification work.

## User journey

1. **Quiz** (`/quiz`): one question per screen—an opener, 12 scored
   questions, duration and impact context, an optional concerns multi-select,
   an optional therapist-gender preference, and a safety check (18 screens).
   The former therapy-language question has been removed. A concerning safety
   answer immediately shows 9-8-8, the Ottawa crisis line, and 9-1-1 guidance.
2. **Required results-access form**: after the final question, the score,
   interpretation, therapist recommendation, and booking link remain hidden.
   The visitor must provide first name, email, phone, and acknowledge the
   versioned privacy notice before **View My Results** becomes available. This
   acknowledgement permits the submission to be stored and results to be
   provided; it is explicitly not therapist-contact consent.
3. **Lead save**: `POST /api/quiz-lead` strictly validates the completed quiz,
   removes the safety answer, rejects the retired `language` field, recalculates
   the score and therapist match on the server, and saves the complete lead.
   It also sends a distinct results-access summary and consent-free PDF to the
   configured Valisen inbox. Both clearly state that therapist contact was not
   requested. A successful response returns the persisted outcome, match,
   internal reference, and an opaque token for the optional second step.
4. **Seamless reveal**: after the save succeeds, a short reduced-motion-aware
   transition reveals the result and recommended therapist together. The
   result is never revealed after a failed save.
5. **Separate therapist-contact consent**: a prominent card immediately below
   the result/recommendation asks whether the visitor wants contact. It is
   unchecked, voluntary, and requires a deliberate second click. Booking and
   quiz results remain usable without selecting it.
6. **Consent record and contact-request notification**: only
   `POST /api/quiz-lead/contact-consent` can record contact consent and send the
   contact-request email. It stores the canonical wording, wording version, and
   server timestamp against the existing quiz submission before claiming and
   sending that second internal email. It includes the contact information,
   result category, recommended therapist, consent record, internal reference,
   optional secure admin link, and a non-PII-named PDF summary.
7. **Confirmation or retry**: a successful request replaces the button with
   **Request received**. Failures leave the results in place and allow retry.
   Client-side in-flight guards, a persistent notification state, stable tokens,
   and a keyed server lock prevent ordinary double-click/retry duplicates.

## Files that matter

| Concern | File |
| --- | --- |
| Questions, scoring, result copy, versions | `lib/quiz.ts` |
| Therapist roster and verified matching metadata | `lib/therapists.ts` |
| Matching engine, weights, and feature flag | `lib/matching.ts` |
| Access/contact contracts, legal copy, strict validation | `lib/quizLead.ts` |
| Required access form | `components/quiz/ResultsAccessForm.tsx` |
| Quiz state and transitions | `components/quiz/QuizFlow.tsx` |
| Unified results and separate contact-consent card | `components/quiz/ResultsReveal.tsx` |
| Lead-save and results-summary endpoint | `app/api/quiz-lead/route.ts` |
| Contact-consent and notification endpoint | `app/api/quiz-lead/contact-consent/route.ts` |
| Durable lead store | `lib/server/quizLeadStore.ts` |
| Internal notification content | `lib/server/quizLeadEmail.ts` |
| Internal PDF summary | `lib/server/quizSummaryPdf.ts` |
| Generic, non-sensitive analytics events | `lib/analytics.ts` |
| Tests | `lib/__tests__/*.test.ts` |

## Persistence model

This repository does not have a separate relational database. The quiz uses
the website's existing Google service-account integration as a durable lead
store, in a dedicated worksheet (default: **Quiz Leads**) within the configured
spreadsheet. The API creates the worksheet and exact header row when needed;
it refuses to write if an existing header is incompatible. It never mixes quiz
leads with general intake rows.

Each row stores:

- internal reference, client id, opaque-token hash, creation/update timestamps;
- first name, email, and phone;
- results-access privacy timestamp, exact wording, and wording version;
- quiz/scoring versions and sanitized answers (the safety answer and retired
  language answer are never stored);
- server-calculated outcome, result category, score band, match, recommended
  therapist, and factual match reasons;
- therapist-contact consent timestamp, exact wording, and wording version;
- independent results-access and therapist-contact notification states, each
  with claim id/time, attempt count, sent time, and a generic last-error value.

The access-notification fields are appended to the original worksheet schema
in columns AD:AI. On first use after this update, the API safely expands an
exact legacy 29-column sheet and writes only the missing headers; existing
columns and rows stay in place.

Google Sheets is encrypted in transit and at rest by the provider; access to
the configured spreadsheet should be restricted to the service account and
authorized Valisen staff. Retention/deletion remains an operational process and
must follow the clinic's approved privacy schedule. Treat the quiz worksheet as
an application-owned table: protect it from manual sorting, row insertion, and
row deletion; use filtered views or a separate reporting sheet for staff review.

## Configuration

See `.env.example`.

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_SHEET_ID`:
  required for both quiz persistence and the existing general intake append.
- `QUIZ_LEADS_SHEET_NAME`: optional dedicated worksheet name; defaults to
  `Quiz Leads`.
- `QUIZ_LEAD_TOKEN_SECRET`: production HMAC secret for opaque consent tokens.
  Generate a long random value. `GOOGLE_PRIVATE_KEY` is only a compatibility
  fallback.
- `GMAIL_USER`, `GMAIL_APP_PASSWORD`: required for the initial internal results
  summary and the later therapist-contact request.
- `QUIZ_LEAD_TO_EMAIL`: internal recipient for both distinct email types;
  defaults to `info@valisenmentalhealth.com`.
- `QUIZ_LEAD_ADMIN_URL`: optional HTTPS URL or template containing
  `{referenceId}` for the secure submission link in the internal email.

## Matching and scoring

- `QUIZ_VERSION` is `4.0.0` after removal of the language question. Old clients
  and payloads containing a `language` answer are rejected.
- Language is not accepted in a persisted answer set and is absent from
  `MatchPreferences`, matching metadata, eligibility filters, scoring weights,
  tie-breaking, and match reasons. Ordinary therapist profile language details
  remain available elsewhere on the public site.
- Matching uses selected concerns, the strongest result dimensions, optional
  therapist-gender preference, therapist availability, and a verified Jane
  booking URL. It remains deterministic and explainable.
- Matching weights and thresholds are in `lib/matching.ts`; scoring thresholds
  and result bands are in `lib/quiz.ts`. These require clinical approval.
- If no responsible match reaches the threshold, the UI presents the team and
  consultation path instead of inventing a recommendation.

## Privacy and failure behavior

- Results are gated on a successful durable save. A storage failure keeps the
  form and quiz answers in memory and presents a retry message.
- Results access stores the lead and sends one internal administrative results
  summary. Its subject/body/PDF identify it as **not a contact request**, it is
  never sent directly to a recommended therapist, and it leaves all
  therapist-contact consent fields unset.
- Therapist contact requires a separate, explicit action after the results are
  visible. Its exact canonical text and server time are stored before a second,
  differently labeled internal email is sent.
- The safety answer never leaves the browser; server validation strips it even
  from a tampered payload.
- Analytics receives generic funnel events only—never answers, identifiers,
  result categories, scores, safety responses, or contact fields.
- Server logs contain internal references/error classes, not submitted PII or
  quiz answers.
- Payload limits, strict allow-lists, a honeypot, per-IP rate limiting, token
  hashing, independent persistent notification claims, and per-process locking
  reduce abuse and duplicate sends.
- SMTP cannot provide mathematical exactly-once delivery after an ambiguous
  network failure. The implementation uses a stable Message-ID and persistent
  sent/claim states so ordinary double-clicks and retries create one record and
  one email of each applicable type; operators should use the internal
  reference when resolving exceptional delivery ambiguity.

## Commands

```bash
npm test
npm run typecheck
npm run lint
npm run build
# With a local server running on port 3000:
npm run test:quiz-ui
```

The browser smoke script intercepts both quiz APIs and creates no live worksheet
rows or emails. Other browser QA must also use intercepted APIs or test
storage/mail adapters; never point automation at the clinic worksheet or inbox.

## Review before launch

- **Privacy/legal**: approve both versioned texts in `lib/quizLead.ts`, the
  privacy-policy update, the stated retention process, and the contact methods.
- **Clinical**: approve quiz wording, scoring thresholds, result copy, safety
  behavior, matching weights, and therapist metadata.
- **Operational**: confirm the service account can create/update the dedicated
  worksheet, set a production token secret, confirm the internal recipient,
  and test the optional secure admin URL.

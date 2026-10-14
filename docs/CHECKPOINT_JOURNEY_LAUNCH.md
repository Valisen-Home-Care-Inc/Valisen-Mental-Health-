# Mental Battery V3 launch — October 13, 2026

The approved design now runs through the shared `/c/[code]` route for VMH-01 through VMH-25. Individual QR URLs and original placement attribution remain intact. The separate design preview is retained locally; production imports no preview modules or mock adapters.

The check-in presents its first question immediately. Energy, topic and a personal follow-up lead to a reflection; an everyday-impact question is shown only when relevant. The positive/no-specific-concern path ends after three questions. Ten support pathways, concern-specific free-call invitations, therapist photos, profile-backed reassurance, language choices, alternatives and clear paid-session fees match the approved preview. Meryem's owner-confirmed couples service is scoped to this experience; the shared roster is unchanged.

The request requires a name, a valid formatted phone number and consent. No last name or email is required, and there is no email-only option. The production form retains security verification. A saved request is not a booked appointment. The clinic promises to respond by phone within 24 hours to arrange a time; the consultation itself is not promised within 24 hours.

## Saved requests and clinic emails

`/api/checkpoint-journey/request` validates the phone, consent, selected service, therapist and consultation language. One database transaction saves a durable CRM lead and request, original checkpoint/placement/session attribution and the server-owned saved-request milestone. It uses a stable submission ID and payload hash to reject identifier reuse with different details.

The existing consultation notification leases protect the clinic email from concurrent retries. When session storage is available, only the random request ID is retained so retrying after a lost response or page reload uses the same ID; contact details and answers are not stored there. Email goes to `info@valisenmentalhealth.com`, with an optional selected-therapist copy when the existing therapist-email environment variable is configured. It identifies the request as unscheduled and includes phone, therapist, language, service, checkpoint, consent and the 24-hour response instruction. There is no visitor email receipt because this short form does not collect an email address. Other website email flows are unchanged.

A persistence error sends no email. An email failure leaves the saved request in the CRM, marks notification failed and allows retry with the same details. The visitor's draft is retained. Opening the form, focusing a field or requesting contact never reserves calendar capacity or counts as a confirmed booking.

## CRM reporting

The Checkpoints dashboard and each VMH detail show a V3 report: actual screens reached and answered, three/four-question results, free-call CTA, form opened, fields focused, validation issue, submission attempt/error, server-confirmed request saved, clinic-recorded booked and paid stages, and therapist-options engagement. Each metric counts unique sessions. The CSV includes the new report and historical question/intent metrics.

The old Q4 intent mix and old question totals remain in a historical section. They are separated from V3; a healthy visitor skipping Q4 is not a Q4 exit. Overall checkpoint KPIs continue to include both versions. The report supports the initially installed launch RPC as well as the migration's optional direct historical metrics.

Quiz answers, reflection text, concern labels and generated conversation starters stay in page memory and are not stored or emailed. Analytics accepts only structural question numbers, event names, field names and CTA placement. Contact details and therapist/service/language are sent only with the separately consented request. Anonymous session IDs and progress ledgers use session storage. Third-party site marketing remains excluded from `/c`.

## Database activation

Run `artifacts/checkpoints/LAUNCH_CHECKPOINT_JOURNEY.sql` in Supabase SQL Editor. It is transactional and safe to rerun, includes expansion through VMH-25 and the V3 migration, and returns `ready` with three true flags. The owner confirmed this result on October 13, 2026. The website checks database readiness before using V3; if the database install is missing or unavailable, it retains the existing checkpoint experience.

## Verification

- Isolated PostgreSQL migration checks: all 25 VMHs, reruns, old-session preservation, adaptive question cohorts, phone-only CRM rows, notification leases/retries, exact attribution and restricted RPC access.
- Request/contract tests: saved-before-email ordering, no email on save failure, phone/consent validation, clinician/language/service validation, same-ID retries, successful-delivery suppression and no forged saved events or answer payloads.
- Gmail SMTP authentication verified with the existing credentials; verification sent no email.
- Production browser, type, lint and build results are recorded with the launch QA artifacts. Local request tests use sample contacts and mocked mail; a real visitor request still depends on the deployed service's existing database and SMTP environment.

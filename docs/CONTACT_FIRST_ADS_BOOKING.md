# Contact-first Google Ads consultation flow

All 18 `/welcome/{slug}` pages and `/welcome` collect name, email, phone and consent before showing the optional calendar. A single name is accepted. The quiz keeps its existing booking flow. The main `/consultation` form keeps its flow and now formats phone numbers as `(613) 555-0123`, caps at ten digits, and accepts a single name.

## Two accepted stages

1. **Details received, time not selected:** the contact submit must pass verification, save the CRM request, and notify the clinic before the page acknowledges success. It sends a visitor receipt saying that no time has been booked. No capacity is reserved. The clinic subject starts `DETAILS RECEIVED — TIME NOT SELECTED`.
2. **Consultation booked:** the visitor can open the calendar and confirm a time. A signed, two-hour continuation proof ties the booking to the accepted contact identity and landing page. A service-only RPC adds the booking request to the same lead. The clinic receives a second email starting `FOLLOW-UP BOOKED`, with the original contact reference. The visitor receives the booked-call confirmation. Named pages use only the selected clinician's capacity; `/welcome` uses the existing shared pool.

Retries retain the same request identity. Booking identifiers are derived from the accepted contact reference to prevent an ambiguous response from reserving another slot. A conflict keeps the captured contact request and lets the visitor choose another time. Clinic SMTP failures return an error and retain the durable request for retry. Visitor email failures retain the accepted request after successful clinic notification, as before. Website calendars share capacity; Jane appointments still require staff coordination.

The original Google Ads consultation link stays associated with the contact request. The booked follow-up updates the same lead. There is one opportunity and one Ads conversion receipt identity for the journey. The existing Google Ads thank-you conversion is emitted after calendar confirmation; contact-only requests are counted in CRM request totals and must not be mistaken for booked calls.

## CRM diagnostics

The Google Ads tab offers **Analyze** below Consult CTA sessions and Form starts, plus **Analyze consultation engagement** below the funnel. Analysis uses all matching sessions in the selected final URL/date range/Live or Test QA scope, rather than the recent-journey limit. It shows static identifiers for header/hero/therapist/sticky/reminder buttons, contact submit, calendar open/later, month/date/time controls, therapist/language changes, field focus/entry, and validation/submission failures. Each session shows its outcome and last observed step. It does not claim to know why someone left.

No visitor-entered values or arbitrary DOM text are sent in journey diagnostics. Old records without specific control identifiers remain labeled as having no detailed control history. The analysis shows the last 120 booking events per session, explicitly noting truncation, while aggregate counts use the entire recorded timeline.

## Deployment

Run `supabase/migrations/20261009000000_contact_first_ads_booking.sql` in Supabase before deploying the application. `artifacts/ads-concepts/LAUNCH_CONTACT_FIRST_BOOKING.sql` is a copy for the SQL Editor. Expected output: `contact_first_status = ready`, `linked_followup_ready = true`, `detailed_tracking_ready = true`.

The migration preserves all existing data, adds a verified follow-up writer and closed control IDs, and makes booked-stage lookup resolve the lead through its request. It is safe to rerun and keeps existing production and Test QA isolation. New forms use consent v3; the server also accepts an already-open v2 booking page during rollout. Continuation signing uses `CONSULTATION_CONTINUATION_SECRET` when configured, otherwise the existing server-only `GOOGLE_ADS_CONVERSION_SECRET` (at least 32 bytes).

## Validation

- Automated request tests cover contact persistence without a slot, distinct clinic and visitor emails, linked booking, retries, single names, unsigned or changed contact identity, and SMTP failure.
- `scripts/contact-first-sql-qa.cjs` runs the complete migration chain in isolated PostgreSQL and verifies one lead/two requests, idempotency, QA isolation, capacity, closed control ingestion and permissions.
- `scripts/contact-first-browser-qa.mjs` uses local database fixtures and intercepted submission/email routes. It verifies all 18 initial forms, desktop/mobile Arabic/Mandarin/couples/welcome progression, phone limits, delivery/slot-conflict recovery, exact structural events, and the protected CRM analysis view. It sends no real emails and creates no production bookings.
- After deployment, run a marked Test QA contact request and optional booking to verify actual clinic/visitor delivery and the shared inventory.

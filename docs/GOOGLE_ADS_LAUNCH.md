# Approved Google Ads landing pages

The owner approved commercial launch of the 15 designs. Production destinations
are `https://valisenmentalhealth.com/welcome/{slug}`:

anxiety, depression, cbt, couples, ocd, panic, social-anxiety, online-therapy,
psychotherapists, free-consultation, mandarin, arabic, adhd, perfectionism, trauma.

The keyword CSV at `/ads-preview/keyword-map` maps all 53 enabled keywords to
their live final URLs. Both paused keywords remain excluded. Campaign settings
are not edited by this release. `/ads-preview` remains a sample-only gallery.

## Booking and shared availability

Focused pages book a named therapist for a free 20-minute phone call at the
selected time, using only that page's eligible clinicians. Ryann leads couples
and OCD; her recurring availability is included. General `/welcome` and quiz
calendars draw from all five clinicians. All use the same durable reservation
table. An overlapping appointment removes only that clinician's capacity;
another available clinician keeps a pooled slot open. Legacy reservations
without a clinician remain clinic-wide holds to avoid double bookings.

The database serializes claims and rejects changed-therapist request replays.
The form freezes appointment identity while submitting and during uncertain
retries. A confirmed slot conflict returns to the calendar and retains contact
details. Availability failures disable date/time choices. Open calendars refresh
every 30 seconds, on focus, and after same-browser bookings.

Arabic and Mandarin pages retain their native defaults and visible English
toggle. Page language and consultation language remain independent. Confirmation
emails include the named therapist, date, time, consultation language and reference.

These are shared **website** reservations. They do not read Jane appointments
or automatically create Jane appointments. Existing high-priority clinic emails
identify the reserved clinician and tell staff to add the confirmed call to the
operational calendar. Staff must keep outside bookings and time off coordinated.

## Tracking

All 15 final URLs enter the existing signed Google Ads journey and remain separate
in CRM final-URL reports. All 15 destinations stay selectable even with no visits
in the selected range or scope; `/welcome` stays first and remains the default.
Other historical entry URLs remain available when present in the report. Metrics,
journeys and CSV exports follow the selected original final URL, including its
downstream activity. Named booking step 1 is choosing
a time, and step 2 is contact details. Production CTA, start, detail, field and
confirmed-submission events use the existing first-party event contract. No field
values are included. Reminder section `section-99` distinguishes exposure,
dismissal and CTA actions. Preview events remain local with no real submissions.

The visitor completes booking on the landing page. A signed Google Ads booking
then transfers the same named, translated confirmation to the neutral `/thank-you`
document for the existing server-verified, deduplicated conversion. The focused
page has a no-referrer policy. Marketing tags are disabled on focused landing
pages, and enabled for Ads conversions only after server confirmation. If a
conversion receipt or browser storage is unavailable, the inline booking success
remains visible; the durable booking is not submitted again to retry analytics.

Attended consultations and paid-therapy outcomes continue to depend on staff's
CRM updates; they are not inferred from a CTA click or booking submission.

## Database rollout

The owner ran the combined `LAUNCH_GOOGLE_ADS.sql` successfully in Supabase and
reported `ready`, 17 weekly shifts, 15 approved URLs, and both readiness flags
true. Its source migrations are:

- `20260915000000_pooled_consultation_availability.sql`
- `20260917000000_focused_google_ads_landings.sql`

Both are rerunnable. Existing booking RPCs wrap the shared-capacity functions
for rollout compatibility. No existing appointments are deleted.

## Validation and release status

Database tests use isolated PostgreSQL/PGlite, including overlapping times,
singleton/pool capacity, retries, legacy holds, permissions, all 15 tracked paths,
duplicate events, and rerunning migrations. Browser tests mock submissions and
external services; no real appointment or email is created for testing.

Release validation passed: 626 automated tests, lint, TypeScript, production build,
all 15 responsive live pages, and all 15 sample previews with no real submissions.
The focused browser checks passed named retry identity, cross-tab capacity,
language preservation, conflict recovery, failed availability, translated named
confirmation, no-referrer navigation, and a single verified Ads conversion.

The release is published to `main`; deployment verification uses only page loads
and availability reads, without creating production appointments or test emails.

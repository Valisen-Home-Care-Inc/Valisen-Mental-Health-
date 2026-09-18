# Google Ads concept review

Share the gallery at https://valisenmentalhealth.com/ads-preview.
Each of the 15 concepts is available at `/ads-preview/{slug}`.

This release is for team review only. Forms validate sample details and show a
demo confirmation; they do not submit requests, save details, or reserve slots.
Calendars illustrate the selected therapist's supplied permanent weekly schedule,
including Wilfred's Thursday and Friday hours. They do not query live availability.
Arabic and Mandarin pages open in their native language with a visible English
toggle. Page language and consultation language are separate selections. Ryann
is featured first where the documented fit is equal and leads the couples and
OCD concepts at the owner's request. Her confirmed OCD work and recurring hours
are included in that page's therapist selection and calendar.

The gallery includes the enabled-keyword mapping download. `/welcome/{slug}`
addresses in that file are proposed future campaign destinations, not activated
landing routes in this release. Existing `/welcome`, `/quiz`, intake APIs,
live availability, and database migrations are unchanged.

Preview routes are excluded from analytics and marked noindex. They are public
review links, not password-protected pages. No campaign settings were changed.

Validation: `npm test`, `npm run lint`, `npm run build`, and
`node scripts/ads-concepts-qa.mjs` (set `SITE_URL` to the server being reviewed).

## Refinements for review

- All 15 openings show the lead clinician, relevant fit, paid-session fees, and a
  consistent free-consultation action. Qualifications are visible before expanding
  the fuller background. Anxiety, depression, couples, online therapy, registered
  psychotherapists, and free consultation received particular attention.
- The appointment is a free 20-minute phone call directly with the named therapist
  at the selected time. Internal clinician coordination is not presented as the
  appointment. The consultation is separate from a paid therapy session.
- Profile buttons select that therapist. The calendar, details, and confirmation
  preserve therapist, date, time, Toronto timezone, and consultation language.
  Visitors can change their selection without losing contact fields or consent.
- Free-consultation and online-therapy pages place booking beside the opening.
  A separate contact option covers therapist choice, unavailable times, or a
  different way to connect; it does not imply an unconfirmed alternative service.
- Couples sessions are **$200 CAD per 50 minutes, total for both partners**.
  This fee applies to both featured clinicians on the couples concept. Individual
  rates remain $160 for Meryem and $180 for the other featured clinicians.
- ADHD service scope is near the opening. OCD copy does not promise ERP or
  unverified specialist training. Trauma copy uses the listed approaches and
  invites questions about Tim's EMDR training and use; no certification is claimed.
  EMDR was removed from the proposed expansion keyword suggestions pending review.
- `[book a psychotherapist]` and `[online psychotherapist ontario]` now map to the
  RP-led `psychotherapists` concept. The download retains 53 enabled keywords and
  excludes both paused keywords. No actual ad destinations have been changed.
- Arabic RTL and Mandarin translations include the calendar, errors, consent,
  summaries, confirmation, and contextual reminder. Switching page language keeps
  the intended consultation language. No automatic English-language popup remains.

## Contextual invitation and measurement

`lib/paidSearchPreviewExperience.ts` contains `PREVIEW_REMINDER.enabled` and
`activeDelayMs` (30 seconds). `?reminder=off` disables the invitation and mobile
bar for a comparison. Thirty seconds is a test hypothesis, not an established
optimum. Desktop requires active viewing, having passed the therapist section,
no booking interaction, and no visible booking module. The invitation is
dismissible, does not trap focus or lock scrolling, and appears at most once per
browser-tab session across concepts. Storage failure suppresses invitations.
Mobile uses a small sticky bar, hidden around booking, focused form controls,
or the on-screen keyboard. Starting a booking suppresses reminders across concepts.

Local `valisen:concept-preview` CustomEvents contain only `event`, `concept`,
`placement`, `locale`, and `preview: true`. They send no network requests, contain
no contact details, and are not connected to production analytics or conversions.

| Stage | Preview behavior / future production authority |
| --- | --- |
| CTA click | `cta_clicked`, with header/hero/therapist/closing/reminder/mobile placement |
| Booking started | `booking_started` once per page when opening or interacting with booking |
| Contact details | `details_viewed` after a valid date and time |
| Demo completion | `preview_completed`; explicitly **not** a confirmed booking |
| Reminder | `reminder_exposed`, `reminder_dismissed`, `reminder_clicked` |
| Assistance | `assistance_clicked` for clinic email or telephone links |
| Confirmed booking | Future server-confirmed reservation, deduplicated by booking ID |
| Attended consultation | Future clinician/CRM attendance record linked to the booking |
| First paid session | Future verified completed paid appointment, once per client |

Before activation, agree on attribution and consent, connect those final three
stages to authoritative records, and compare confirmed/attended/paid outcomes.
Reminder clicks alone are not a success criterion. The goal of 1–2 consultations
per day is a business target, not a promised redesign outcome.

## Facts and operational items awaiting launch review

Current facts come from the clinic's existing `lib/therapists.ts` profiles and the
owner's confirmations in this conversation. No registration numbers, ratings,
testimonials, scarcity, or additional certification claims have been invented.

| Item | Status |
| --- | --- |
| Direct therapist call, selected time, 20 minutes, free | Confirmed by owner |
| Named-therapist flow; remove English popup | Explicitly approved, superseding earlier instructions |
| Couples fee/duration | Owner confirmed $200 CAD / 50 minutes, both partners total |
| One or both partners at consultation | Unconfirmed; deliberately omitted from the page |
| OCD clinicians | Owner confirmed Ryann, Wilfred, Meryem, Dayong; verify each clinician's methods and OCD-specific training before paid traffic; ERP not established |
| Trauma / EMDR | Tim lists EMDR, but exact training, protocol, and service scope still need clinician confirmation before an EMDR campaign |
| Education / registration | Existing degrees/designations retained; Meryem education and individual registration numbers/verification links require approved details |
| Translation review | Meryem to review Arabic; Dayong to review Mandarin before paid-traffic launch |
| Availability | Supplied recurring shifts are demo schedules; recheck accepting-new-client status and integrate actual shared reservations before activation |
| Future booking integration | Requires server-enforced named-clinician availability, conflict prevention, confirmations, and cross-calendar reconciliation; no production implementation in this preview release |

The browser script checks all 15 pages at 1440, 768, 430, 390, 360, and 320 pixels;
named selection and changes; retained contact details; native-language errors and
confirmation; language independence; reminder behavior; keyword download; noindex;
unknown-route 404; broken images; horizontal overflow; and runtime errors. It
intercepts and fails on lead-submission or analytics requests. Test inputs use
sample details only. Screenshots and the run report are stored locally under
`artifacts/ads-concepts/` and are not part of the published release.

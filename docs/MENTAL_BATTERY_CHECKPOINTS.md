# Mental Battery Checkpoints

This document is the operational and deployment guide for Valisen's ten
permanent NFC/QR Mental Battery Checkpoints.

## Architecture

- **Public experience:** Next.js App Router pages at `/c/VMH-01` through
  `/c/VMH-10`.
- **Anonymous event intake:** `POST /api/checkpoint-events`.
- **Source of truth:** Supabase PostgreSQL, accessed only by server-side Next.js
  route handlers. No Supabase key is shipped to the browser.
- **Consultations:** the existing `/consultation` form and
  `POST /api/submit-intake`, including its consent, mandatory phone number,
  Cloudflare Turnstile, honeypot, email, and Google Sheet workflow.
- **Administration:** `/admin/checkpoints`, protected by Cloudflare Turnstile at
  sign-in plus a signed, eight-hour, HttpOnly admin session. There is no
  registration route.
- **Deployment:** the existing Next.js application on Netlify. No parallel
  Netlify Function application is introduced.

The checkpoint database is deliberately separate from the existing general
Google Sheets funnel. Sheets remains the operational consultation store; it is
not used for transactional checkpoint placement or event uniqueness.

## Routes

### Public

- `/c/VMH-01`
- `/c/VMH-02`
- `/c/VMH-03`
- `/c/VMH-04`
- `/c/VMH-05`
- `/c/VMH-06`
- `/c/VMH-07`
- `/c/VMH-08`
- `/c/VMH-09`
- `/c/VMH-10`
- `/consultation?source=mental_battery_checkpoint`

Checkpoint and admin routes are excluded from the public sitemap and disallowed
in `robots.txt`. Checkpoint pages also emit `noindex` metadata and headers.

### Private admin

- `/admin/login`
- `/admin/checkpoints`
- `/admin/checkpoints/VMH-01` through `/admin/checkpoints/VMH-10`

### APIs

- `POST /api/checkpoint-events`
- `POST /api/checkpoint-attribution-retry`
- `POST|DELETE /api/admin/checkpoints/session`
- `GET /api/admin/checkpoints/dashboard`
- `GET|POST /api/admin/checkpoints/[code]`
- `GET /api/admin/checkpoints/[code]/qr`

Every admin data API validates the signed cookie server-side. State-changing
requests additionally require a matching same-origin `Origin` header.

## Database migration

The migration is:

```text
supabase/migrations/20260806000000_mental_battery_checkpoints.sql
```

It creates:

- `checkpoints`
- `checkpoint_placements`
- `funnel_sessions`
- `funnel_events`
- `consultation_attributions`

It also creates service-role-only RPCs:

- `move_checkpoint`
- `ingest_checkpoint_event`
- `record_checkpoint_consultation`
- `get_checkpoint_dashboard`
- `get_checkpoint_detail`

The migration seeds all ten checkpoint records and gives each an initial
`Unassigned` placement. PostgreSQL exclusion and unique constraints prevent
overlapping placement intervals. Session placement is immutable after the
session is created.

All five tables have Row Level Security enabled with no browser policies.
Direct table permissions are revoked. Only the audited RPCs are executable by
the server role.

## External setup

### 1. Create or select a Supabase project

Choose the project region and contractual/data-residency settings with
Valisen's privacy officer. Although the checkpoint tables contain no contact or
wellness-answer data, the project still forms part of Valisen's operational
infrastructure.

Apply the committed migration using the Supabase CLI so migration history stays
in sync:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

For an emergency one-time setup, the full migration can be run in the Supabase
SQL Editor, but the CLI workflow is preferred for repeatable environments.

After migration, verify that `public.checkpoints` contains exactly `VMH-01`
through `VMH-10` and that each has one `Unassigned` placement.

### 2. Create a server secret

In Supabase Dashboard → **Settings → API Keys**, create or copy a current
server-side secret key (`sb_secret_...`). Do not create a browser client for
this feature and do not use a `NEXT_PUBLIC_` variable.

Set:

```text
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
```

`SUPABASE_SERVICE_ROLE_KEY` remains supported only for a legacy service-role
JWT. The current secret-key format is preferred.

### 3. Create the admin credential

Run locally:

```powershell
node scripts/hash-checkpoint-admin-password.mjs
```

The script prompts for the password twice without echoing it and outputs:

```text
CHECKPOINT_ADMIN_PASSWORD_HASH=pbkdf2_sha256$...
CHECKPOINT_ADMIN_SESSION_SECRET=...
CHECKPOINT_ATTRIBUTION_REPAIR_SECRET=...
```

Only store the generated hash and secret. Do not store the plaintext password
in the repository or Netlify notes.

### 4. Add production environment variables in Netlify

Add the following to the production context and make them available to both
builds and runtime functions:

```text
SUPABASE_URL=
SUPABASE_SECRET_KEY=
CHECKPOINT_ADMIN_PASSWORD_HASH=
CHECKPOINT_ADMIN_SESSION_SECRET=
CHECKPOINT_ATTRIBUTION_REPAIR_SECRET=
NEXT_PUBLIC_SITE_URL=https://valisenmentalhealth.com
```

Keep the existing consultation variables configured:

```text
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
TURNSTILE_ALLOWED_HOSTNAMES=valisenmentalhealth.com,www.valisenmentalhealth.com
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_SHEET_ID=
GMAIL_USER=
GMAIL_APP_PASSWORD=
```

Trigger a new production deploy after changing environment variables; an
already-running serverless instance cannot see new values until redeployment.
The committed `.nvmrc` pins builds to Node 22, which satisfies Next.js 16's
runtime requirement. Do not override the Netlify build or Functions runtime to
a Node version below 20.9.

Official references:

- [Supabase server secret keys](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys)
- [Supabase database migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [Netlify environment variables](https://docs.netlify.com/build/environment-variables/overview/)
- [Next.js on Netlify](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/)

### 5. Add durable Cloudflare edge rate limits

The application has strict validation, Turnstile, and short-lived in-process
limits. Because Netlify instances do not share memory, configure these
zone-level Cloudflare WAF rate-limiting rules as the durable outer layer. Match
by source IP, return HTTP 429, and tune only after reviewing real traffic:

| Endpoint expression | Threshold | Mitigation |
| --- | ---: | --- |
| `http.request.method eq "POST" and http.request.uri.path eq "/api/admin/checkpoints/session"` | 10 requests / 10 minutes | Block for 15 minutes |
| `http.request.method eq "POST" and http.request.uri.path eq "/api/submit-intake"` | 10 requests / 10 minutes | Block for 60 minutes |
| `http.request.method eq "POST" and http.request.uri.path eq "/api/checkpoint-events"` | 120 requests / 1 minute | Block for 10 minutes |
| `http.request.method eq "POST" and http.request.uri.path eq "/api/checkpoint-attribution-retry"` | 20 requests / 30 minutes | Block for 15 minutes |

In Cloudflare, open **Security -> WAF -> Rate limiting rules**, create each rule,
and keep it scoped to the exact method and path above. The public event limit
is deliberately much higher than one normal four-question journey so it does
not interfere with legitimate rapid taps or delivery retries. Cloudflare plan
limits may constrain the available period or mitigation duration; use the
closest stricter-supported period and re-test the complete flow.

These WAF rules protect the origin only when the production Valisen DNS record
is proxied through Cloudflare (the orange-cloud state). Turnstile alone does
not proxy or rate-limit the other requests. If the production hostname is not
proxied, enable the proxy after validating TLS/DNS or configure equivalent
durable edge limits with the hosting provider before launch.

The same production Turnstile widget protects consultation submissions and
admin sign-in. Restrict it to the Valisen hostnames. The server validates every
token with Siteverify and checks the expected action (`consultation_request` or
`checkpoint_admin_login`) and hostname; the secret key never reaches the
browser.

Official references:

- [Cloudflare Turnstile server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [Cloudflare WAF rate-limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/)

## Assigning a checkpoint

1. Sign in at `/admin/login`.
2. Open `/admin/checkpoints`.
3. Find the checkpoint card.
4. Select **Move checkpoint** (arrow icon).
5. Enter the partner/business, location, optional installation notes, and
   effective Toronto date/time.
6. Confirm the move.

The initial `Unassigned` interval closes at the effective time and the new
placement begins. No NFC or QR change is required.

## Moving a checkpoint later

Use the same **Move checkpoint** action. PostgreSQL performs the change in one
transaction:

1. lock the permanent checkpoint;
2. close the placement covering the effective time;
3. preserve all sessions and events already bound to it;
4. create the next placement interval;
5. attribute sessions beginning after that time to the new placement.

A session that began at Coffee Shop A stays attributed to Coffee Shop A even if
the person finishes the flow after the hardware has moved to Salon B.

## Permanent NFC and QR URLs

The permanent URL format is:

```text
https://valisenmentalhealth.com/c/VMH-01
```

It never contains a business or location. In the dashboard:

- **Copy URL** copies the exact NFC URL.
- **Download QR** downloads a high-error-correction SVG QR generated by the
  Valisen server. No third-party QR service receives the URL or admin activity.

Program the NFC tag and print the QR once. Moving the checkpoint only changes
its database placement timeline.

## Anonymous tracking

The browser creates a cryptographically random UUID with `crypto.randomUUID()`
or `crypto.getRandomValues()` and keeps it in `sessionStorage`. It is a session,
not a claimed unique person. A different tab or later browser visit can become
a new session.

Allowed events are exactly:

```text
landing_view
checkin_started
checkin_step_completed
checkin_completed
result_viewed
therapist_cta_clicked
consultation_started
external_booking_clicked
```

Those eight names are the complete anonymous-browser allowlist.
`consultation_submitted` is intentionally absent: only the trusted
`record_checkpoint_consultation` server RPC can create that conversion after a
verified consultation request succeeds. A visitor therefore cannot forge the
most important KPI through the public event endpoint.

`checkin_step_completed` may carry only the integer step number 1–4. The API
rejects every unknown property. Server time is authoritative. Both the client
event UUID and `(session, event, logical step)` are unique, so retries and React
rerenders do not inflate counts.

The event route temporarily creates a keyed, in-memory digest of the request
network address for abuse limiting. The raw address and digest are never
written to analytics or the database and disappear with the serverless
instance.

Google Tag Manager, Google Ads, and the site's general first-party funnel are
disabled on `/c/*` and `/admin/*`. They also stay disabled throughout the same
browser-tab journey while a valid checkpoint session remains active, including
the consultation and therapist handoff. The dedicated checkpoint collector is
the only application telemetry for that journey.

## Questionnaire privacy confirmation

The four answers exist only in `CheckpointExperience` React state. Scoring is
performed by `calculateBatteryResult()` in the browser. Answers are not written
to `sessionStorage`, URLs, analytics payloads, server requests, Supabase,
Google Sheets, email, or the consultation handoff.

The PostgreSQL schema intentionally has no answer, score, visitor-provided
free-text, contact, IP, user-agent, fingerprint, ad-ID, or geolocation-coordinate
columns. The optional placement note is administrator-authored operational
metadata and is never accepted by a public endpoint.

## Consultation attribution

When a visitor chooses therapist support, the tab retains only:

- source `mental_battery_checkpoint`;
- anonymous session UUID;
- checkpoint code;
- the opaque placement ID returned by first-party event intake, when available.

The consultation form submits only source, session UUID, and checkpoint code.
The server does not trust a client placement ID. It resolves the existing
session and derives its immutable placement inside PostgreSQL.

After the existing consultation submission succeeds:

- the opaque `VC-*` reference is related to the session/checkpoint/placement;
- `consultation_submitted` is recorded server-side;
- the existing intake worksheet receives four appended attribution columns;
- the admin lead view shows the reference, checkpoint, historical placement,
  source, status, and date;
- no Mental Battery answer is attached.

Attribution persistence is idempotent and retried three times with bounded
backoff. A safe duplicate request can repair the same reference/session link
without sending another consultation email. If Supabase remains unavailable,
the successful consultation response includes a signed 30-minute, non-PII
repair capability. The browser can present only that opaque token to
`POST /api/checkpoint-attribution-retry`; the endpoint verifies its signature
and expiry before retrying the original immutable reference/checkpoint/session
link. The token contains no contact details or questionnaire answers.

The intake worksheet explicitly records **Attribution pending**. A successful
public repair updates that row to **Attributed** and stores the resolved
placement ID, but a Sheets failure never rolls back a successful database
repair. Pending rows also form a bounded operational outbox: after an
authenticated dashboard refresh returns, the server scans only the attribution
columns for at most 10,000 worksheet rows, retries up to three pending
links from a rotating cursor, and updates repaired rows. A 60-second in-flight
cooldown keeps dashboard polling from duplicating reconciliation work while the
rotation prevents an irreparable row from starving older entries. This
preserves recovery even if the visitor closes the tab while keeping dashboard
availability independent of Sheets.
Missing or invalid `CHECKPOINT_ATTRIBUTION_REPAIR_SECRET` configuration is
logged as an operational error without undoing the already accepted
consultation.

Names, email addresses, and mandatory phone numbers remain in Valisen's existing
consented consultation operations, not the anonymous checkpoint database.

## Dashboard definitions

All date ranges use a cohort of sessions whose `started_at` falls in
`[from, to)`. Every stage count is calculated against that same cohort so
conversion percentages remain internally consistent.

- **Sessions:** anonymous browser-tab sessions.
- **Check-ins Started:** sessions with `checkin_started`.
- **Completed Check-ins:** sessions with `checkin_completed`.
- **Therapist Intent:** sessions with `therapist_cta_clicked`.
- **Consultations Started:** sessions reaching the existing consultation flow.
- **Consultations Submitted:** voluntary, successful consultation submissions.
- **Session → Consultation:** submitted consultations divided by sessions.

Relative performance labels require at least 20 sessions. A “strongest” insight
requires at least 30 sessions and three submitted consultations. Smaller
samples display **Not enough data yet**.

The dashboard also reports question-by-question completion for steps 1-4 and
the exact number of sessions that exited before question 1 or after each
question. These counts contain only step numbers; no selected answer or score
is available to the server.

The dashboard refreshes visible data every 60 seconds and offers a manual
refresh. It is current without relying on fragile streaming connections.

## Security decisions

- strict JSON shapes, body limits, event/code/UUID/step allowlists;
- same-origin event and admin mutation requirements;
- best-effort network/session rate limiting for event intake;
- signed, expiring, non-PII consultation-attribution repair capabilities;
- database-level event idempotency and placement constraints;
- server-generated event timestamps;
- RLS with no public policies and service-secret-only RPCs;
- no database secret in client code;
- PBKDF2-HMAC-SHA256 admin password hash (600,000 iterations);
- timing-safe password and session-signature comparisons;
- eight-hour `__Host-`, HttpOnly, Secure, SameSite=Strict admin cookie;
- per-client and global login rate limits;
- Cloudflare Turnstile on both consultation submission and admin sign-in, with
  server-side action and hostname verification;
- no public admin registration;
- no Turnstile interruption for harmless anonymous funnel events;
- bounded streaming request-body reads that stop once an endpoint limit is
  crossed;
- deployment-level Cloudflare WAF rate limits for durable, cross-instance
  abuse protection;
- route-specific no-referrer, noindex, frame denial, permissions policy, CSP,
  and HSTS headers.

## Verification

Run before deployment:

```powershell
npm test
npm run typecheck
npm run lint
npm run build
npm audit
```

The browser QA script is:

```powershell
npm run test:checkpoints-ui
```

It checks the public flow at 375, 390, 430, and 1440 pixels and the admin UI at
1366, 1440, and 1920 pixels, including overflow and console errors. Admin QA
uses an intercepted dashboard API and must never seed fake production data.
For local authenticated screenshots, give both the development server and the
QA process the same disposable `CHECKPOINT_ADMIN_SESSION_SECRET`, and expose it
to the QA process as `CHECKPOINT_QA_ADMIN_SESSION_SECRET`. Never use the
production session secret for local QA.

## Remaining launch responsibilities

- Apply the migration to the selected Supabase project.
- Add the server-only environment values in Netlify and redeploy.
- Create the three Cloudflare WAF rate-limit rules documented above.
- Confirm the production domain's `/api/checkpoint-events` reaches the current
  Next.js runtime.
- Sign in, assign each physical checkpoint, and download/test each QR.
- Perform a real NFC scan and one test consultation using an internally marked
  test identity, then remove that operational test lead under Valisen's normal
  retention process.
- Have Valisen's privacy/legal owner approve Supabase terms, region, retention,
  access, incident-response, and processor documentation before launch.

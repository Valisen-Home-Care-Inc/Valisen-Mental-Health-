# Healthcare provider referrals ? email delivery

Public portal: https://valisenmentalhealth.com/referrals
Recipient: info@valisenmentalhealth.com
Subject: PATIENT REFERRAL | Healthcare Provider | VR-<reference>

## Production behavior

The form is enabled without an environment flag. REFERRALS_ENABLED is obsolete and ignored, even if its old value is false. New submissions are sent directly through the same Gmail transport as the site's other email forms. No referral details are written to Supabase, the CRM, Sheets, analytics, logs or browser storage. The email mailbox holds the referral record.

The old referral CRM navigation and database operations have been removed. Its bookmarked admin URL explains the new email workflow. The previously applied SQL migration can remain; its table/functions are no longer used by the application. Existing historical records have not been deleted or migrated into email. No further Supabase migration is required for this release.

## Required existing hosting settings

- GMAIL_USER and GMAIL_APP_PASSWORD: the same server-only Gmail credentials used by the existing consultation emails.
- NEXT_PUBLIC_TURNSTILE_SITE_KEY: the public widget key, available when building.
- TURNSTILE_SECRET_KEY: matching server-side bot-verification key.
- If TURNSTILE_ALLOWED_HOSTNAMES is configured, include the production domain.

No referral admin login, Supabase key or enable flag is required to submit referrals. Gmail/Turnstile credentials must remain valid. The API fails with a generic error if sending or verification fails; it never pretends an email was delivered. After email-server acceptance, the browser displays confirmation and clears patient fields. Mail server acceptance does not prove inbox placement; check spam and forwarding rules during launch testing.

## Clinic workflow

Watch info@valisenmentalhealth.com for PATIENT REFERRAL subjects. The message contains provider contacts, patient contacts, preferred contact method, referral details, therapist preference and the versioned authorization statement. Reply-To points to the provider. Contact the patient using the patient's details in the body. Clinical updates require separate authorization.

Consent and privacy text explicitly describe email delivery. The transport requires TLS; SMTP debug/body logging is disabled. No patient name or clinical concern appears in the subject. There is no automatic patient confirmation email and no automatic appointment booking.

Same-instance retries are deduplicated using a short-lived in-memory reference; a stable Message-ID and reference help identify duplicates across restarts/instances. Exactly-once delivery cannot be guaranteed without durable storage. Do not treat repeated copies with the same reference as new referrals.

## Referral resource

/referrals/guide downloads a real PDF generated from the current clinician roster. It contains the referral process, contact details, clinician credentials, languages, fees and profile URLs. There are no coming-soon resources.

## Release verification

Run lint, the production build, and the referrals.test.ts and referralEmail.test.ts tests. Browser QA covers isolated navigation and responsive layouts. Email tests mock SMTP and never send real patient details.

After deployment, send a clearly labelled test referral with contact details you control and confirm the PATIENT REFERRAL email arrives. This is the final delivery check before distributing the link to doctors. Do not paste hosting secrets into chat.

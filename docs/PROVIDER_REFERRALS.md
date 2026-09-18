# Provider referrals

Public route: `/referrals`. Private inbox: `/admin/checkpoints/referrals`.

The public referral area is self-contained: its own header/footer, clinician profiles at `/referrals/therapists/[slug]`, and privacy page at `/referrals/privacy-policy`. Logo, profile return links and CTAs stay within `/referrals`. Referring from a profile preselects that clinician. The main patient-facing site remains separate. This is a separate navigation experience on the existing domain, not a second hosting project. Browser history before entering this area is not trapped or rewritten.

## Activation

1. Apply `supabase/migrations/20260918000000_provider_referrals.sql` to the existing operations database.
2. Confirm server-only Supabase credentials, Turnstile site/secret keys and admin authentication are configured. Restrict existing admin credentials to personnel authorized to handle patient referrals.
3. Assign a staff member to monitor the private referral inbox regularly. This release does not send email notifications or auto-contact patients. Staff use the supplied contact preference and mark referrals contacted/closed.
4. Set `REFERRALS_ENABLED=true` and deploy. It defaults to disabled, with a visible telephone alternative and no active patient inputs. Test an authorized synthetic referral through the deployed system and verify it appears in the inbox before sharing the page.

### Exact launch checklist

1. **Database:** open the existing Supabase project's SQL editor and run the entire provider-referrals migration above. The migration creates the private table and three service-role-only functions. No new patient data goes to your existing marketing tables.
2. **Hosting environment:** confirm the following settings in the production hosting project. Reuse working existing values rather than rotating them just for referrals:

   | Setting | Required value |
   | --- | --- |
   | `SUPABASE_URL` | Existing Supabase project URL |
   | `SUPABASE_SECRET_KEY` | Server-only Supabase secret key; existing `SUPABASE_SERVICE_ROLE_KEY` is supported instead |
   | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Public Turnstile widget sitekey, available at build time |
   | `TURNSTILE_SECRET_KEY` | Matching private Turnstile secret, available to server functions |
   | `CHECKPOINT_ADMIN_PASSWORD_HASH` | Existing admin password hash |
   | `CHECKPOINT_ADMIN_SESSION_SECRET` | Existing admin session signing secret |
   | `REFERRALS_ENABLED` | `true` when ready to accept referrals |

   If using Netlify, use the project's environment-variable settings with Production context. The server settings must be available to Functions; the public sitekey must be available to Builds. Rebuild/redeploy after changing them. Do not put secret keys in `NEXT_PUBLIC_` variables or commit them. [Netlify environment variables](https://docs.netlify.com/build/environment-variables/overview/) and [function environment variables](https://docs.netlify.com/build/functions/environment-variables/).
3. **Turnstile:** register `valisenmentalhealth.com` (and `www.valisenmentalhealth.com` if used) on your widget. If `TURNSTILE_ALLOWED_HOSTNAMES` is already set on the server, it must include the hostname serving referrals. [Cloudflare hostname management](https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/).
4. **Admin access:** use the existing admin credentials. If admin authentication has never been configured, run `node scripts/hash-checkpoint-admin-password.mjs` in your own interactive terminal and save its generated settings in the hosting environment. The password stays private; do not paste it into chat. Access `/admin/login`, then `/admin/checkpoints/referrals`.
5. **Deploy this code**, then submit one clearly labelled test referral using contact details you control. Confirm success, confirm the record appears in the private inbox, and test changing its status to Contacted then Closed. Confirm an unauthenticated browser cannot access the inbox. Local mocked browser tests do not verify production delivery.
6. **Assign the inbox:** staff must check `/admin/checkpoints/referrals`, contact the patient through their preferred method, and update status. There are currently **no email alerts and no automatic patient outreach**.
7. **Share with doctors:** `https://valisenmentalhealth.com/referrals`. The referral PDF is optional for launch; its current coming-soon state does not block submissions.

The local `.env.local` inspected during implementation did not contain the required referral settings. The clinic has confirmed that the provider-referrals SQL migration ran successfully in Supabase. Production environment settings have not been inspected, and live patient collection still requires the enable flag, deployment and end-to-end test above.

The public form is separate from consultation booking. Success means a durable database receipt, not an appointment. Retries use the same in-memory UUID and the database primary key prevents duplicate records. Fields are validated client/server; POST requires same origin, bounded JSON, rate limiting and action-bound Turnstile. Validation/transport failures retain entries in component memory only.

## Information handling

The service-role-only table has RLS and no anonymous/authenticated access. Admin page/actions require the existing signed admin session. No patient fields, referral identifiers, or clinical notes enter analytics, advertising tags, email, Google Sheets, consultation CRM exports or browser storage. No clinical updates are automatically shared with referrers. The provider attests to patient authorization using versioned text; this is not consent for release of clinical records.

The inbox follows the site's administrative intake retention policy (minimum seven years); this release does not add automatic deletion. The clinic must apply its approved retention/access process, including backups and exports. This implementation does not independently certify PHIPA compliance or database residency. Confirm operational suitability before activating patient collection.

The page disables loading marketing tags. Navigation into the page uses a full document load to prevent previously loaded tags observing referral inputs. First-party events accept event names only and share the existing allow-listed funnel pipeline. Existing Google Ads sessions retain the current journey attribution behavior; referral events are not converted into consultation conversions. The guide-download event fires only when a real guide exists.

## Referral guide

No PDF existed at implementation time. Connect the approved PDF using `REFERRAL_GUIDE_URL` in `lib/referrals.ts`; until then the resource clearly says “Guide coming soon”, with no broken download link.

## Verification

`npm run lint`, `npm run typecheck`, `npm run build`, and `npx vitest run lib/__tests__/referrals.test.ts`.
`node scripts/referrals-qa.mjs` runs responsive/link/interaction checks against `SITE_URL` (default port 3000). Its submission states use a mocked API and must not be confused with a production delivery test.
`node scripts/referral-navigation-qa.mjs` verifies every referral profile, browser Back, explicit return links, therapist preselection, privacy and not-found navigation on mobile and desktop against `SITE_URL` (default port 3101).

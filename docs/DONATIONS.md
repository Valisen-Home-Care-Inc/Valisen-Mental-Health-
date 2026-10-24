# Subsidized psychotherapy contributions (`/donate`)

One-time CAD contributions through Stripe-hosted Checkout. Contributions fund
Valisen's subsidy fund, which reduces session fees for clients facing financial
barriers.

## What lives where

| Piece | File |
| --- | --- |
| **Editable program policy** (eligibility, unused funds, tax status, refunds, fees) | `lib/donations/program.ts` |
| Preset amounts, limits, server/client validation | `lib/donations/contract.ts` |
| Statistics shown on the page, with sources | `lib/donations/facts.ts` |
| Page | `app/donate/page.tsx`, `app/donate/donate.module.css` |
| Contribution form + sticky mobile button | `components/donate/DonationForm.tsx` |
| Success / processing / incomplete page | `app/donate/thank-you/page.tsx` |
| Create Checkout Session | `app/api/donations/checkout/route.ts` |
| Stripe webhook | `app/api/donations/webhook/route.ts`, `lib/server/donationWebhook.ts` |
| Donation records (Supabase) | `supabase/migrations/20261024000000_donations.sql`, `lib/server/donationRepository.ts` |
| Private report | `/admin/checkpoints/donations` (existing admin login) |
| Analytics | `lib/donationAnalytics.ts` |

To change what donors are told about the program, edit only
`lib/donations/program.ts`. Do not add client stories, totals or numeric
eligibility rules unless they are true and approved.

## How a payment flows

1. The visitor picks a preset ($20, $50, $80, $180) or a custom amount
   ($5–$5,000, whole dollars) and taps **Contribute**.
2. The browser posts `{ option, dollars, attemptId, attribution }` to
   `/api/donations/checkout`. The server checks same-origin, content type,
   body size, a per-IP rate limit (30 per 10 minutes, per server instance),
   re-validates the amount, computes the cents itself, and creates a Stripe
   Checkout Session (idempotency key per attempt and amount).
3. The visitor pays on Stripe's page. Valisen never sees card details.
4. Stripe sends signed webhook events. Only signature-verified events for
   sessions tagged `metadata.purpose = valisen_subsidized_psychotherapy`
   are recorded. Each Stripe event id is stored once, so duplicate deliveries
   are no-ops, and a status never moves backwards.
5. Stripe returns the visitor to `/donate/thank-you?session_id=…`. The page asks
   Stripe for the session's real status and shows paid, processing, or not
   completed. It never writes a record; reaching the URL proves nothing.

Cancelled checkouts return to `/donate?checkout=cancelled`, which shows a
"no payment was made" notice and keeps the form ready.

## Environment variables

Set these in Netlify (**Site configuration → Environment variables**) for
**all scopes and deploy contexts** (Builds and Functions), then redeploy.

| Variable | Value |
| --- | --- |
| `STRIPE_SECRET_KEY` | `sk_test_…` for testing, `sk_live_…` for real payments. A restricted key (`rk_…`) also works if it has **Checkout Sessions: Write** and **PaymentIntents: Read**. |
| `STRIPE_WEBHOOK_SECRET` | The `whsec_…` signing secret of the webhook endpoint below. Test and live endpoints have different secrets. |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Already configured for the CRM. Used for donation records. |
| `NEXT_PUBLIC_SITE_URL` | Already set (`https://valisenmentalhealth.com`). Stripe returns visitors here. |

If `STRIPE_SECRET_KEY` is missing or malformed, the page shows "Online
contributions aren't available right now" with the clinic's email and phone,
and the API returns 503. If `STRIPE_WEBHOOK_SECRET` is missing, the webhook
returns 503 and Stripe keeps retrying for up to three days, so nothing is lost
once it is configured. The page re-checks availability every 5 minutes.

## One-time setup

1. **Database:** run `supabase/migrations/20261024000000_donations.sql` in the
   Supabase SQL editor (safe to re-run). Until it is applied, the webhook
   returns 500 and Stripe retries.
2. **Stripe account:** confirm the public business name and statement
   descriptor read as Valisen Mental Health, and that the account can accept
   CAD.
3. **Payment methods:** Settings → Payment methods. Checkout shows whatever is
   enabled there (cards, Apple Pay, Google Pay, Link). No code change needed.
4. **Payment confirmation emails:** Settings → Customer emails → turn on
   emails for **successful payments** (and refunds). The site tells donors a
   confirmation is emailed. Stripe does not send these emails in test mode.
5. **Webhook endpoint:** Developers → Webhooks → Add endpoint
   - URL: `https://valisenmentalhealth.com/api/donations/webhook`
   - Events: `checkout.session.completed`,
     `checkout.session.async_payment_succeeded`,
     `checkout.session.async_payment_failed`, `charge.refunded`
   - API version: `2026-09-30.endive` (the version the code pins in
     `lib/server/stripe.ts`)
   - Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
   Create one endpoint in test mode and one in live mode.

## Test before going live (Stripe test mode)

With `sk_test_…` keys and the test-mode webhook secret deployed:

1. Open `/donate` on a phone, pick $50, pay with `4242 4242 4242 4242`, any
   future expiry, any CVC. You should land on "Thank you. Your contribution
   went through." with a **Test mode** badge.
2. Try a custom amount, a 3-D Secure card (`4000 0025 0000 3155`) and a
   declined card (`4000 0000 0000 0002`). Cancel once from Checkout and
   confirm the "no payment was made" notice.
3. In Stripe → Webhooks, every delivery should show `200`.
4. Admin → **Contributions** → **Test mode** should list the payments.
5. Refund one payment in Stripe; the admin row should show **Refunded**.

Local testing: `stripe listen --forward-to localhost:3000/api/donations/webhook`
prints a temporary `whsec_…` to use as `STRIPE_WEBHOOK_SECRET` in `.env.local`.

## Going live

Swap in `sk_live_…` and the **live** endpoint's `whsec_…`, redeploy, make one
real $5 custom contribution, confirm it appears under **Live payments**, then
refund it from Stripe.

## QR codes and attribution

Add UTM parameters to printed links so the admin report can attribute
contributions, for example:

```
https://valisenmentalhealth.com/donate?utm_source=cars-and-coffins&utm_medium=qr&utm_campaign=halloween-2026
```

`utm_source`, `utm_medium`, `utm_campaign` and `utm_content` are copied into
Stripe metadata and the donation record. Nothing else from the URL is kept.

## Analytics

Events go to the existing GTM `dataLayer` (skipped during Google Ads journeys,
matching `lib/analytics.ts`):

| Event | When |
| --- | --- |
| `donate_page_viewed` | `/donate` loads |
| `donation_amount_selected` | A preset is chosen or a valid custom amount is entered |
| `donation_checkout_started` | The server created a Checkout Session and the visitor is sent to Stripe |
| `donation_checkout_failed` | Validation, rate-limit, network or server failure (`failure_reason`) |
| `donation_checkout_cancelled` | The visitor returned from Checkout without paying |
| `donation_completed` | Only on the thank-you page after Stripe confirms `paid`; once per payment per browser, with `transaction_id` for GA4 de-duplication |

Payloads can only carry `value`, `currency`, `donation_option`,
`cta_placement`, `failure_reason`, `transaction_id`, `device_category`, `page`
and the four UTMs. No names, emails, card data or health information. The
session id is removed from the address bar before marketing tags load. The
webhook-written records remain the source of truth for revenue.

## Known limits

- The rate limit is in memory per server instance (same as the existing quiz
  limiter). Stripe's own fraud protection covers Checkout itself.
- Deploy previews return visitors to the production domain after Checkout.
  Test on production with test keys, or locally.
- Records start when the migration and webhook are in place. Earlier payments
  are still in the Stripe Dashboard.

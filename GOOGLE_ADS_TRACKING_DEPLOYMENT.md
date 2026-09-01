# Google Ads same-domain tracking: setup and QA

## What changed

Google Ads no longer needs `ads.valisenmentalhealth.com` or separate campaign
pages. Every ad group can use the normal homepage, `https://valisenmentalhealth.com`.
When Google auto-tagging adds a valid `gclid`, `gbraid`, or `wbraid`, the homepage
quietly passes through the same-domain signer and returns to the identical
homepage with a signed, per-tab Google Ads journey.

The visitor sees the same production pages and navigation as everyone else.
Only a valid signed entry can write to the Google Ads CRM. Direct, organic,
Meta, copied landing-page URLs, crawlers, Netlify aliases, and deploy previews
cannot opt themselves into that stream. A new non-Google campaign, a direct
new navigation, an explicit untracked entry, or 30 minutes of inactivity clears
the marker.

The tracker records only closed structural data: allow-listed page/section
visits, active time, scroll milestones, safe click categories, consultation CTA
clicks, form progression, a durable consultation link, the matched keyword from
the advertiser's Google Ads account, and staff-updated booked or paid stages. It
does not store the person's actual Google search phrase, names, contact values,
form text, quiz answers, raw click IDs, crisis-resource calls, DOM content, or
arbitrary URLs in journey events.

## URLs to view manually

Untracked visual preview (this is the actual ad experience but does not create
Ads CRM data without a Google click ID):

- `http://localhost:3000/`
- `http://localhost:3000/admin/checkpoints/google-ads`

Tracked local test, with `GOOGLE_ADS_CONVERSION_SECRET` configured locally:

`http://localhost:3000/?gclid=local-test-123&utm_campaign=manual_test&utm_content=creative_1`

Tracked production QA (each new Incognito window creates a fresh signed
session):

`https://valisenmentalhealth.com/?gclid=manual-test-20260823&utm_campaign=manual_test&utm_content=qa`

Production CRM:

`https://valisenmentalhealth.com/admin/checkpoints/google-ads`

A direct `/thank-you` visit intentionally returns to `/consultation`. The thank
you page appears only after a durable Google Ads consultation request and a
one-use signed conversion receipt.

## Deployment steps

1. Leave the already-applied
   `supabase/migrations/20260823000000_google_ads_journey.sql` alone. “Success,
   no rows” was the expected result.
2. Leave the already-applied same-domain hardening migration
   `supabase/migrations/20260823010000_google_ads_same_domain_hardening.sql`
   unchanged.
3. In the Supabase SQL Editor, run the new reporting-period migration:
   `supabase/migrations/20260823020000_crm_reporting_period_archives.sql`.
   “Success, no rows” is expected. This adds non-destructive archive/reset
   controls to every CRM dashboard.
4. In the Supabase SQL Editor, run the protected QA visibility migration:
   `supabase/migrations/20260823030000_google_ads_test_qa_visibility.sql`.
   “Success, no rows” is expected. This restores test journeys and test
   consultations under the CRM's **Test QA** scope while keeping **Live
   campaign** metrics clean.
5. Run the consultation-trigger hotfix:
   `supabase/migrations/20260823040000_google_ads_consultation_trigger_hotfix.sql`.
   "Success, no rows" is expected. Its transactional self-test verifies a
   complete manual Google Ads consultation save and rolls the test record back.
6. Run the universal landing page migration:
   `supabase/migrations/20260830000000_universal_google_ads_landing.sql`.
   "Success, no rows" is expected. This adds `/welcome` to the closed
   allowlist of trackable Google Ads paths. Without this step, journeys and
   events on `/welcome` are rejected at the database level even though the
   app code is deployed correctly — run it before testing tracking on the
   new landing page.
8. Keep `GOOGLE_ADS_CONVERSION_SECRET` in Netlify as a server-only secret. It
   must be at least 32 random bytes. Do not prefix it with `NEXT_PUBLIC_` and do
   not put it in Supabase.
9. Keep the existing Supabase URL/service-role credentials in Netlify; this
   change adds no new browser/public API key.
10. Deploy the main Netlify site.
11. Open the production QA URL in a fresh Incognito window, navigate to at least
   two pages, and submit one real Turnstile-protected test consultation. In both
   the Google Ads and Consultations CRM sections, switch from **Live campaign**
   to **Test QA** and verify the journey and `VC-...` consultation there.
12. After the main-domain test passes, remove the obsolete subdomain setup:
   remove the Netlify custom domain `ads.valisenmentalhealth.com`, delete the
   GoDaddy `ads` CNAME, remove that hostname from the Cloudflare Turnstile
   allowlist, delete `NEXT_PUBLIC_GOOGLE_ADS_HOSTNAME`, and remove the ads host
   from `TURNSTILE_ALLOWED_HOSTNAMES`. Keep the main/apex hostname.

The second migration also makes conversion confirmation safe to retry after a
lost response, creates the Ads session from a verified consultation even when
the event endpoint was blocked, permits cloned-tab event sequences, and applies
retention cleanup: unconverted detailed events expire after 90 days; all
detailed events and unconverted summaries expire after 13 months. Linked CRM
records retain their summary under the clinic’s administrative retention rules.

## Google Ads final URLs

Use this same final URL for every campaign and ad group:

`https://valisenmentalhealth.com/google-ads`

This is the only campaign landing URL. Older `/google-ads/anxiety`,
`/google-ads/depression`, and `/google-ads/couples` aliases all resolve to the
same universal landing page for legacy safety and must not be assigned to new ads.

Keep Google Ads auto-tagging on. To label CRM sessions with the exact Google Ads
ad-group ID and the matched keyword, set this **Final URL suffix** at the account
or campaign level (do not include a leading `?`):

`vmh_campaignid={campaignid}&vmh_adgroupid={adgroupid}&vmh_keyword={keyword}`

Google ValueTrack exposes the numeric ad-group ID, but not its human-readable
name. For both the readable name and ID, set the complete suffix separately on
each ad group. Current examples are:

- Therapy Ontario:
  `vmh_campaignid={campaignid}&vmh_adgroupid={adgroupid}&vmh_adgroup=Therapy-Ontario&vmh_keyword={keyword}`
- High Intent Book Now:
  `vmh_campaignid={campaignid}&vmh_adgroupid={adgroupid}&vmh_adgroup=High-Intent-Book-Now&vmh_keyword={keyword}`
- General Online Therapy:
  `vmh_campaignid={campaignid}&vmh_adgroupid={adgroupid}&vmh_adgroup=General-Online-Therapy&vmh_keyword={keyword}`

Use the same pattern for future ad groups, changing only the `vmh_adgroup`
label. Every ad must use `https://valisenmentalhealth.com/google-ads` as its Final URL.
Older visits cannot be retroactively assigned a keyword and will say **Not
captured** in the CRM. `{keyword}` is the account keyword that matched the ad;
Google can leave it empty for campaign types that do not use keywords.

The signer forces `utm_source=google` and `utm_medium=cpc`. Never append an
actual search query, email, phone, or any contact/form value. The allow-listed
ValueTrack fields above are sanitized, sealed into the signed journey, and
removed from the visible landing URL. Raw `gclid`, `gbraid`, and `wbraid` values
are moved into a one-time fragment, kept only in that browser tab, and also
removed from the visible landing URL.

## Starting a new reporting period

Each CRM section now has **Archive & start fresh** near the top. Give the period
a useful name, confirm, and the live cards begin again from zero. The operation
does not delete source records: it stores a privacy-safe snapshot and advances
only that section's reporting cutoff. Older snapshots remain under **Archives**
and can be downloaded as JSON. Downloads retain the frozen reset-time snapshot
and also reconcile delayed booked/paid updates back to the original period. In
Consultations, unresolved older follow-ups remain visible as carryover so no
client coordination is lost.

## GTM conversion setup

The application emits this event only after the server atomically confirms the
linked consultation:

`google_ads_consultation_conversion`

Create Data Layer Variables for:

- `analytics_context`
- `vmh_conversion_only`
- `vmh_conversion_id`

Create one Google Ads conversion tag using the real conversion ID and label.
Set its Transaction ID from `vmh_conversion_id`. Its trigger must require every
condition below:

- Custom Event equals `google_ads_consultation_conversion`
- Page Hostname equals `valisenmentalhealth.com`
- Page Path equals `/thank-you`
- `analytics_context` equals `google_ads_conversion_only`
- `vmh_conversion_only` equals `true`

Do not use an All Pages, pageview-only, hostname-only, URL-only, or path-only
conversion trigger. Direct visits and refreshes must not count.

Because the confirmed thank-you loads the existing GTM container on the main
hostname, add an exception to every ordinary GA4, Meta, remarketing, and other
All Pages tag when `analytics_context` equals
`google_ads_conversion_only`. Only the dedicated conversion tag may fire in
that context. Consent Mode defaults are queued as denied before the conversion;
personalized-ad signals remain disabled.

Keep click-ID staging in place and use Tag Assistant on one real auto-tagged
click. Verify exactly one Google Ads tag conversion, the same transaction ID on
any network retry, zero conversion on refresh, and no GA4/Meta/remarketing tag
in the conversion-only context. Do not spend until this test passes.

## Automated and manual verification

With the app running locally and the signing secret configured, run:

```text
npm test
npm run lint
npm run typecheck
npm run build
npm run test:google-ads-ui
```

The browser QA writes screenshots and a report to `artifacts/google-ads/`.
Production still needs a real Turnstile submission, Supabase/CRM verification,
and Tag Assistant because local mocks cannot prove live Google attribution.

Finally, this is behavioral analytics on mental-health pages that may later be
linked to a voluntarily submitted consultation. Before ad spend, have the
clinic’s privacy adviser approve the notice/consent approach and retention
schedule. Do not enable health-based remarketing, advertiser-created health
audiences, or enhanced-conversion contact uploads without a separate review.

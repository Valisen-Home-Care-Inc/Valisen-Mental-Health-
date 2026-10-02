# Google Ads same-domain tracking: setup and QA

## What changed

Google Ads no longer needs `ads.valisenmentalhealth.com`. Current ads use the
dedicated landing page, `https://valisenmentalhealth.com/welcome`. When Google
auto-tagging adds a valid `gclid`, `gbraid`, or `wbraid`, any approved final URL
quietly passes through the same-domain signer and returns to that exact page
with a signed, per-tab Google Ads journey.

The visitor sees the same production pages and navigation as everyone else.
Only a valid signed entry can write to the Google Ads CRM. Direct, organic,
Meta, copied landing-page URLs, crawlers, Netlify aliases, and deploy previews
cannot opt themselves into that stream. A new non-Google campaign, a direct
new navigation, an explicit untracked entry, or 30 minutes of inactivity clears
the marker.

The tracker records only closed structural data: allow-listed page/section
visits, active time, scroll milestones, safe click categories, consultation CTA
clicks, form progression, which allow-listed consultation fields received an
entry, a durable consultation link, the matched keyword from the advertiser's
Google Ads account, and staff-updated booked or paid stages. Field-entry events
contain only identifiers such as `full-name`, `email`, or `availability`; they
never contain what the person typed or selected. The tracker does not store the
person's actual Google search phrase, names, contact values, form text, quiz
answers, raw click IDs, crisis-resource calls, DOM content, or arbitrary URLs
in journey events.

### September 2026 accuracy update

- **Signed entry requests are saved at click time.** The `/welcome` page now
  redirects a real Google click on the server (before any HTML is sent) and the
  signer creates the CRM session row immediately. The current final-URL
  dashboard counts a session only after recorded browser activity or a
  confirmed consultation. Requests without either are shown separately as
  excluded entry requests. Saving a row at click time does not itself increase
  the displayed Ad sessions total.
- **One bad event no longer drops the batch.** The event endpoint keeps the
  valid events and discards only the malformed one; a device whose clock is
  wrong has its timestamps corrected server-side instead of being rejected.
- **Exit signals are no longer lost.** The browser tracker now beacons every
  queued event on page hide even while another request is in flight, credits
  visible time before hydration, and sends its first active-time ping after
  three seconds, so short visits show real active time instead of `0s`.
- **Neutral event path.** Batches post to `/api/journey/steps` (the old
  `/api/google-ads/events` path still works) so content blockers that match
  "ads" in URLs cannot silently drop journeys.
- **Campaign, ad group, keyword, and match type are first-class.** They are
  sealed into the signed token, stored in their own columns at click time, and
  shown in the CRM with a diagnostic when a click arrives without the suffix.
  Google's own `gad_campaignid` parameter is read as a campaign-ID fallback.
- **CSV export.** The Google Ads tab has an **Export** menu: journeys (one row
  per session), the full event timeline, or the on-screen summary.

## URLs to view manually

Untracked visual preview (this is the actual ad experience but does not create
Ads CRM data without a Google click ID):

- `http://localhost:3000/welcome`
- `http://localhost:3000/admin/checkpoints/google-ads`

Tracked local test, with `GOOGLE_ADS_CONVERSION_SECRET` configured locally:

`http://localhost:3000/welcome?gclid=local-test-123&utm_campaign=manual_test&utm_content=creative_1`

Tracked production QA (each new Incognito window creates a fresh signed
session):

`https://valisenmentalhealth.com/welcome?gclid=manual-test-20260901&utm_campaign=manual_test&utm_content=qa`

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
6. Run the latest welcome tracking hotfix in the Supabase SQL Editor:
   `supabase/migrations/20260901000000_google_ads_welcome_tracking_hotfix.sql`.
   "Success, no rows" is expected. It safely replaces the complete closed
   path allowlist, so it works whether or not the earlier universal-landing
   migration was run manually. Without this step, journeys and events on
   `/welcome` are rejected at the database level even though the app code is
   deployed correctly.
7. Run the click-attribution migration in the Supabase SQL Editor:
   `supabase/migrations/20260903000000_google_ads_click_attribution.sql`.
   "Success, no rows" is expected. It is safe to run more than once. It adds
   the campaign / ad group / keyword / match-type columns (backfilling older
   sessions from their encoded `utm_content`), installs
   `seed_google_ads_session` (click-time session creation), replaces both
   dashboard RPCs with the richer contract, adds the two export RPCs, and ends
   with a transactional self-test that seeds a session, ingests events through
   the production RPC, reads it back through the QA dashboard and both exports,
   proves the live dashboard excludes it, and rolls everything back. If the
   self-test fails, nothing is committed and the error names the failing step.
   Until this migration is applied the app keeps working with the previous
   behaviour: the signer falls back to `ensure_google_ads_session`, the
   dashboard decodes ad group/keyword from `utm_content`, and the **Export**
   menu explains that the migration is still needed.
8. Run the privacy-safe form-field migration in the Supabase SQL Editor:
   `supabase/migrations/20260904000000_google_ads_form_field_entry.sql`.
   "Success, no rows" is expected. It adds the closed `form_field_entered`
   event and ordered field-name summaries to both Live campaign and Test QA
   journey details. It does not add any column capable of storing field values.
9. Keep `GOOGLE_ADS_CONVERSION_SECRET` in Netlify as a server-only secret. It
   must be at least 32 random bytes. Do not prefix it with `NEXT_PUBLIC_` and do
   not put it in Supabase.
10. Keep the existing Supabase URL/service-role credentials in Netlify; this
   change adds no new browser/public API key.
11. Deploy the main Netlify site.
12. Open the production QA URL in a fresh Incognito window, navigate to at least
   two pages, and submit one real Turnstile-protected test consultation. In both
   the Google Ads and Consultations CRM sections, switch from **Live campaign**
   to **Test QA** and verify the journey and `VC-...` consultation there. The
   journey should show **Counted at: Click time (server)**, a non-zero active
   time, and the campaign/ad group/keyword from the QA URL.
13. After the main-domain test passes, remove the obsolete subdomain setup:
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

`https://valisenmentalhealth.com/welcome`

The internal `/google-ads` routes remain diagnostic signer endpoints and must
not be entered as the campaign Final URL. The app now signs direct auto-tagged
clicks on `/welcome` before React loads. If approved final URLs are mixed in the
future, each journey retains and displays the exact landing path separately in
the CRM.

Keep Google Ads auto-tagging on. Google adds `gclid` (or `gbraid`/`wbraid` on
iOS), `gad_source=1`, and `gad_campaignid` to every click by itself; those are
enough for the CRM to **count** the click. To also see the campaign name, ad
group, matched keyword, match type, network, and device, set a **Final URL
suffix** on **each ad group** (Google Ads → Ad groups → select the ad group →
Settings → Ad group URL options → Final URL suffix). Do not include a leading
`?`. Replace the two typed labels with your own names (letters, digits, spaces,
hyphens):

```text
vmh_campaignid={campaignid}&vmh_campaign=Therapy-Ontario-Search&vmh_adgroupid={adgroupid}&vmh_adgroup=Therapy-Ontario&vmh_keyword={keyword}&vmh_matchtype={matchtype}&vmh_network={network}&vmh_device={device}&vmh_creative={creative}
```

Current ad groups, each with its own suffix:

- Therapy Ontario:
  `vmh_campaignid={campaignid}&vmh_campaign=Therapy-Ontario-Search&vmh_adgroupid={adgroupid}&vmh_adgroup=Therapy-Ontario&vmh_keyword={keyword}&vmh_matchtype={matchtype}&vmh_network={network}&vmh_device={device}&vmh_creative={creative}`
- High Intent Book Now:
  `vmh_campaignid={campaignid}&vmh_campaign=Therapy-Ontario-Search&vmh_adgroupid={adgroupid}&vmh_adgroup=High-Intent-Book-Now&vmh_keyword={keyword}&vmh_matchtype={matchtype}&vmh_network={network}&vmh_device={device}&vmh_creative={creative}`
- General Online Therapy:
  `vmh_campaignid={campaignid}&vmh_campaign=Therapy-Ontario-Search&vmh_adgroupid={adgroupid}&vmh_adgroup=General-Online-Therapy&vmh_keyword={keyword}&vmh_matchtype={matchtype}&vmh_network={network}&vmh_device={device}&vmh_creative={creative}`

Rules and limits:

- `{campaignid}`, `{adgroupid}`, `{keyword}`, `{matchtype}`, `{network}`,
  `{device}`, and `{creative}` are Google ValueTrack placeholders that Google
  fills in at click time. `vmh_campaign` and `vmh_adgroup` are typed by you
  because ValueTrack only exposes numeric IDs, not names.
- An ad-group-level suffix overrides a campaign- or account-level one, so
  set it on every ad group (or on the campaign only if every ad group may share
  one `vmh_adgroup` label).
- `{keyword}` is the **account keyword that matched**, never the visitor's
  search phrase. Google does not expose the actual search query in the click
  URL to any advertiser; the only source is **Google Ads → Insights and reports
  → Search terms**, which is aggregated. The CRM therefore shows the matched
  keyword and match type, and the Search terms report shows the queries behind
  each keyword.
- Older visits cannot be retroactively assigned a keyword and will say
  **Not captured**. When a live click arrives without any suffix data the CRM
  flags it ("Google click arrived without the final URL suffix"), and a banner
  appears when no click in the selected range carried it — that is the signal
  that the suffix is not applied in the Google Ads account.
- Use `https://valisenmentalhealth.com/welcome` as the Final URL on every ad.

The signer forces `utm_source=google` and `utm_medium=cpc`. Never append an
actual search query, email, phone, or any contact/form value. The allow-listed
ValueTrack fields above are sanitized, sealed into the signed journey, and
removed from the visible landing URL. Raw `gclid`, `gbraid`, and `wbraid` values
are moved into a one-time fragment, kept only in that browser tab, and also
removed from the visible landing URL.

## Exporting Google Ads data

The Google Ads CRM tab has an **Export** menu beside the refresh button. It
follows the selected scope (Live campaign / Test QA) and date range:

- **Journeys (CSV)** — one row per ad session: clinic-local and UTC start time,
  session length, active time, whether it was counted at click time, final URL,
  last page, campaign, ad group, keyword, match type, network, device, whether
  the suffix was received, event/page counts, scroll depth, CTA/form/request
  flags, the consultation reference and booking/paid stages, and the raw
  campaign dimensions.
- **Event timeline (CSV)** — every recorded event with clinic-local time,
  seconds since session start, page and section labels, and safe targets.
- **Dashboard summary (CSV)** — the KPIs, funnel, campaign, page, section, and
  interaction tables currently on screen.

Exports are capped (10,000 journeys / 30,000 events per file) to stay within
serverless response limits; the dashboard says when a narrower range is needed.
Files open directly in Excel or Google Sheets and never contain names, contact
details, form text, or search queries.

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

To compare the CRM with Google Ads, match the date range, account timezone,
final URL tab, **Live campaign** scope, and the CRM reporting-period cutoff.
The **Ad sessions** card counts journeys with recorded browser activity or a
confirmed consultation; entry requests without either are listed separately
above the report. These are different measures from Google's **Clicks**, and
the CRM does not import Google's click totals. Google also documents why a
click may not produce a recorded visit, including leaving before tracking
loads: [Clicks and sessions discrepancies](https://support.google.com/google-ads/answer/14452452?hl=en).

### October 2, 2026 production tracking audit

The final-URL report counted **Consultation form opened** for `/consultation`
page views and focused-page booking starts. The inline `/welcome` form sends
`consultation_step_viewed` for step 1, but that signal was omitted from the
funnel calculation. The report now includes it, once per session, preserving
the original final URL and the separate Live/Test QA scopes. Existing stored
step-view events can contribute immediately; no event backfill is needed.
The audited September 3–October 2 UTC window had 148 live `/welcome` sessions
with this signal, all omitted from that funnel stage before the fix.

Session totals, entry-only exclusions, event ingestion, attribution rules, and
Google conversion-tag behavior were left unchanged. The audit reviewed the
signer, browser queue, event endpoint, export-backed reporting, and regression
coverage, followed by read-only production Supabase checks around
2026-10-02 04:00–04:09 UTC. No visitor contact details or raw event records
were returned by those audit queries.

Findings:

- From September 3 at 04:00 UTC, the CRM export RPCs returned all **314 journey
  records and 3,403 stored events**, matching direct database counts. Stored
  event counts and engagement totals also matched their underlying events.
- **223 journeys had recorded activity**; 91 were entry requests without
  recorded browser events. Most exclusions came from the older `/welcome`
  traffic. Do not add them to visit counts without evidence of a visit.
- Since September 12 at 04:00 UTC, all **122 recorded sessions** had their
  opening page/journey events and continuous recorded event sequences. Nine
  further entry requests had no browser events. The earlier missing-opening
  pattern was absent from this recent cohort. This does not prove that a final
  event or an entirely blocked visit could never be lost.
- All **54 recorded sessions on the newer focused landing pages** had campaign,
  ad-group, and keyword attribution. `/welcome` received no new entries after
  September 19 at 02:51 UTC in the checked data; later traffic belongs to the
  separate `/welcome/...` tabs. Use the existing all-URL activity overview to
  find the destination, then inspect its tab.
- The one all-time non-test Google Ads consultation request had its verified
  journey link. There were no orphaned Ads requests in that check.
- Required seed, ingestion, export, and Live/Test dashboard RPCs and
  attribution columns were installed. Anonymous roles could neither ingest
  directly into the database nor export journeys; the service role could ingest.
  The active reporting cutoff was August 24, before the audited cohort.
- Migration history omits several manually installed Ads changes, but their
  actual functions and columns are present. No historical migrations were
  rerun or unrelated schema changes applied during this audit.

The remaining entry-only gap cannot be assigned to Google or the website from
CRM data alone. Possible causes include early departure, blocked JavaScript or
storage, and failed delivery before any event was saved. Google Ads account
click totals, network/server logs for those entries, and live GTM configuration
were not available. No speculative ingestion or attribution changes were made.

Validation: 755 unit tests and the production build passed on the current
production branch. Browser checks covered signed entry, Meta isolation,
cross-page continuity, confirmation retries, duplicate conversion prevention,
and a focused Arabic booking through its neutral confirmation page. The
broader landing script rendered all 18 destinations and completed the three
Meryem booking fixtures; its separate fixed-Monday shared-calendar scenario
timed out, so the Ads conversion scenario was run and passed independently.

Missing campaign/ad-group labels require the configured final URL suffix to
reach the site. A missing matched keyword alone does not prove tracking failed:
Google can leave ValueTrack parameters empty when a value is unavailable.
See [Google's ValueTrack documentation](https://support.google.com/google-ads/answer/2375447?hl=en).

Finally, this is behavioral analytics on mental-health pages that may later be
linked to a voluntarily submitted consultation. Before ad spend, have the
clinic’s privacy adviser approve the notice/consent approach and retention
schedule. Do not enable health-based remarketing, advertiser-created health
audiences, or enhanced-conversion contact uploads without a separate review.

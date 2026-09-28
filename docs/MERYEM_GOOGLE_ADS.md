# Meryem's Muslim and Arabic Google Ads groups

The clinic confirmed on September 27, 2026 that Meryem Ibrahim offers couples and
marriage therapy and explicitly faith-integrated Islamic counselling. The new
pages use the approved single-page design, her existing photograph and named
20-minute phone consultations. Her RP (Qualifying) designation stays visible.
Online delivery across Ontario, including Ottawa and Toronto, is explicit.

| Final URL | Exact-match keywords | Intent |
| --- | ---: | --- |
| https://valisenmentalhealth.com/welcome/muslim-therapy | 13 | Muslim therapist / Islamic counselling / online / Ottawa / Toronto |
| https://valisenmentalhealth.com/welcome/female-muslim-therapist | 6 | Female Muslim / hijabi therapist |
| https://valisenmentalhealth.com/welcome/muslim-marriage | 6 | Muslim couples / Islamic marriage counselling |
| https://valisenmentalhealth.com/welcome/arabic | 5 | Arabic-speaking therapist; existing translated page |

The 30 supplied keywords appear verbatim in `lib/paidSearchKeywordMap.json`.
On September 28, the owner split them into `03 - Muslim & Islamic Therapy`
(25 keywords across the three Muslim-focused pages) and `04 - Arabic Therapy`
(5 keywords using `/welcome/arabic`). `/ads-preview/keyword-map` downloads all 83
mapped keywords across four groups. The original 53 keywords and paused exclusions are
preserved. Campaign settings are managed in Google Ads; this release does not
change bids, audiences or campaign configuration.

The existing CRM accepts both ad-group IDs and labels from the `vmh_adgroupid`
and `vmh_adgroup` suffix parameters without a code or database migration. Keep
plain underscores in parameter names, with no backslashes or leading question
mark. Google expands the ValueTrack placeholders on ad clicks. The existing
text sanitizer removes ampersands from displayed labels; the group IDs and
separate attribution remain intact. Historical sessions retain their original labels.

## Shared calendar

Only Meryem can be selected on the three new pages and the Arabic page. They use
the existing shared reservation RPC and her permanent Toronto-time shifts:
Sunday 9 a.m.–8 p.m.; Tuesday 9 a.m.–6 p.m. Each call lasts 20 minutes and must fit
inside the shift. General welcome/quiz calendars retain other clinicians' capacity.
The server rejects an off-roster clinician, and retries preserve booking identity.

Individual sessions retain Meryem's current $160 CAD / 50-minute fee. Couples
sessions use the clinic's confirmed $200 CAD / 50-minute fee, total for both
partners. The booking submission identifies couples therapy on the marriage page.
All three pages allow English or Arabic calls; their page copy is English. The
existing Arabic destination retains native Arabic and its visible English toggle.

## CRM review and export

The landing-page activity list shows tracked visits, average active time and
confirmed requests for every final URL in the selected range and Live/Test scope.
Most visited pages appear first; “With visits only” hides zero-visit destinations.
Choosing a row still scopes the detailed report and existing CSV menu to that URL.
Loading or failed reports never invent zero counts. `/welcome` remains the initial
selection, and all 18 focused pages remain available with the activity filter off.

“Export all Google Ads data” downloads a ZIP for every final URL in the selected
range/scope. It includes summary.csv, landing-pages.csv, journeys.csv, events.csv,
excluded-entry-requests.csv, report.json and README.txt. CSVs include the full
session/timeline rows; JSON includes the dashboard's bounded recent-session view.
Live exports respect the active reporting period. Unique outcomes are deduplicated
across URLs in the overall summary. No contact details or form answers are exported.
This is first-party CRM data, not Google Ads spend, impression or click reports.
Exports over 10,000 entries, 30,000 events or 4 MB compressed fail explicitly and
ask for a shorter range, instead of downloading truncated data.

## Database and checks

The owner ran `20260927000000_meryem_google_ads_landings.sql` in Supabase and
confirmed `tracking_status=ready` with all three flags true. It only expands the
existing path allowlists; bookings and historical records are preserved. The
provider referral portal remains excluded from Ads journeys, matching its SQL
and isolated analytics boundary.

Tests cover the exact keyword mapping, approved paths, Meryem-only bookings,
couples pricing/service, shared calendar capacity, tracking migration reruns,
per-URL activity, full ZIP contents, authorization and Live/Test separation.
Browser QA uses fixture data and mocked submissions; it sends no real bookings
or emails. Published pages retain the no-referrer and first-party tracking rules.

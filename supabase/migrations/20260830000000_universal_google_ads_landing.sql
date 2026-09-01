-- Keep historical campaign paths valid for existing reporting rows while
-- allowing the single universal Google Ads landing destination going forward.
create or replace function public.is_google_ads_tracked_path(p_path text)
returns boolean
language sql
immutable
set search_path = pg_catalog, public
as $$
  select p_path in (
    '/', '/about', '/anxiety-therapy-ottawa', '/book-consultation',
    '/consultation', '/depression-therapy-ottawa', '/faq',
    '/faq/am-i-burnt-out', '/faq/am-i-depressed',
    '/faq/does-insurance-cover-therapy', '/faq/dont-know-what-i-need',
    '/faq/do-i-have-anxiety', '/faq/first-therapy-session',
    '/faq/how-long-therapy', '/faq/how-often-therapy', '/faq/how-to-book',
    '/faq/how-to-find-therapist', '/faq/is-my-grief-normal',
    '/faq/languages-offered', '/faq/rp-vs-rsw',
    '/faq/stress-vs-anxiety', '/faq/tax-deductible-therapy',
    '/faq/therapy-approaches', '/faq/therapy-cost-ottawa',
    '/faq/therapist-credentials', '/faq/trauma-signs',
    '/faq/what-is-valisen', '/faq/which-plans-cover-rps', '/get-matched',
    '/grief-counselling-ottawa', '/insurance', '/intake',
    '/life-transitions-therapy-ottawa', '/privacy-policy', '/quiz',
    '/relationship-counselling-ottawa', '/resources',
    '/resources/five-signs-of-perfectionism',
    '/self-esteem-therapy-ottawa', '/services', '/sitewide',
    '/stress-therapy-ottawa', '/terms', '/therapists',
    '/therapists/dayong-quan', '/therapists/meryem-ibrahim',
    '/therapists/ryann-simpson', '/therapists/tim-kahtava',
    '/therapists/wilfred-bengnwi', '/therapists/profile',
    '/trauma-therapy-ottawa', '/lp/anxiety-therapy',
    '/lp/depression-therapy', '/lp/couples-therapy',
    '/lp/google-ads', '/welcome', '/thank-you'
  );
$$;

comment on function public.is_google_ads_tracked_path(text) is
  'Closed allowlist for Google Ads journey paths. Historical landing paths (including /lp/anxiety-therapy, /lp/depression-therapy, /lp/couples-therapy, and /lp/google-ads) remain valid for retained reporting data only; none of them are live routes. Google Ads traffic goes to either the default domain (/) or the dedicated /welcome landing page.';

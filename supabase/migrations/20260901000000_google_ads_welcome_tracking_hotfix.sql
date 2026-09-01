-- Hotfix the production Google Ads journey allowlist for the dedicated
-- /welcome Final URL and its non-conversion fallback confirmation page.
-- This is intentionally a complete create-or-replace definition so it is safe
-- whether or not 20260830000000_universal_google_ads_landing.sql was run by hand.
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
    '/lp/google-ads', '/welcome', '/welcome/thank-you', '/thank-you'
  );
$$;

comment on function public.is_google_ads_tracked_path(text) is
  'Closed allowlist for Google Ads journey paths. Current campaign traffic may enter through /welcome or another approved public Final URL. /welcome/thank-you and /thank-you are tracked outcome pages but never entry routes. Historical /lp paths remain valid for retained reports only.';

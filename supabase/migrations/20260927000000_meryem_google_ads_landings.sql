-- Enable first-party attribution and form events for the approved final URLs.
begin;
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
    '/lp/google-ads', '/welcome', '/welcome/thank-you', '/thank-you',
    '/welcome/anxiety', '/welcome/depression', '/welcome/cbt', '/welcome/couples', '/welcome/ocd', '/welcome/panic', '/welcome/social-anxiety', '/welcome/online-therapy', '/welcome/psychotherapists', '/welcome/free-consultation', '/welcome/mandarin', '/welcome/arabic', '/welcome/adhd', '/welcome/perfectionism', '/welcome/trauma', '/welcome/muslim-therapy', '/welcome/female-muslim-therapist', '/welcome/muslim-marriage'
  );
$$;


create or replace function public.is_google_ads_consultation_path(p_path text)
returns boolean language sql immutable set search_path=pg_catalog,public as $$
 select p_path in ('/consultation', '/welcome', '/welcome/anxiety', '/welcome/depression', '/welcome/cbt', '/welcome/couples', '/welcome/ocd', '/welcome/panic', '/welcome/social-anxiety', '/welcome/online-therapy', '/welcome/psychotherapists', '/welcome/free-consultation', '/welcome/mandarin', '/welcome/arabic', '/welcome/adhd', '/welcome/perfectionism', '/welcome/trauma', '/welcome/muslim-therapy', '/welcome/female-muslim-therapist', '/welcome/muslim-marriage');
$$;

-- Ensure the existing form-event guard uses the expanded consultation allowlist.
do $$ begin
 if position('is_google_ads_consultation_path' in pg_get_functiondef('public.ingest_google_ads_events(text,timestamptz,text,jsonb)'::regprocedure)) = 0 then
  raise exception 'Apply the September 17 focused landing migration first.';
 end if;
end $$;
select 'ready' as tracking_status,
 public.is_google_ads_tracked_path('/welcome/muslim-therapy') as muslim_therapy_ready,
 public.is_google_ads_tracked_path('/welcome/female-muslim-therapist') as female_muslim_ready,
 public.is_google_ads_consultation_path('/welcome/muslim-marriage') as muslim_marriage_ready;
commit;

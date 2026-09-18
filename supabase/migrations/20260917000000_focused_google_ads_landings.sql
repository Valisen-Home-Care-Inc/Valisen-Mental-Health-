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
    '/welcome/anxiety', '/welcome/depression', '/welcome/cbt', '/welcome/couples', '/welcome/ocd', '/welcome/panic', '/welcome/social-anxiety', '/welcome/online-therapy', '/welcome/psychotherapists', '/welcome/free-consultation', '/welcome/mandarin', '/welcome/arabic', '/welcome/adhd', '/welcome/perfectionism', '/welcome/trauma'
  );
$$;


create or replace function public.is_google_ads_consultation_path(p_path text)
returns boolean language sql immutable set search_path=pg_catalog,public as $$
 select p_path in ('/consultation', '/welcome', '/welcome/anxiety', '/welcome/depression', '/welcome/cbt', '/welcome/couples', '/welcome/ocd', '/welcome/panic', '/welcome/social-anxiety', '/welcome/online-therapy', '/welcome/psychotherapists', '/welcome/free-consultation', '/welcome/mandarin', '/welcome/arabic', '/welcome/adhd', '/welcome/perfectionism', '/welcome/trauma');
$$;
do $patch$
declare definition text; anchor text := 'and v_path not in (''/consultation'', ''/welcome'')';
begin
 select pg_get_functiondef('public.ingest_google_ads_events(text,timestamptz,text,jsonb)'::regprocedure) into strict definition;
 if position('and not public.is_google_ads_consultation_path(v_path)' in definition) = 0 then
  if (length(definition)-length(replace(definition,anchor,'')))/length(anchor) <> 1 then
   raise exception 'Expected consultation form guard is missing. Apply the existing form-field tracking migration first.';
  end if;
  definition := replace(definition,anchor,'and not public.is_google_ads_consultation_path(v_path)');
  execute definition;
 end if;
end;
$patch$;
commit;

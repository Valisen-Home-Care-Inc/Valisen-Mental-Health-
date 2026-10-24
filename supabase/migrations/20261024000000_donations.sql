-- Subsidized psychotherapy contributions (/donate, Stripe Checkout).
--
-- Rows are written only by the signature-verified Stripe webhook, never by
-- the browser or the success page. Each Stripe event id is recorded once, so
-- duplicate or retried webhook deliveries are harmless.
--
-- Privacy boundary: no card data, donor name, email, address, IP address or
-- user-agent is stored. Donor details stay in Stripe; the admin report links
-- to the Stripe Dashboard instead. Transactional and safe to rerun.

begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
set local search_path = pg_catalog, public, extensions;

create table if not exists public.donations (
  id uuid primary key default extensions.gen_random_uuid(),
  stripe_checkout_session_id text not null unique,
  stripe_payment_intent_id text unique,
  status text not null,
  amount_cents integer not null,
  amount_refunded_cents integer not null default 0,
  currency text not null,
  amount_option text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  livemode boolean not null,
  stripe_created_at timestamptz,
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp(),
  constraint donations_session_format check (stripe_checkout_session_id ~ '^cs_(test|live)_[A-Za-z0-9]{10,250}$'),
  constraint donations_payment_intent_format check (
    stripe_payment_intent_id is null or stripe_payment_intent_id ~ '^pi_[A-Za-z0-9]{10,250}$'
  ),
  constraint donations_status_allowed check (
    status in ('processing', 'failed', 'paid', 'partially_refunded', 'refunded')
  ),
  constraint donations_amount_range check (amount_cents between 1 and 1000000),
  constraint donations_refund_range check (amount_refunded_cents between 0 and amount_cents),
  constraint donations_currency_allowed check (currency = 'cad'),
  constraint donations_option_allowed check (amount_option is null or amount_option in ('preset', 'custom')),
  constraint donations_utm_length check (
    coalesce(length(utm_source), 0) <= 80 and coalesce(length(utm_medium), 0) <= 80 and
    coalesce(length(utm_campaign), 0) <= 80 and coalesce(length(utm_content), 0) <= 80
  )
);

create index if not exists donations_paid_at_idx on public.donations (livemode, paid_at desc);
create index if not exists donations_created_at_idx on public.donations (livemode, created_at desc);

create table if not exists public.donation_stripe_events (
  stripe_event_id text primary key,
  event_type text not null,
  received_at timestamptz not null default transaction_timestamp(),
  constraint donation_stripe_events_id_format check (stripe_event_id ~ '^evt_[A-Za-z0-9]{10,250}$'),
  constraint donation_stripe_events_type_format check (event_type ~ '^[a-z_.]{3,80}$')
);

alter table public.donations enable row level security;
alter table public.donation_stripe_events enable row level security;
revoke all on table public.donations from public, anon, authenticated, service_role;
revoke all on table public.donation_stripe_events from public, anon, authenticated, service_role;

create or replace function public.donation_status_rank(p_status text)
returns integer
language sql
immutable
set search_path = pg_catalog, public
as $$
  select case p_status
    when 'processing' then 1
    when 'failed' then 2
    when 'paid' then 3
    when 'partially_refunded' then 4
    when 'refunded' then 5
    else 0
  end;
$$;

-- checkout.session.completed / async_payment_succeeded / async_payment_failed.
-- A status never moves backwards, so out-of-order deliveries are safe.
create or replace function public.record_donation_checkout_event(
  p_event_id text,
  p_event_type text,
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_status text,
  p_amount_cents integer,
  p_currency text,
  p_amount_option text,
  p_utm_source text,
  p_utm_medium text,
  p_utm_campaign text,
  p_utm_content text,
  p_livemode boolean,
  p_stripe_created_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_inserted integer;
  v_status text;
begin
  if p_status is null or p_status not in ('processing', 'failed', 'paid') then
    raise exception 'Invalid donation status';
  end if;

  insert into public.donation_stripe_events (stripe_event_id, event_type)
  values (p_event_id, p_event_type)
  on conflict (stripe_event_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return jsonb_build_object('duplicate', true);
  end if;

  insert into public.donations as d (
    stripe_checkout_session_id, stripe_payment_intent_id, status, amount_cents, currency,
    amount_option, utm_source, utm_medium, utm_campaign, utm_content, livemode,
    stripe_created_at, paid_at
  ) values (
    p_checkout_session_id, p_payment_intent_id, p_status, p_amount_cents, p_currency,
    p_amount_option, p_utm_source, p_utm_medium, p_utm_campaign, p_utm_content, p_livemode,
    p_stripe_created_at, case when p_status = 'paid' then transaction_timestamp() end
  )
  on conflict (stripe_checkout_session_id) do update set
    stripe_payment_intent_id = coalesce(d.stripe_payment_intent_id, excluded.stripe_payment_intent_id),
    status = case
      when public.donation_status_rank(excluded.status) > public.donation_status_rank(d.status)
        then excluded.status
      else d.status
    end,
    paid_at = case
      when d.paid_at is null and excluded.status = 'paid' then transaction_timestamp()
      else d.paid_at
    end,
    updated_at = transaction_timestamp()
  returning d.status into v_status;

  return jsonb_build_object('duplicate', false, 'status', v_status);
end;
$$;

-- charge.refunded. Returns found=false (and forgets the event id) when the
-- payment is not recorded yet, so a Stripe retry can apply it later.
create or replace function public.record_donation_refund_event(
  p_event_id text,
  p_event_type text,
  p_payment_intent_id text,
  p_amount_refunded_cents integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_inserted integer;
  v_status text;
begin
  insert into public.donation_stripe_events (stripe_event_id, event_type)
  values (p_event_id, p_event_type)
  on conflict (stripe_event_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return jsonb_build_object('duplicate', true, 'found', true);
  end if;

  update public.donations as d set
    amount_refunded_cents = least(d.amount_cents, greatest(d.amount_refunded_cents, p_amount_refunded_cents)),
    status = case
      when greatest(d.amount_refunded_cents, p_amount_refunded_cents) >= d.amount_cents then 'refunded'
      when greatest(d.amount_refunded_cents, p_amount_refunded_cents) > 0 then 'partially_refunded'
      else d.status
    end,
    refunded_at = coalesce(d.refunded_at, transaction_timestamp()),
    updated_at = transaction_timestamp()
  where d.stripe_payment_intent_id = p_payment_intent_id
  returning d.status into v_status;

  if v_status is null then
    delete from public.donation_stripe_events where stripe_event_id = p_event_id;
    return jsonb_build_object('duplicate', false, 'found', false);
  end if;

  return jsonb_build_object('duplicate', false, 'found', true, 'status', v_status);
end;
$$;

-- Private admin report. Money totals are net of refunds; counts exclude fully
-- refunded contributions.
create or replace function public.get_donation_report(p_livemode boolean)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
  with clock as (
    select now() as generated_at, (now() at time zone 'America/Toronto')::date as today
  ), settled as (
    select
      d.*,
      (d.amount_cents - d.amount_refunded_cents) as net_cents,
      (d.paid_at at time zone 'America/Toronto')::date as paid_date
    from public.donations d
    where d.livemode = p_livemode
      and d.status in ('paid', 'partially_refunded', 'refunded')
  ), totals as (
    select
      coalesce(sum(s.net_cents) filter (where s.paid_date = c.today), 0) as today_cents,
      count(*) filter (where s.paid_date = c.today and s.net_cents > 0) as today_count,
      coalesce(sum(s.net_cents) filter (where s.paid_date > c.today - 7), 0) as last_7_cents,
      count(*) filter (where s.paid_date > c.today - 7 and s.net_cents > 0) as last_7_count,
      coalesce(sum(s.net_cents) filter (where s.paid_date > c.today - 30), 0) as last_30_cents,
      count(*) filter (where s.paid_date > c.today - 30 and s.net_cents > 0) as last_30_count,
      coalesce(sum(s.net_cents), 0) as all_time_cents,
      count(*) filter (where s.net_cents > 0) as all_time_count,
      coalesce(sum(s.amount_refunded_cents), 0) as refunded_cents
    from settled s cross join clock c
  ), sources as (
    select
      coalesce(nullif(s.utm_source, ''), 'direct') as source,
      coalesce(nullif(s.utm_campaign, ''), '') as campaign,
      count(*) filter (where s.net_cents > 0) as donation_count,
      coalesce(sum(s.net_cents), 0) as net_cents
    from settled s
    group by 1, 2
  ), recent as (
    select d.*
    from public.donations d
    where d.livemode = p_livemode
    order by coalesce(d.paid_at, d.created_at) desc
    limit 50
  )
  select jsonb_build_object(
    'generatedAt', (select generated_at from clock),
    'livemode', p_livemode,
    'totals', (select jsonb_build_object(
      'todayCents', today_cents, 'todayCount', today_count,
      'last7DaysCents', last_7_cents, 'last7DaysCount', last_7_count,
      'last30DaysCents', last_30_cents, 'last30DaysCount', last_30_count,
      'allTimeCents', all_time_cents, 'allTimeCount', all_time_count,
      'refundedCents', refunded_cents
    ) from totals),
    'pendingCount', (
      select count(*) from public.donations d
      where d.livemode = p_livemode and d.status = 'processing'
    ),
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object(
        'source', s.source, 'campaign', s.campaign,
        'count', s.donation_count, 'netCents', s.net_cents
      ) order by s.net_cents desc)
      from sources s
    ), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(jsonb_build_object(
        'checkoutSessionId', r.stripe_checkout_session_id,
        'paymentIntentId', r.stripe_payment_intent_id,
        'status', r.status,
        'amountCents', r.amount_cents,
        'amountRefundedCents', r.amount_refunded_cents,
        'amountOption', r.amount_option,
        'utmSource', r.utm_source,
        'utmCampaign', r.utm_campaign,
        'paidAt', r.paid_at,
        'createdAt', r.created_at
      ) order by coalesce(r.paid_at, r.created_at) desc)
      from recent r
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.donation_status_rank(text) from public, anon, authenticated;
revoke all on function public.record_donation_checkout_event(text, text, text, text, text, integer, text, text, text, text, text, text, boolean, timestamptz) from public, anon, authenticated;
revoke all on function public.record_donation_refund_event(text, text, text, integer) from public, anon, authenticated;
revoke all on function public.get_donation_report(boolean) from public, anon, authenticated;
grant execute on function public.donation_status_rank(text) to service_role;
grant execute on function public.record_donation_checkout_event(text, text, text, text, text, integer, text, text, text, text, text, text, boolean, timestamptz) to service_role;
grant execute on function public.record_donation_refund_event(text, text, text, integer) to service_role;
grant execute on function public.get_donation_report(boolean) to service_role;

commit;

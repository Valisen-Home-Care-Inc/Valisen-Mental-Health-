-- Patient referrals are intentionally separate from marketing/CRM exports.
create table if not exists public.provider_referrals (
  id uuid primary key,
  created_at timestamptz not null default now(),
  details jsonb not null check (jsonb_typeof(details) = 'object'),
  consent_version text not null,
  status text not null default 'new' check (status in ('new', 'contacted', 'closed'))
);
alter table public.provider_referrals enable row level security;
revoke all on public.provider_referrals from public, anon, authenticated;
grant select, insert, update on public.provider_referrals to service_role;

create or replace function public.submit_provider_referral(p_id uuid, p_details jsonb, p_consent_version text)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if p_consent_version <> '2026-09-18' or p_details->>'consent' is distinct from 'true' then
    raise exception 'Invalid authorization';
  end if;
  insert into public.provider_referrals(id, details, consent_version)
  values (p_id, p_details, p_consent_version) on conflict (id) do nothing;
  if not exists (select 1 from public.provider_referrals where id = p_id and details = p_details and consent_version = p_consent_version) then
    raise exception 'Referral retry does not match original';
  end if;
end;
$$;
create or replace function public.list_provider_referrals(p_offset integer default 0)
returns setof public.provider_referrals language sql security invoker set search_path = public as $$
  select * from public.provider_referrals order by created_at desc, id desc limit 50 offset greatest(p_offset, 0);
$$;
create or replace function public.update_provider_referral(p_id uuid, p_status text)
returns void language sql security invoker set search_path = public as $$
  update public.provider_referrals set status = p_status where id = p_id;
$$;
revoke all on function public.submit_provider_referral(uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.list_provider_referrals(integer) from public, anon, authenticated;
revoke all on function public.update_provider_referral(uuid, text) from public, anon, authenticated;
grant execute on function public.submit_provider_referral(uuid, jsonb, text) to service_role;
grant execute on function public.list_provider_referrals(integer) to service_role;
grant execute on function public.update_provider_referral(uuid, text) to service_role;

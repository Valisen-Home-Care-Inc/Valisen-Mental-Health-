-- Extend the existing Mental Battery checkpoint system through VMH-25.
-- Existing checkpoints, placements, sessions, and attribution remain intact.

begin;

set local search_path = pg_catalog, public, extensions;

alter table public.checkpoints
  drop constraint checkpoints_code_format;
alter table public.checkpoints
  add constraint checkpoints_code_format
    check (code ~ '^VMH-(0[1-9]|1[0-9]|2[0-5])$');

alter table public.consultation_leads
  drop constraint consultation_leads_checkpoint_shape;
alter table public.consultation_leads
  add constraint consultation_leads_checkpoint_shape check (
    (source_kind <> 'mental_battery_checkpoint') or
    checkpoint_code ~ '^VMH-(0[1-9]|1[0-9]|2[0-5])$'
  );

-- Amend only the closed code validator in the currently installed RPCs. In
-- particular, preserve later CRM/Google Ads changes to consultation upserts.
-- CREATE OR REPLACE retains each RPC's owner, grants, and security settings.
-- Fail atomically if a required RPC or its expected validator is missing.
do $expand_checkpoint_validators$
declare
  v_signature text;
  v_definition text;
  v_old_pattern constant text := '^VMH-(0[1-9]|10)$';
  v_new_pattern constant text := '^VMH-(0[1-9]|1[0-9]|2[0-5])$';
begin
  foreach v_signature in array array[
    'public.move_checkpoint(text,text,text,text,timestamptz)',
    'public.get_checkpoint_detail(text,timestamptz,timestamptz)',
    'public.ingest_checkpoint_event(text,uuid,uuid,text,smallint)',
    'public.record_checkpoint_consultation(text,uuid,text,text)',
    'public.get_checkpoint_action_metrics(timestamptz,timestamptz,text)',
    'public.upsert_consultation_lead(text,text,text,text,text,text,text,text,text,text,text,text,text,text,timestamptz,text,text,text,uuid,text,text,text,text,text,text,text,text,timestamptz)'
  ] loop
    select pg_get_functiondef(v_signature::regprocedure) into v_definition;
    if position(v_old_pattern in v_definition) > 0 then
      execute replace(v_definition, v_old_pattern, v_new_pattern);
    elsif position(v_new_pattern in v_definition) = 0 then
      raise exception 'Could not extend checkpoint code validation in %.', v_signature;
    end if;
  end loop;
end;
$expand_checkpoint_validators$;

insert into public.checkpoints (code)
select 'VMH-' || lpad(series::text, 2, '0')
from generate_series(11, 25) as series
on conflict (code) do nothing;

-- Seed only new codes without any placement history. Rerunning this migration
-- never resets an assigned location or changes an existing placement timeline.
insert into public.checkpoint_placements (
  checkpoint_id,
  partner_name,
  location_name,
  status,
  started_at
)
select
  checkpoint.id,
  'Unassigned',
  'Unassigned',
  'unassigned',
  transaction_timestamp()
from public.checkpoints as checkpoint
where checkpoint.code ~ '^VMH-(1[1-9]|2[0-5])$'
  and not exists (
    select 1
    from public.checkpoint_placements as existing
    where existing.checkpoint_id = checkpoint.id
  );

notify pgrst, 'reload schema';

commit;

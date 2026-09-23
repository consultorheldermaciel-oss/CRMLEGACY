-- Auto-Cutucão for cold Lista HOT leads (feature 3: automated follow-up),
-- same pattern as migration 0021's entrega/recalibrar auto-tasks: when a
-- lead has sat with zero appointments for longer than the consultor's
-- configured threshold, insert a task on the líder's behalf so re-engaging
-- it doesn't depend on anyone remembering to check the list.

-- Widen the auto_kind check to allow 'lead_frio' — found and dropped
-- dynamically instead of guessing the auto-generated constraint name from
-- migration 0021's inline `text check (...)` column definition.
do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'public.tasks'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%auto_kind%'
  loop
    execute format('alter table public.tasks drop constraint %I', con.conname);
  end loop;
end $$;

alter table public.tasks add constraint tasks_auto_kind_check check (auto_kind in ('entrega', 'recalibrar', 'lead_frio'));
alter table public.tasks add column auto_lead_id uuid references public.hot_leads (id) on delete cascade;

-- Replaces the old (auto_policy_id, auto_kind) unique index: lead_frio tasks
-- key off auto_lead_id instead, so both kinds of auto-task share one
-- de-dup rule (one row per auto_kind + whichever id applies).
drop index if exists tasks_auto_unique;
create unique index tasks_auto_unique on public.tasks (auto_kind, coalesce(auto_policy_id, auto_lead_id)) where auto_kind is not null;

-- New per-consultor threshold, alongside the existing followup_goals keys —
-- only applies to profiles created from now on; existing rows fall back to
-- a 5-day default client-side (see lib/autoCutucao.ts) since jsonb columns
-- don't retroactively gain new keys.
alter table public.profiles alter column followup_goals set default '{
  "naoProtocolado": 7, "delay": 3, "entrega": 30, "recalibrar": 365, "leadFrio": 5
}'::jsonb;

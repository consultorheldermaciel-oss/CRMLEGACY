-- Automatic Cutucão tasks for follow-up deadlines: when a policy misses its
-- "entrega" deadline or hits its "recalibrar" (1 year) mark, the app inserts
-- a task on the líder's behalf (assigned_by = the consultor's manager) so it
-- shows up in Lembretes without anyone having to create it by hand.
-- auto_policy_id + auto_kind identify which deadline a task came from, so
-- the app can avoid creating the same auto-task twice; the partial unique
-- index enforces that at the database level too, in case two sessions race.
alter table public.tasks add column auto_kind text check (auto_kind in ('entrega', 'recalibrar'));
alter table public.tasks add column auto_policy_id uuid references public.policies (id) on delete cascade;

create unique index tasks_auto_unique on public.tasks (auto_policy_id, auto_kind) where auto_kind is not null;

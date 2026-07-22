-- Three-level hierarchy: diretor ("líder de agência") > lider ("líder de
-- unidade") > consultor. Each profile optionally points at who they report
-- to (manager_id). A lider only ever sees their own team — never another
-- lider's team — while a diretor sees every unit.

alter table public.profiles add column manager_id uuid references public.profiles (id) on delete set null;

-- One-time backfill: link today's consultores to the (only) existing lider,
-- so the isolation change below doesn't hide anyone's current team from them.
update public.profiles set manager_id = (
  select id from public.profiles where role = 'lider' order by created_at limit 1
)
where role = 'consultor' and manager_id is null;

create or replace function public.is_diretor()
returns boolean
language sql security definer stable set search_path = public
as $$
  select coalesce((select role = 'diretor' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.my_manager_id()
returns uuid
language sql security definer stable set search_path = public
as $$
  select manager_id from public.profiles where id = auth.uid();
$$;

-- True if the caller manages `target_id`: they ARE target_id, target_id reports
-- directly to them, or the caller is the top-level diretor (sees everyone).
create or replace function public.manages(target_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select
    public.is_diretor()
    or target_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = target_id and p.manager_id = auth.uid());
$$;

-- PROFILES: a lider (or consultor) only sees themself, their own reports, and
-- their own manager — never a sibling lider's unit. Diretor sees everyone.
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_scoped" on public.profiles for select
  using (
    id = auth.uid()
    or public.is_diretor()
    or manager_id = auth.uid()
    or id = public.my_manager_id()
  );

drop policy if exists "profiles_insert_lider" on public.profiles;
create policy "profiles_insert_manager" on public.profiles for insert
  with check (public.is_lider() or public.is_diretor());

drop policy if exists "profiles_update_lider_only" on public.profiles;
create policy "profiles_update_manager" on public.profiles for update
  using (public.is_diretor() or manager_id = auth.uid())
  with check (public.is_diretor() or manager_id = auth.uid());

drop policy if exists "profiles_delete_lider" on public.profiles;
create policy "profiles_delete_manager" on public.profiles for delete
  using (public.is_diretor() or manager_id = auth.uid());

-- APPOINTMENTS / TASKS / DEPENDENTS: scoped through manages() instead of a
-- blanket "any lider sees everything".
drop policy if exists "appointments_select" on public.appointments;
create policy "appointments_select" on public.appointments for select
  using (public.manages(consultant_id));
drop policy if exists "appointments_insert" on public.appointments;
create policy "appointments_insert" on public.appointments for insert
  with check (public.manages(consultant_id));
drop policy if exists "appointments_update" on public.appointments;
create policy "appointments_update" on public.appointments for update
  using (public.manages(consultant_id))
  with check (public.manages(consultant_id));
drop policy if exists "appointments_delete" on public.appointments;
create policy "appointments_delete" on public.appointments for delete
  using (public.is_diretor() or created_by = auth.uid());

drop policy if exists "tasks_select" on public.tasks;
create policy "tasks_select" on public.tasks for select
  using (public.manages(consultant_id));
drop policy if exists "tasks_insert_lider" on public.tasks;
create policy "tasks_insert_manager" on public.tasks for insert
  with check (public.manages(consultant_id));
drop policy if exists "tasks_update" on public.tasks;
create policy "tasks_update" on public.tasks for update
  using (public.manages(consultant_id))
  with check (public.manages(consultant_id));
drop policy if exists "tasks_delete_lider" on public.tasks;
create policy "tasks_delete_manager" on public.tasks for delete
  using (public.manages(consultant_id));

drop policy if exists "dependents_select" on public.dependents;
create policy "dependents_select" on public.dependents for select
  using (public.manages(consultant_id));
drop policy if exists "dependents_insert" on public.dependents;
create policy "dependents_insert" on public.dependents for insert
  with check (public.manages(consultant_id));
drop policy if exists "dependents_update" on public.dependents;
create policy "dependents_update" on public.dependents for update
  using (public.manages(consultant_id))
  with check (public.manages(consultant_id));
drop policy if exists "dependents_delete" on public.dependents;
create policy "dependents_delete" on public.dependents for delete
  using (public.manages(consultant_id));

-- INVITES: track who the invite is for (role_to_grant) and who they'll report
-- to (manager_id) once accepted. A lider only sees/cancels invites they
-- personally sent; diretor sees all.
alter table public.invites add column role_to_grant public.user_role not null default 'consultor';
alter table public.invites add column manager_id uuid references public.profiles (id) on delete set null;

drop policy if exists "invites_select_lider" on public.invites;
create policy "invites_select_own_or_diretor" on public.invites for select
  using (public.is_diretor() or created_by = auth.uid());
drop policy if exists "invites_insert_lider" on public.invites;
create policy "invites_insert_manager" on public.invites for insert
  with check (public.is_lider() or public.is_diretor());
drop policy if exists "invites_delete_lider" on public.invites;
create policy "invites_delete_own_or_diretor" on public.invites for delete
  using (public.is_diretor() or created_by = auth.uid());

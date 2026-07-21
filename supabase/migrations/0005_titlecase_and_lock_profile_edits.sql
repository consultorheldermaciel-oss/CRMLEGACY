-- One-time cleanup: title-case names already saved before the app started
-- doing this automatically.
update public.profiles set name = initcap(name) where name is not null;
update public.profiles set spouse_name = initcap(spouse_name) where spouse_name is not null;
update public.dependents set name = initcap(name) where name is not null;
update public.appointments set client_name = initcap(client_name)
  where client_name is not null and type in ('abordagem', 'fechamento');

-- Lock down profile edits: only the lider may update ANY profile row, including
-- a consultor's own — a consultor can no longer edit their own record directly.
drop policy if exists "profiles_update_lider_or_self" on public.profiles;
create policy "profiles_update_lider_only" on public.profiles for update
  using (public.is_lider())
  with check (public.is_lider());

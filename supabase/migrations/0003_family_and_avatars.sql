-- Consultant photo, birth date, spouse info, and children (dependents), so the
-- lider can be reminded to congratulate/celebrate the whole family.

alter table public.profiles
  add column avatar_url text,
  add column birth_date date,
  add column spouse_name text,
  add column spouse_birth_date date,
  add column spouse_phone text;

create table public.dependents (
  id uuid primary key default gen_random_uuid(),
  consultant_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  birth_date date,
  created_at timestamptz not null default now()
);

alter table public.dependents enable row level security;

create policy "dependents_select" on public.dependents for select
  using (public.is_lider() or consultant_id = auth.uid());
create policy "dependents_insert" on public.dependents for insert
  with check (public.is_lider() or consultant_id = auth.uid());
create policy "dependents_update" on public.dependents for update
  using (public.is_lider() or consultant_id = auth.uid())
  with check (public.is_lider() or consultant_id = auth.uid());
create policy "dependents_delete" on public.dependents for delete
  using (public.is_lider() or consultant_id = auth.uid());

alter publication supabase_realtime add table public.dependents;

-- Storage bucket for consultant photos. Public read (they're just profile
-- pictures); writes are restricted to the lider or the consultant's own folder
-- (object path convention: avatars/<consultant_id>/<filename>).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars_public_read" on storage.objects for select
  using (bucket_id = 'avatars');
create policy "avatars_write_own_or_lider" on storage.objects for insert
  with check (bucket_id = 'avatars' and (public.is_lider() or (storage.foldername(name))[1] = auth.uid()::text));
create policy "avatars_update_own_or_lider" on storage.objects for update
  using (bucket_id = 'avatars' and (public.is_lider() or (storage.foldername(name))[1] = auth.uid()::text));
create policy "avatars_delete_own_or_lider" on storage.objects for delete
  using (bucket_id = 'avatars' and (public.is_lider() or (storage.foldername(name))[1] = auth.uid()::text));

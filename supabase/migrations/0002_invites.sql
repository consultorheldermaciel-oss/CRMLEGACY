-- Custom invite flow: short-lived tokens we control end-to-end, instead of
-- relying on Supabase's own invite-email redirect (which needs the app's
-- domain allow-listed in Auth URL Configuration and produces long, ugly links).

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  email text not null,
  name text not null,
  created_by uuid not null references public.profiles (id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.invites enable row level security;

-- Only the lider can see/create/remove invites through the normal client;
-- the accept-invite and invite-consultor edge functions use the service role
-- key and bypass RLS entirely, so no anon policy is needed here.
create policy "invites_select_lider" on public.invites for select
  using (public.is_lider());
create policy "invites_insert_lider" on public.invites for insert
  with check (public.is_lider());
create policy "invites_delete_lider" on public.invites for delete
  using (public.is_lider());

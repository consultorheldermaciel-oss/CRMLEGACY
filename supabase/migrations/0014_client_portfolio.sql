-- Client portfolio: lets a consultor register clients directly (old clients
-- from before this CRM existed, no appointment needed) and attach policies
-- to them, building a per-consultor client database. Reuses manages() from
-- the hierarchy migration for RLS, so a lider/diretor can view/manage their
-- team's portfolios the same way they already do appointments/tasks.

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  consultant_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  phone text,
  birth_date date,
  notes text,
  created_at timestamptz not null default now()
);

create table public.policies (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  consultant_id uuid not null references public.profiles (id) on delete cascade,
  product text not null,
  premium numeric,
  policy_number text,
  issued_date date,
  status text not null default 'ativa' check (status in ('ativa', 'entregue', 'cancelada')),
  created_at timestamptz not null default now()
);

alter table public.clients enable row level security;
alter table public.policies enable row level security;

create policy "clients_select" on public.clients for select using (public.manages(consultant_id));
create policy "clients_insert" on public.clients for insert with check (public.manages(consultant_id));
create policy "clients_update" on public.clients for update
  using (public.manages(consultant_id))
  with check (public.manages(consultant_id));
create policy "clients_delete" on public.clients for delete using (public.manages(consultant_id));

create policy "policies_select" on public.policies for select using (public.manages(consultant_id));
create policy "policies_insert" on public.policies for insert with check (public.manages(consultant_id));
create policy "policies_update" on public.policies for update
  using (public.manages(consultant_id))
  with check (public.manages(consultant_id));
create policy "policies_delete" on public.policies for delete using (public.manages(consultant_id));

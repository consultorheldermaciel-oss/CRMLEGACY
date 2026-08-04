-- Lista HOT: leads a consultor uploads (from a spreadsheet, weekly) or adds
-- one at a time, ahead of actually scheduling anything with them. Progress
-- (agendado, abordagem feita, fechado...) is computed dynamically by
-- matching name + consultant_id against real appointments, same convention
-- already used to merge appointment-only clients into the Carteira — no
-- extra status column to keep in sync.
create table public.hot_leads (
  id uuid primary key default gen_random_uuid(),
  consultant_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  phone text,
  source text not null check (source in ('mercado', 'recomendacao')),
  recommended_by text,
  notes text,
  created_at timestamptz not null default now()
);
create index hot_leads_consultant_idx on public.hot_leads (consultant_id);

alter table public.hot_leads enable row level security;

create policy "hot_leads_select" on public.hot_leads for select using (public.manages(consultant_id));
create policy "hot_leads_insert" on public.hot_leads for insert with check (public.manages(consultant_id));
create policy "hot_leads_update" on public.hot_leads for update using (public.manages(consultant_id));
create policy "hot_leads_delete" on public.hot_leads for delete using (public.manages(consultant_id));

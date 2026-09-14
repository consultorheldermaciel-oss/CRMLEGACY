-- Lets each consultor self-report their own weekly numbers (apólices
-- fechadas, prêmio anualizado, capital segurado de morte/base, capital
-- segurado AH) — compared client-side against what the system computes
-- automatically (lib/report.ts buildWeeklyReport) at submit time. When the
-- two disagree, the row is flagged so the líder gets alerted, reusing the
-- same "once-a-minute cron notices an unnotified row" pattern as
-- migration 0025's manager_notified (see send-appointment-reminders).

-- Second insurance-capital figure the app didn't track before: the death/
-- base capital (capital_segurado) already exists since migration 0018; this
-- adds its AH (Acidentes e Saúde) counterpart so a closed policy can capture
-- both, and the self-report can be checked against both.
alter table public.appointments add column capital_segurado_ah numeric;

create table public.weekly_self_reports (
  id uuid primary key default gen_random_uuid(),
  consultant_id uuid not null references public.profiles (id) on delete cascade,
  week_start date not null,
  apolices_count int not null default 0,
  premio_anualizado numeric not null default 0,
  capital_segurado_morte numeric not null default 0,
  capital_segurado_ah numeric not null default 0,
  has_divergence boolean not null default false,
  divergence_details text,
  manager_notified boolean not null default true,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (consultant_id, week_start)
);
create index weekly_self_reports_consultant_idx on public.weekly_self_reports (consultant_id);

alter table public.weekly_self_reports enable row level security;

-- Same manages()-based visibility as appointments/tasks: the consultor sees
-- (and writes) only their own report; their líder/diretor can read it too,
-- to review it inside the weekly report screen.
create policy "weekly_self_reports_select" on public.weekly_self_reports for select
  using (public.manages(consultant_id));
create policy "weekly_self_reports_insert_self" on public.weekly_self_reports for insert
  with check (consultant_id = auth.uid());
create policy "weekly_self_reports_update_self" on public.weekly_self_reports for update
  using (consultant_id = auth.uid())
  with check (consultant_id = auth.uid());

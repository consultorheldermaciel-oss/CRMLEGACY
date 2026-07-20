-- Legacy CRM — schema, roles and RLS policies
-- Two roles share one database: 'lider' (sees/edits everyone) and 'consultor' (sees/edits only own data).

create type public.user_role as enum ('lider', 'consultor');
create type public.appointment_type as enum ('abordagem', 'fechamento', 'evento');
create type public.appointment_status as enum ('agendado', 'compareceu', 'faltou_sem_avisar', 'avisou_nao_ira', 'remarcado');

-- One profile row per auth user. role + display data used across the app.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'consultor',
  name text not null,
  email text,
  color text not null default '#0B2D5B',
  phone text,
  contract_start date not null default current_date,
  commission_pct numeric not null default 20,
  bonus_per_policy numeric not null default 150,
  daily_goals jsonb not null default '{
    "abordagens": 2, "fechamentos": 1, "comparecimentoAbordagem": 80,
    "comparecimentoFechamento": 85, "assertividadeFechamento": 60,
    "apolicesFechadas": 0.5, "apolicesEntregues": 0.4, "premioMedio": 250
  }'::jsonb,
  extra_goals jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  consultant_id uuid not null references public.profiles (id) on delete cascade,
  created_by uuid not null references public.profiles (id),
  client_name text not null,
  type public.appointment_type not null,
  event_kind text,
  duration int not null default 1,
  date date not null,
  time text not null,
  status public.appointment_status not null default 'agendado',
  wants_manager boolean not null default false,
  locked_by_lider boolean not null default false,
  anamnese jsonb not null default '{}'::jsonb,
  policy_closed boolean,
  premium numeric,
  product text,
  policy_delivered boolean,
  fechamento_agendado boolean not null default false,
  linked_appointment_id uuid references public.appointments (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index appointments_consultant_date_idx on public.appointments (consultant_id, date);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  consultant_id uuid not null references public.profiles (id) on delete cascade,
  assigned_by uuid not null references public.profiles (id),
  text text not null,
  deadline date not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  icon text not null default '🎂',
  title text not null,
  date date not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.dismissed_reminders (
  reminder_id uuid not null references public.reminders (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  primary key (reminder_id, profile_id)
);

-- helper: current user's role, without recursive RLS lookups (security definer)
create or replace function public.current_role()
returns public.user_role
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_lider()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select role = 'lider' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;
create trigger appointments_touch_updated_at before update on public.appointments
  for each row execute function public.touch_updated_at();

-- Bootstrap: the very first person to ever sign in becomes the 'lider'. Everyone
-- invited after that (via the invite-consultor edge function) lands as 'consultor'.
-- The edge function upserts over this stub to set the real name/role/color.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, name, email)
  values (
    new.id,
    case when not exists (select 1 from public.profiles) then 'lider' else 'consultor' end,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

alter table public.profiles enable row level security;
alter table public.appointments enable row level security;
alter table public.tasks enable row level security;
alter table public.reminders enable row level security;
alter table public.dismissed_reminders enable row level security;

-- PROFILES: everyone in the org can read everyone (needed for avatars, agenda labels, team screen).
-- Only the lider can create/update/delete other profiles; a consultor may update their own contact info.
create policy "profiles_select_all" on public.profiles for select
  using (true);
create policy "profiles_insert_lider" on public.profiles for insert
  with check (public.is_lider());
create policy "profiles_update_lider_or_self" on public.profiles for update
  using (public.is_lider() or id = auth.uid())
  with check (
    public.is_lider()
    or (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()))
  );
create policy "profiles_delete_lider" on public.profiles for delete
  using (public.is_lider());

-- APPOINTMENTS: lider full access to all rows; consultor only their own.
create policy "appointments_select" on public.appointments for select
  using (public.is_lider() or consultant_id = auth.uid());
create policy "appointments_insert" on public.appointments for insert
  with check (public.is_lider() or consultant_id = auth.uid());
create policy "appointments_update" on public.appointments for update
  using (public.is_lider() or consultant_id = auth.uid())
  with check (public.is_lider() or consultant_id = auth.uid());
create policy "appointments_delete" on public.appointments for delete
  using (public.is_lider() or consultant_id = auth.uid());

-- TASKS ("Cutucão"): only the lider assigns tasks; a consultor may read/complete their own.
create policy "tasks_select" on public.tasks for select
  using (public.is_lider() or consultant_id = auth.uid());
create policy "tasks_insert_lider" on public.tasks for insert
  with check (public.is_lider());
create policy "tasks_update" on public.tasks for update
  using (public.is_lider() or consultant_id = auth.uid())
  with check (public.is_lider() or consultant_id = auth.uid());
create policy "tasks_delete_lider" on public.tasks for delete
  using (public.is_lider());

-- REMINDERS: shared read for everyone; only lider manages them.
create policy "reminders_select_all" on public.reminders for select
  using (true);
create policy "reminders_insert_lider" on public.reminders for insert
  with check (public.is_lider());
create policy "reminders_update_lider" on public.reminders for update
  using (public.is_lider());
create policy "reminders_delete_lider" on public.reminders for delete
  using (public.is_lider());

create policy "dismissed_reminders_select_own" on public.dismissed_reminders for select
  using (profile_id = auth.uid());
create policy "dismissed_reminders_insert_own" on public.dismissed_reminders for insert
  with check (profile_id = auth.uid());
create policy "dismissed_reminders_delete_own" on public.dismissed_reminders for delete
  using (profile_id = auth.uid());

-- Realtime: broadcast changes so a consultor's action reflects immediately in the lider's view.
alter publication supabase_realtime add table public.appointments;
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.reminders;
alter publication supabase_realtime add table public.profiles;

-- Push notifications for appointment reminders (Web Push), à la Google
-- Agenda: each consultor registers their phone/browser as a push
-- subscription and picks how many minutes in advance they want to be
-- alerted; a scheduled Edge Function scans upcoming appointments and
-- fires the alert at the right moment.

alter table public.profiles add column notify_lead_minutes integer not null default 30;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  consultant_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index push_subscriptions_consultant_idx on public.push_subscriptions (consultant_id);

alter table public.push_subscriptions enable row level security;

-- Each consultor only ever manages their own device subscriptions — the
-- reminder-sending Edge Function reads across everyone via the service role
-- key, which bypasses RLS entirely, so no manager-visibility policy is needed.
create policy "push_subscriptions_select_self" on public.push_subscriptions for select
  using (consultant_id = auth.uid());
create policy "push_subscriptions_insert_self" on public.push_subscriptions for insert
  with check (consultant_id = auth.uid());
create policy "push_subscriptions_delete_self" on public.push_subscriptions for delete
  using (consultant_id = auth.uid());

-- Marks whether the "X minutes before" reminder was already sent for this
-- appointment, so the once-a-minute scan never double-fires.
alter table public.appointments add column reminder_sent boolean not null default false;

-- Same narrow, single-field self-edit exception as set_own_color (migration
-- 0011): anyone may change their OWN reminder lead time, without opening up
-- self-edit on the rest of their profile row.
create or replace function public.set_own_notify_lead_minutes(minutes integer)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if minutes < 1 or minutes > 1440 then
    raise exception 'Antecedência inválida.';
  end if;
  update public.profiles set notify_lead_minutes = minutes where id = auth.uid();
end;
$$;

grant execute on function public.set_own_notify_lead_minutes(integer) to authenticated;

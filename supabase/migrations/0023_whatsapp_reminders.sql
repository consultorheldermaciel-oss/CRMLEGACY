-- Optional WhatsApp channel for the same appointment reminders that already
-- go out as a push notification (migration 0022). Off by default — each
-- consultor opts in from Lembretes, same as the push toggle, since it's a
-- channel with a real per-message cost.
alter table public.profiles add column notify_whatsapp boolean not null default false;

-- Same narrow, single-field self-edit exception as set_own_color /
-- set_own_notify_lead_minutes.
create or replace function public.set_own_notify_whatsapp(enabled boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.profiles set notify_whatsapp = enabled where id = auth.uid();
end;
$$;

grant execute on function public.set_own_notify_whatsapp(boolean) to authenticated;

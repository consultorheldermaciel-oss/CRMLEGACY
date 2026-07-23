-- A consultor can only ever see their OWN appointment rows (by design, for
-- privacy between consultores). That means the client can't tell whether two
-- different consultores both requested the lider's presence at the same
-- time. These two functions expose just a yes/no "is my lider busy at this
-- slot" signal — never which consultor or what the appointment is — so the
-- app can warn without punching a hole in that privacy boundary.

create or replace function public.lider_id_for_caller()
returns uuid
language sql security definer stable set search_path = public
as $$
  select case
    when (select role from public.profiles where id = auth.uid()) = 'lider' then auth.uid()
    else (select manager_id from public.profiles where id = auth.uid())
  end;
$$;

create or replace function public.lider_busy_at(
  p_date date,
  p_hour int,
  p_duration int default 1,
  p_exclude_consultant_id uuid default null
)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1
    from public.appointments a
    where a.date = p_date
      -- overlap between [p_hour, p_hour+p_duration) and the appointment's own span
      and p_hour < (split_part(a.time, ':', 1)::int + a.duration)
      and (p_hour + p_duration) > split_part(a.time, ':', 1)::int
      and (
        -- the lider's own calendar (their "outro evento" bookings, or a
        -- self-block created via "Bloquear minha agenda")
        a.consultant_id = public.lider_id_for_caller()
        or (
          -- another consultor in the same unit already asked for the lider
          a.wants_manager
          and a.consultant_id is distinct from p_exclude_consultant_id
          and exists (
            select 1 from public.profiles pp
            where pp.id = a.consultant_id and pp.manager_id = public.lider_id_for_caller()
          )
        )
      )
  );
$$;

grant execute on function public.lider_id_for_caller() to authenticated;
grant execute on function public.lider_busy_at(date, int, int, uuid) to authenticated;

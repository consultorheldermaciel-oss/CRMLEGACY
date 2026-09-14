-- lider_busy_at() (migration 0009) treated every wants_manager = true
-- appointment as occupying the líder's time, even one they already
-- declined (migration 0027 added manager_response). A declined invite
-- means the líder isn't going, so it shouldn't keep blocking other
-- consultores from inviting them to that same slot.
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
      and p_hour < (split_part(a.time, ':', 1)::int + a.duration)
      and (p_hour + p_duration) > split_part(a.time, ':', 1)::int
      and (
        a.consultant_id = public.lider_id_for_caller()
        or (
          a.wants_manager
          and a.manager_response is distinct from 'declined'
          and a.consultant_id is distinct from p_exclude_consultant_id
          and exists (
            select 1 from public.profiles pp
            where pp.id = a.consultant_id and pp.manager_id = public.lider_id_for_caller()
          )
        )
      )
  );
$$;

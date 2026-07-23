-- Narrow, deliberate exception to the "only a manager edits a profile" lock
-- (migration 0005): anyone may change their OWN identification color — and
-- only that one field — without opening up self-edit on everything else.
create or replace function public.set_own_color(new_color text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if new_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'Cor inválida.';
  end if;
  update public.profiles set color = new_color where id = auth.uid();
end;
$$;

grant execute on function public.set_own_color(text) to authenticated;

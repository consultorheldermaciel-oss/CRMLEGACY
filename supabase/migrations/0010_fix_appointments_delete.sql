-- Bug fix: migration 0007 rewrote appointments_delete to only allow a
-- diretor (or whoever created the row) to delete it, accidentally dropping
-- the lider's ability to delete appointments their own consultores created
-- for themselves. manages(consultant_id) restores that (and still covers
-- "delete my own appointment" for everyone, since consultant_id = auth.uid()
-- satisfies manages() too).
drop policy if exists "appointments_delete" on public.appointments;
create policy "appointments_delete" on public.appointments for delete
  using (public.manages(consultant_id) or created_by = auth.uid());

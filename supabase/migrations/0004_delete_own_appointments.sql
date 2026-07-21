-- Tighten appointment deletion: a consultor may only delete appointments they
-- themselves created (created_by = them), not ones the lider scheduled for
-- them (even though consultant_id still points at them). The lider can
-- delete anything, as before.

drop policy if exists "appointments_delete" on public.appointments;

create policy "appointments_delete" on public.appointments for delete
  using (public.is_lider() or created_by = auth.uid());

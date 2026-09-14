-- Turns "⭐ Chamar o líder de unidade" into a real invite instead of an
-- instant auto-confirm: wants_manager still marks that a consultor asked for
-- the líder, but manager_response tracks whether the líder has actually
-- accepted, declined, or hasn't answered yet. The push/WhatsApp alert
-- (migration 0025) is unchanged — it still fires once as soon as the invite
-- is created — this just adds the accept/decline step on top of it, plus an
-- in-app fallback (a pending-invites list) for whenever the notification
-- itself doesn't get through.

alter table public.appointments add column manager_response text
  check (manager_response in ('pending', 'accepted', 'declined'));

-- Backfill: appointments that already had wants_manager = true were
-- auto-confirmed under the old behavior — treat them as already accepted so
-- this change doesn't retroactively turn settled commitments into pending
-- invites the líder now has to re-approve.
update public.appointments set manager_response = 'accepted' where wants_manager = true;

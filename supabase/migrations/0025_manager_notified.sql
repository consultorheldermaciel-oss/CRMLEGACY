-- Fixes a real gap in the push-reminder system: send-appointment-reminders
-- (migration 0022) only ever alerts an appointment's OWNER (consultant_id)
-- for the "X minutes before" reminder. It never told the líder anything,
-- even when a consultor flags `wants_manager` ("⭐ Chamar o líder de
-- unidade") to explicitly request the líder's presence — so the líder was
-- never notified of being called into an appointment.
--
-- This adds a one-shot flag the Edge Function uses to alert the manager
-- (profiles.manager_id of the appointment's consultor) as soon as it notices
-- `wants_manager = true`, independent of the appointment's start time.

alter table public.appointments add column manager_notified boolean not null default false;

-- Backfill: existing appointments should NOT retroactively blast the líder
-- the next time the cron runs — only appointments created/flagged from now on.
update public.appointments set manager_notified = true;

-- Follow-up deadlines the líder sets per consultor (days before an alert
-- fires), mirroring the daily_goals jsonb pattern:
--   naoProtocolado: reunião de fechamento aconteceu but no policy_closed yet
--   delay: client no-showed a scheduled meeting
--   entrega: days after closing a policy to deliver it
--   recalibrar: days after closing a policy to check back in / recalibrate
alter table public.profiles
  add column followup_goals jsonb not null default '{
    "naoProtocolado": 7, "delay": 3, "entrega": 30, "recalibrar": 365
  }'::jsonb;

-- Free-text perception/notes per appointment, shown in the client's timeline.
alter table public.appointments
  add column notes text;

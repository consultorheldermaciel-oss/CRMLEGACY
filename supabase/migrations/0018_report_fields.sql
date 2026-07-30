-- Two fields needed for the líder's weekly productivity report to the
-- company: the base death-benefit capital of a closed policy (separate from
-- its monthly premium), and how many client referrals a consultor got out
-- of an appointment.
alter table public.appointments
  add column capital_segurado numeric,
  add column recommendations int not null default 0;

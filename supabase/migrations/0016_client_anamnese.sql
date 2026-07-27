-- Lets a consultor fill in the same ADN/anamnese used for scheduled clients
-- on clients registered directly in the Carteira (old clients, no
-- appointment). Captures cônjuge/dependentes birth dates too, so their
-- important dates can be reminded the same way a consultant's own family is.
alter table public.clients add column anamnese jsonb not null default '{}'::jsonb;

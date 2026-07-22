-- A lider decides when the "líder de agência" tier becomes available for
-- their unit — defaults to off so the extra hierarchy layer stays dormant
-- until they explicitly turn it on (via the toggle-hierarchy edge function).
alter table public.profiles add column hierarchy_enabled boolean not null default false;

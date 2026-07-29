-- New appointment type: a catch-all for client meetings that aren't
-- abordagem/fechamento/entrega (e.g. cancelling a competitor's policy).
-- Own migration: Postgres doesn't allow using a brand-new enum value in the
-- same transaction that created it.
alter type public.appointment_type add value 'outros';

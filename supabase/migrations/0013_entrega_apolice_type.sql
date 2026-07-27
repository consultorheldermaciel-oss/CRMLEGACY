-- New appointment type: scheduling the client's policy-delivery visit,
-- separate from "fechamento" (closing the sale). Own migration: Postgres
-- doesn't allow using a brand-new enum value in the same transaction that
-- created it.
alter type public.appointment_type add value 'entrega';

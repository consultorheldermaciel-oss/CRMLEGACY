-- Adds the 'diretor' ("líder de agência") role, one level above 'lider'
-- ("líder de unidade"). Kept in its own migration: Postgres doesn't allow
-- using a brand-new enum value in the same transaction that created it.
alter type public.user_role add value 'diretor';

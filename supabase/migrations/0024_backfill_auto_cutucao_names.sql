-- The auto-generated entrega/recalibrar Cutucão tasks (migration 0021) didn't
-- include the client's name in the text, only the product — making them
-- useless for figuring out which client the reminder is about. That's fixed
-- in the app going forward; this clears out the old, name-less ones so the
-- app regenerates them (still overdue ones only) with the client's name
-- included this time. Safe to delete: they're purely derived data, tied to
-- (auto_policy_id, auto_kind), and the app recreates any still-due ones on
-- its next refresh.
delete from public.tasks where auto_kind is not null;

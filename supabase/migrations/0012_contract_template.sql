-- Which commission contract a consultor's remuneração calc follows. Null =
-- no real contract assigned yet, so the app shows a placeholder instead of
-- computed numbers. 'metlife_2025' is the first one, modeled from the
-- MetLife "Programa de Relacionamento" (Corretora de Seguros, maio/2025).
alter table public.profiles add column contract_template text;

-- Separar saldo (credits_balance) de usados (credits_used).
-- Ejecutar en Supabase → SQL Editor.

alter table api_keys add column if not exists credits_used int not null default 0;

comment on column api_keys.credits_balance is 'Saldo disponible (comprados − usados).';
comment on column api_keys.credits_used is 'Total créditos ya usados (certificados emitidos).';

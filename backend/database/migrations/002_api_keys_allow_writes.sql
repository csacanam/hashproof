-- Acceso libre de escritura en api_keys: desactiva RLS.
-- Ejecutar en Supabase → SQL Editor (una vez).

alter table if exists api_keys disable row level security;

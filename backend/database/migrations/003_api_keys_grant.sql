-- Permisos para que el backend (service role) pueda leer/escribir api_keys.
-- Ejecutar en Supabase → SQL Editor (como owner de la tabla / postgres).

grant all on table public.api_keys to service_role;
grant all on table public.api_keys to postgres;

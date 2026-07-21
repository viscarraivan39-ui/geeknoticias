-- Ejecutar una vez en el SQL Editor de Supabase, además de noticias.sql y rate_limits.sql

create table if not exists subscribers (
  email text primary key,
  subscribed_at timestamptz not null default now()
);

alter table subscribers enable row level security;
-- Sin políticas públicas: solo la service_role key (usada por el servidor) puede leer/escribir.

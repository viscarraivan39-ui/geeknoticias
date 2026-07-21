-- Ejecutar una vez en el SQL Editor de Supabase.
--
-- Historias narrativas/emotivas firmadas por "Bastián" — separadas de la
-- tabla `noticias` a propósito: no son noticias verificadas, son contenido
-- inspiracional generado con IA. El aviso de que es narrativa (no un hecho
-- verificado) se muestra siempre en el sitio, nunca se omite.

create table if not exists historias (
  id bigint generated always as identity primary key,
  slug text not null unique,
  arquetipo text not null,        -- ej: 'objetos y memoria', 'reencuentros imposibles'
  titulo text not null,
  resumen text not null,
  contenido_html text not null,
  copy_instagram text,            -- texto adaptado para Facebook/Instagram
  imagen_url text,
  imagen_credito text,
  publicado_en timestamptz not null default now()
);

-- Historias "reales" (partidas de un hecho real de Reddit, dramatizado por Bastián)
-- vs. historias 100% ficticias (arquetipo). fuente_id sirve para no repetir la
-- misma historia base dos veces.
alter table historias add column if not exists es_real boolean not null default false;
alter table historias add column if not exists fuente_id text;
alter table historias add column if not exists fuente_url text;
alter table historias add column if not exists fuente_sub text;

create index if not exists historias_publicado_idx on historias (publicado_en desc);
create unique index if not exists historias_fuente_id_idx on historias (fuente_id) where fuente_id is not null;

alter table historias enable row level security;

create policy "Lectura pública de historias"
  on historias for select
  using (true);

-- Ejecutar una vez en el SQL Editor de Supabase (https://app.supabase.com -> tu proyecto -> SQL Editor)

create table if not exists noticias (
  id bigint generated always as identity primary key,
  slug text not null unique,
  categoria text not null,               -- 'ia' | 'videojuegos' | 'actualidad'
  titulo text not null,
  resumen text not null,
  contenido_html text not null,
  imagen_url text,
  imagen_credito text,                   -- nombre del autor/fuente de la imagen (Pexels lo exige)
  fuente_nombre text,
  fuente_url text not null,
  fuente_url_hash text not null unique,  -- hash de fuente_url, usado para deduplicar sin URLs larguísimas en el índice
  publicado_en timestamptz not null default now()
);

create index if not exists noticias_categoria_idx on noticias (categoria, publicado_en desc);
create index if not exists noticias_publicado_idx on noticias (publicado_en desc);

-- RLS: lectura pública, escritura solo con la service_role key (la que usa el cron)
alter table noticias enable row level security;

create policy "Lectura pública de noticias"
  on noticias for select
  using (true);

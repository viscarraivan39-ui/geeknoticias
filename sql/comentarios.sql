-- Ejecutar una vez en el SQL Editor de Supabase.

create table if not exists comentarios (
  id bigint generated always as identity primary key,
  noticia_slug text not null references noticias (slug) on delete cascade,
  nombre text not null,
  texto text not null,
  creado_en timestamptz not null default now()
);

create index if not exists comentarios_slug_idx on comentarios (noticia_slug, creado_en desc);

alter table comentarios enable row level security;

create policy "Lectura pública de comentarios"
  on comentarios for select
  using (true);

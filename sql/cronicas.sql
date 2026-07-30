-- Ejecutar una vez en el SQL Editor de Supabase.
--
-- Crónicas de "Franco Islas", cronista independiente de GeekNoticias.
-- Ensayo/crónica personal en primera persona sobre tecnología y vida
-- cotidiana en Chile y Latinoamérica — no es ficción narrativa (eso es
-- "historias", firmadas por Bastián) ni noticia verificada.

create table if not exists cronicas (
  id bigint generated always as identity primary key,
  slug text not null unique,
  angulo text not null,           -- semilla temática usada para esta entrega (evita repetir tema)
  titulo text not null,
  resumen text not null,
  contenido_html text not null,
  copy_instagram text,
  imagen_url text,
  imagen_credito text,
  publicado_en timestamptz not null default now()
);

create index if not exists cronicas_publicado_idx on cronicas (publicado_en desc);

alter table cronicas enable row level security;

drop policy if exists "Lectura pública de crónicas" on cronicas;
create policy "Lectura pública de crónicas"
  on cronicas for select
  using (true);

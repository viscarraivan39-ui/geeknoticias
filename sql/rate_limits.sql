-- Ejecutar una vez en el SQL Editor de Supabase, además de noticias.sql

create table if not exists rate_limits (
  ip text not null,
  window_start bigint not null,
  count int not null default 1,
  primary key (ip, window_start)
);

create table if not exists blocked_ips (
  ip text primary key,
  blocked_until timestamptz not null
);

alter table rate_limits enable row level security;
alter table blocked_ips enable row level security;
-- Sin políticas públicas: solo la service_role key (usada por el servidor) puede leer/escribir.

create or replace function increment_rate_limit(p_ip text, p_window_start bigint)
returns int
language plpgsql
security definer
as $$
declare
  v_count int;
begin
  insert into rate_limits (ip, window_start, count)
  values (p_ip, p_window_start, 1)
  on conflict (ip, window_start) do update set count = rate_limits.count + 1
  returning count into v_count;
  return v_count;
end;
$$;

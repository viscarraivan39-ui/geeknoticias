# AGENTS.md — Contrato para agentes (Claude Code, Codex y otros)

Contrato corto y obligatorio. Se lee al iniciar cada sesión, antes de tocar nada.

> **Idioma:** el dueño (Iván) es chileno. Escribe en **español chileno neutro, con tuteo**,
> sin voseo argentino — en el chat, en los textos del sitio, en los mensajes de error y en
> los commits. "Usa / revisa / ingresa", nunca "usá / revisá / ingresá".

## Qué es
GeekNoticias (geeknoticias.com): sitio de noticias automático. HTML estático + funciones
serverless en Vercel (plan **Hobby**) + Supabase. La IA reescribe noticias (GNews), escribe
Historias (Bastián) y Crónicas (Franco Islas), genera imágenes y publica en la fanpage de Facebook.
Proyecto Vercel: `prj_ECdRN0fFZk9IsuADlVg5ghVwulsy`. Deploy = push a `main`.

## Antes de tocar código, lee
1. `docs/BUGS.md` — errores ya resueltos y lo que **no hay que reintroducir**.
2. `CHANGELOG.md` — qué se cambió último (si algo falla, empieza por ahí).
3. `.claude/skills/producir-video-geeknoticias/SKILL.md` — solo si vas a tocar videos o Facebook.

## Reglas que no se tocan
- **Máximo 12 funciones serverless** (límite de Hobby). Hoy hay 11. Un cron nuevo va como
  `job` dentro de `api/cron/run.js`, nunca como archivo nuevo en `api/`.
- **1 cron nativo de Vercel al día** (`job=news`, 13:00 UTC). Los otros jobs los dispara
  cron-job.org: `/api/cron/run?job=story&key=ADMIN_KEY` (3×día) y `job=cronica` (mié./dom.).
- **Toda llamada a un modelo de IA pasa por `lib/llmChat.js`** (lista de modelos con respaldo).
  Nunca fijar un solo modelo en duro: los proveedores los retiran sin avisar (BUG-001).
- **Toda llamada externa lleva timeout propio** (AbortController); no depender del corte de
  `maxDuration: 60`.
- Secretos (`CRON_SECRET`, `ADMIN_KEY`) se comparan con `lib/timingSafeEqual.js`.
- Endpoints públicos llevan rate limiting (`lib/rateLimit.js`).
- La publicación escalonada (noticias con `publicado_en` futuro + filtro de lectura) es a
  propósito: reemplaza un cron cada 30 min que Hobby no permite. No "arreglarla".
- Crónicas solo se publican mié./dom. — lo impone el código (guard America/Santiago).
- Facebook usa **token de PÁGINA**, no de usuario (BUG-005).
- Variables de entorno solo en Vercel; nunca en el repo: `GROQ_API_KEY`, `NVIDIA_API_KEY`,
  `GNEWS_API_KEY`, `PEXELS_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `CRON_SECRET`, `ADMIN_KEY`, `FB_PAGE_ID`, `FB_PAGE_ACCESS_TOKEN`.
- Cambios de esquema: agregar el `.sql` en `sql/` y avisar a Iván que hay que correrlo en Supabase.

## Cómo verificar
- Después del push: estado del deploy en Vercel y `get_runtime_errors` del proyecto.
- Después de un cambio en IA o crons: revisar los logs del siguiente cron (13:00 UTC).

## Al cerrar cada sesión (obligatorio)
La IA —no Iván— actualiza, en el mismo commit o en uno aparte:
1. `CHANGELOG.md`: qué cambió, cuándo y **por qué**.
2. `docs/BUGS.md`: cada error encontrado → síntoma, causa, arreglo y qué no reintroducir.
3. Este archivo, si nació una regla nueva que no se debe romper.

# Bugs y lecciones

Libreta de errores: cada uno con síntoma, causa, arreglo y **qué no reintroducir**.
Agregar nuevos arriba, con el número siguiente. No borrar entradas viejas.

---

### BUG-007 — Código fuente descargable desde el sitio (2026-09-29)
- **Síntoma:** `/lib/*.js` y `/scripts/*` respondían 200: cualquiera podía leer prompts, lógica de crons.
- **Causa:** Vercel sirve como archivo estático todo lo que está en la raíz del repo.
- **Arreglo:** `redirects` en `vercel.json` para `/lib/`, `/scripts/` y `/sql/` (se aplican antes que los estáticos; las funciones siguen importando esos archivos).
- **No reintroducir:** una carpeta nueva con código de servidor se agrega a esos `redirects`. No usar `.vercelignore` para carpetas que importan las funciones.

### BUG-006 — Deploy falla por pasar de 12 funciones (2026-07-30, `87d90bf`)
- **Síntoma:** "Error de compilación" en Vercel al agregar `fetch-cronica.js`.
- **Causa:** Vercel Hobby permite máximo 12 funciones serverless por deploy; quedaron 13.
- **Arreglo:** la lógica de los crons pasó a `lib/cron*.js` y un solo despachador `api/cron/run.js?job=`.
- **No reintroducir:** nunca crear un archivo nuevo en `api/` para un cron; agregarlo como `job`.
  Antes de sumar cualquier función, contar las que hay.

### BUG-005 — Facebook rechaza la subida de video (2026-07-31, `31237ac`)
- **Síntoma:** la publicación de video en la fanpage falla aunque el token "funciona".
- **Causa:** se usó un token de usuario; la Graph API exige token de **página**.
- **Arreglo:** sacar el token de `/me/accounts` → `data[].access_token` de la página.
- **No reintroducir:** `FB_PAGE_ACCESS_TOKEN` siempre es token de página.

### BUG-004 — Imágenes repetidas entre artículos (2026-07-30, `cab78bb`)
- **Síntoma:** varias noticias de la misma categoría salían con la misma imagen o una casi igual.
- **Causa:** si el modelo devolvía `imagen_prompt` vacío (JSON truncado), se usaba el texto de
  respaldo de la categoría, idéntico para todos.
- **Arreglo:** el respaldo siempre incluye el título del artículo; `max_tokens` explícito en Groq.
- **No reintroducir:** ningún prompt de imagen puede ser igual entre dos artículos; los campos
  críticos no van al final de un JSON que se puede truncar sin `max_tokens`.

### BUG-003 — Gemini pide facturación (2026-07-20, `b4e3788`)
- **Síntoma:** la reescritura con Gemini no funcionaba en capa gratuita.
- **Causa:** la cuenta de Google queda en modo prepago según la región.
- **Arreglo:** cambio a Groq (con NVIDIA NIM de respaldo).
- **No reintroducir:** no volver a Gemini sin confirmar facturación.

### BUG-002 — Rate limit que fallaba en silencio (2026-08-05, `82a5565`)
- **Síntoma:** si Supabase no respondía, el rate limit dejaba de funcionar sin avisar.
- **Causa:** llamada sin try/catch ni timeout.
- **Arreglo:** timeout de 3 s, log `RATE LIMIT INACTIVO` y opción `cerrarSiFalla`.
- **No reintroducir:** ninguna llamada externa sin timeout ni manejo de error visible.

### BUG-001 — Un mes sin publicar: modelo de IA retirado (2026-09-29, `6ab378d`)
- **Síntoma:** desde ~26-ago los crons de noticias, crónicas e historias no publicaban nada.
- **Causa:** Groq (404) y NVIDIA (410) retiraron `llama-3.3-70b`, que estaba fijo en el código.
- **Arreglo:** `lib/llmChat.js` prueba una lista de modelos por proveedor y pasa al siguiente si
  uno está retirado o sin cupo (Groq: gpt-oss-120b → gpt-oss-20b → llama-3.1-8b-instant; NVIDIA: gpt-oss-20b).
- **No reintroducir:** nunca un modelo único en duro. Si un cron deja de publicar, revisar
  primero `get_runtime_errors` en Vercel buscando 404/410 del proveedor.
- **Pendiente:** confirmar en los logs del cron del 30-sep (13:00 UTC) que Groq responde en producción.

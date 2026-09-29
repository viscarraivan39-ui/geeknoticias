# Changelog

Historial de cambios: qué se cambió, cuándo y por qué. Lo más nuevo arriba.
Lo actualiza la IA al cerrar cada sesión (ver `AGENTS.md`).

## 2026-09-29
- **IA con respaldo** (`6ab378d`): nuevo `lib/llmChat.js` con lista de modelos por proveedor.
  Por qué: `llama-3.3-70b` fue retirado y el sitio llevaba un mes sin publicar (BUG-001).
- **Docs:** se agregan `AGENTS.md`, `CLAUDE.md`, `docs/BUGS.md` y este changelog.

## 2026-08-05
- **Auditoría de seguridad** (`82a5565`): rate limit en todos los endpoints públicos, timeouts en
  llamadas pagadas, comparación timing-safe de secretos. Por qué: robustez (BUG-002).

## 2026-08-02
- **Imágenes con FLUX (NVIDIA NIM)** en Supabase Storage (bucket `imagenes`), respaldo
  Pollinations/Pexels (`1725a94`). Por qué: mejor calidad.

## 2026-07-31
- **Pipeline de video** + publicación en Facebook (`51177c3`, `506c695`, `31237ac`), tendencias
  de Google Trends para newsjacking (`e6bf3cb`), marca de agua fija en vez del destello (`2e642c3`).

## 2026-07-30
- Tema claro/oscuro manual, página de equipo con firmas por categoría, home agrupado por categoría,
  categorías Deportes y Salud, logo y widget "¿Cómo te sientes hoy?".
- **Sección Crónicas** (Franco Islas, mié./dom.) + arreglo de imágenes repetidas (`cab78bb`, BUG-004).
- **Crons unificados en `api/cron/run.js`** (`87d90bf`). Por qué: límite de 12 funciones (BUG-006).

## 2026-07-20 → 07-22
- Lanzamiento: reescritura con Groq (antes Gemini, BUG-003), NVIDIA de respaldo, SEO técnico
  (sitemap, JSON-LD, Search Console, Bing), imágenes por artículo, comentarios, dedup semántico,
  rediseño tipo revista, indicadores económicos, publicación escalonada, sección Historias
  (Bastián) con auto-publicación en Facebook, `ads.txt` para AdSense.
- `fetch-story` pasa de cron de Vercel a cron-job.org (3×día) (`76bfa83`). Por qué: Hobby permite 1 cron nativo al día.

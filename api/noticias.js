// /api/noticias.js
//
// Endpoint público (sin clave) que la página noticias.html llama para
// listar las noticias guardadas en Supabase por /api/cron/fetch-news.js.
// Soporta ?categoria=ia|videojuegos|actualidad y ?limit=20&offset=0.

import { rateLimit } from '../lib/rateLimit.js';

export default async function handler(req, res) {
  if (!(await rateLimit(req, res))) return;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(200).json({ noticias: [] });
  }

  const categoria = typeof req.query.categoria === 'string' ? req.query.categoria : null;
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

  const url = new URL(`${SUPABASE_URL}/rest/v1/noticias`);
  url.searchParams.set('select', 'slug,categoria,titulo,resumen,imagen_url,imagen_credito,fuente_nombre,publicado_en');
  url.searchParams.set('order', 'publicado_en.desc');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));
  if (categoria) url.searchParams.set('categoria', `eq.${categoria}`);

  try {
    const resp = await fetch(url, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
    if (!resp.ok) {
      throw new Error(`Supabase HTTP ${resp.status}: ${await resp.text()}`);
    }
    const noticias = await resp.json();
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');
    return res.status(200).json({ noticias });
  } catch (err) {
    console.error('Error listando noticias:', err);
    return res.status(500).json({ error: 'No se pudieron cargar las noticias.' });
  }
}

// /api/historias.js — lista las historias de Bastián para la página /historias.html

import { rateLimit } from '../lib/rateLimit.js';

export default async function handler(req, res) {
  if (!(await rateLimit(req, res))) return;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(200).json({ historias: [] });
  }

  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

  const url = new URL(`${SUPABASE_URL}/rest/v1/historias`);
  url.searchParams.set('select', 'slug,arquetipo,titulo,resumen,imagen_url,imagen_credito,publicado_en');
  url.searchParams.set('order', 'publicado_en.desc');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));

  try {
    const resp = await fetch(url, {
      headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
    });
    if (!resp.ok) throw new Error(`Supabase HTTP ${resp.status}`);
    const historias = await resp.json();
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');
    return res.status(200).json({ historias });
  } catch (err) {
    console.error('Error listando historias:', err);
    return res.status(500).json({ error: 'No se pudieron cargar las historias.' });
  }
}

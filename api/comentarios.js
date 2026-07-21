// /api/comentarios.js
//
// GET  ?slug=xxx        -> lista los comentarios de una noticia
// POST { slug, nombre, email, texto, empresa } -> publica un comentario nuevo
//
// El correo es obligatorio pero NUNCA se devuelve en el GET (queda solo en
// Supabase) — no hay verificación por email, es solo una fricción extra
// contra spam. El "nombre" funciona como alias público.
//
// Sin panel de moderación: se publica al toque, protegido con rate limit +
// honeypot + validación de longitud. Si hay abuso, se borran filas a mano
// desde el dashboard de Supabase.

import { rateLimit } from '../lib/rateLimit.js';

const NOMBRE_MAX = 40;
const TEXTO_MAX = 600;
const TEXTO_MIN = 3;
const URL_RE = /https?:\/\/|www\./i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (!(await rateLimit(req, res, { limit: 20, windowSeconds: 60, blockSeconds: 300 }))) return;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'El servidor no está configurado todavía.' });
  }
  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };

  if (req.method === 'GET') {
    const slug = typeof req.query.slug === 'string' ? req.query.slug : '';
    if (!slug) return res.status(400).json({ error: 'Falta el parámetro slug.' });

    try {
      const url = new URL(`${SUPABASE_URL}/rest/v1/comentarios`);
      url.searchParams.set('select', 'nombre,texto,creado_en');
      url.searchParams.set('noticia_slug', `eq.${slug}`);
      url.searchParams.set('order', 'creado_en.desc');
      url.searchParams.set('limit', '100');

      const resp = await fetch(url, { headers });
      if (!resp.ok) throw new Error(`Supabase HTTP ${resp.status}`);
      const comentarios = await resp.json();
      res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
      return res.status(200).json({ comentarios });
    } catch (err) {
      console.error('Error listando comentarios:', err);
      return res.status(500).json({ error: 'No se pudieron cargar los comentarios.' });
    }
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    body = body || {};

    const honeypot = String(body.empresa || '').trim();
    if (honeypot) return res.status(200).json({ ok: true });

    const slug = String(body.slug || '').trim();
    const nombre = String(body.nombre || '').trim().slice(0, NOMBRE_MAX);
    const email = String(body.email || '').trim().toLowerCase();
    const texto = String(body.texto || '').trim().slice(0, TEXTO_MAX);

    if (!slug) return res.status(400).json({ error: 'Falta la noticia.' });
    if (!nombre) return res.status(400).json({ error: 'Elegí un alias.' });
    if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'Ingresá un correo válido.' });
    if (texto.length < TEXTO_MIN) return res.status(400).json({ error: 'El comentario es muy corto.' });
    if (URL_RE.test(nombre) || URL_RE.test(texto)) {
      return res.status(400).json({ error: 'No se permiten links en los comentarios.' });
    }

    try {
      const resp = await fetch(`${SUPABASE_URL}/rest/v1/comentarios`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({ noticia_slug: slug, nombre, email, texto }),
      });
      if (!resp.ok) throw new Error(`Supabase HTTP ${resp.status}: ${await resp.text()}`);
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('Error guardando comentario:', err);
      return res.status(500).json({ error: 'No se pudo publicar el comentario. Intentá de nuevo.' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Método no permitido' });
}

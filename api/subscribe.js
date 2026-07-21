// /api/subscribe.js
import { rateLimit } from '../lib/rateLimit.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (!(await rateLimit(req, res))) return;

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const email = String(body.email || '').trim().toLowerCase();
  const honeypot = String(body.empresa || '').trim();

  if (honeypot) {
    return res.status(200).json({ ok: true });
  }

  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Ingresa un correo válido.' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
    return res.status(500).json({ error: 'El servidor no está configurado todavía. Intenta más tarde.' });
  }

  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/subscribers`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates,return=minimal',
      },
      body: JSON.stringify({ email }),
    });

    if (!resp.ok) {
      throw new Error(`Supabase HTTP ${resp.status}: ${await resp.text()}`);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Error guardando suscripción:', err);
    return res.status(500).json({ error: 'No se pudo guardar tu correo. Intenta de nuevo.' });
  }
}

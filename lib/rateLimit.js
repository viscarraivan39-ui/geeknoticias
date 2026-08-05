// /lib/rateLimit.js
//
// Rate limiting simple por IP usando Supabase (tablas rate_limits/blocked_ips,
// ver sql/rate_limits.sql). Ventana fija de `windowSeconds` con límite
// `limit`; si se excede, la IP queda bloqueada `blockSeconds` adicionales.
//
// Uso en un handler de /api:
//   if (!(await rateLimit(req, res))) return;
//   if (!(await rateLimit(req, res, { cerrarSiFalla: true }))) return; // endpoints sensibles
//
// Política de fallos (auditoría checklist-10-etapas, 2026-08-05 — antes
// esto fallaba abierto Y en silencio si faltaba Supabase, y las llamadas no
// tenían try/catch ni timeout propio, mismo patrón ya corregido en
// profe-emi-web/AvíspateYa):
//   - Si faltan las variables de entorno o Supabase no responde a tiempo: se
//     loguea SIEMPRE fuerte, con el prefijo "RATE LIMIT INACTIVO" para que
//     sea imposible de perder entre otros logs.
//   - `cerrarSiFalla: true` (endpoints sensibles/caros) rechaza la request
//     con 503 si el rate limit no está operativo. Por defecto (false) falla
//     abierto para no cortarle el servicio a nadie por un blip de Supabase.

const SUPABASE_TIMEOUT_MS = 3000;

function fetchConTimeout(url, opts) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SUPABASE_TIMEOUT_MS);
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(timer));
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

function reportarInactivo(res, motivo, cerrarSiFalla) {
  console.error(`[rateLimit] RATE LIMIT INACTIVO — ${motivo} — ${cerrarSiFalla ? 'FALLANDO CERRADO (bloqueando request, endpoint sensible)' : 'fallando abierto (sin límite aplicado esta request)'}`);
  if (cerrarSiFalla) {
    res.status(503).json({ error: 'Servicio temporalmente no disponible. Intentá de nuevo en unos minutos.' });
  }
}

export async function rateLimit(req, res, { limit = 60, windowSeconds = 60, blockSeconds = 300, cerrarSiFalla = false } = {}) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    reportarInactivo(res, 'faltan SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY', cerrarSiFalla);
    return !cerrarSiFalla;
  }

  const ip = getClientIp(req);
  const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

  try {
    const blockResp = await fetchConTimeout(
      `${SUPABASE_URL}/rest/v1/blocked_ips?ip=eq.${encodeURIComponent(ip)}&select=blocked_until`,
      { headers }
    );
    const blockRows = await blockResp.json();
    if (Array.isArray(blockRows) && blockRows[0] && new Date(blockRows[0].blocked_until) > new Date()) {
      res.setHeader('Retry-After', String(blockSeconds));
      res.status(429).json({ error: 'Demasiadas solicitudes. Intentá de nuevo en unos minutos.' });
      return false;
    }

    const windowStart = Math.floor(Date.now() / 1000 / windowSeconds);
    const rpcResp = await fetchConTimeout(`${SUPABASE_URL}/rest/v1/rpc/increment_rate_limit`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ p_ip: ip, p_window_start: windowStart }),
    });
    const count = await rpcResp.json();

    if (typeof count === 'number' && count > limit) {
      const blockedUntil = new Date(Date.now() + blockSeconds * 1000).toISOString();
      await fetchConTimeout(`${SUPABASE_URL}/rest/v1/blocked_ips`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({ ip, blocked_until: blockedUntil }),
      });
      res.setHeader('Retry-After', String(blockSeconds));
      res.status(429).json({ error: 'Demasiadas solicitudes. Intentá de nuevo en unos minutos.' });
      return false;
    }

    return true;
  } catch (err) {
    reportarInactivo(res, `Supabase no respondió a tiempo (timeout o caída): ${err.message}`, cerrarSiFalla);
    return !cerrarSiFalla;
  }
}

// /lib/rateLimit.js
//
// Rate limiting simple por IP usando Supabase (tablas rate_limits/blocked_ips,
// ver sql/rate_limits.sql). Ventana fija de `windowSeconds` con límite
// `limit`; si se excede, la IP queda bloqueada `blockSeconds` adicionales.
//
// Uso en un handler de /api:
//   if (!(await rateLimit(req, res))) return;

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

export async function rateLimit(req, res, { limit = 60, windowSeconds = 60, blockSeconds = 300 } = {}) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) return true; // sin Supabase configurado, no bloqueamos

  const ip = getClientIp(req);
  const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

  const blockResp = await fetch(
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
  const rpcResp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_rate_limit`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ p_ip: ip, p_window_start: windowStart }),
  });
  const count = await rpcResp.json();

  if (typeof count === 'number' && count > limit) {
    const blockedUntil = new Date(Date.now() + blockSeconds * 1000).toISOString();
    await fetch(`${SUPABASE_URL}/rest/v1/blocked_ips`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ ip, blocked_until: blockedUntil }),
    });
    res.setHeader('Retry-After', String(blockSeconds));
    res.status(429).json({ error: 'Demasiadas solicitudes. Intentá de nuevo en unos minutos.' });
    return false;
  }

  return true;
}

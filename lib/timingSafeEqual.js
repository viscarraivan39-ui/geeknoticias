// /lib/timingSafeEqual.js
//
// Comparación de secretos (CRON_SECRET, ADMIN_KEY) sin timing attack —
// checklist-10-etapas, auditoría 2026-08-05. `===` normal filtra por
// cuánto tiempo tarda en fallar en qué byte, en teoría explotable para
// adivinar el secreto carácter por carácter. Volumen actual bajo, pero es
// barato de corregir.

import { timingSafeEqual } from 'node:crypto';

export function secretoValido(recibido, esperado) {
  if (!recibido || !esperado) return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

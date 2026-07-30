// /api/cron/fetch-cronica.js
//
// Cron de "Franco Islas", cronista independiente de la sección "Crónicas"
// de GeekNoticias. Identidad y ángulo temático decididos con libertad total
// al diseñar este endpoint (a pedido explícito del usuario) — el modelo
// escribe la crónica puntual dentro de esa voz, no un tema fijo cada vez.
//
// Franco Islas escribe en primera persona sobre la fricción entre la
// tecnología y la vida cotidiana en Chile y Latinoamérica: ironía seca,
// cercanía real, sin fórmula fija. Es ensayo/crónica de no-ficción, no
// ficción narrativa emotiva (eso es "historias", firmadas por Bastián).
//
// Publica SOLO miércoles y domingo — el chequeo de día vive acá adentro,
// no solo en la programación del cron externo, para que un disparo manual
// o un reintento de cron-job.org en otro día no publique fuera de calendario.
//
// ─── VARIABLES DE ENTORNO NECESARIAS (ya configuradas para fetch-news.js) ──
//   GROQ_API_KEY, NVIDIA_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   CRON_SECRET / ADMIN_KEY
//
// ─── OPCIONAL: publicar también en la fanpage de Facebook ─────────────────
//   FB_PAGE_ID, FB_PAGE_ACCESS_TOKEN — si faltan, simplemente no publica ahí.
//
// Antes de usar esto hay que correr sql/cronicas.sql en el SQL Editor de Supabase.
//
// El cron externo (cron-job.org) se configura para disparar solo miércoles
// y domingo, pero el guard de DIAS_PUBLICACION de abajo es la garantía real.

import { createHash } from 'node:crypto';

const DIAS_PUBLICACION = [0, 3]; // domingo, miércoles (0=domingo en getDay())

const ANGULOS = [
  'un objeto tecnológico obsoleto que alguien todavía usa a diario',
  'una fila humana esperando algo que depende de una pantalla',
  'la brecha generacional frente a un mismo aparato',
  'un oficio antiguo que la tecnología nunca logró reemplazar del todo',
  'el ruido de las notificaciones en un lugar que debería ser silencioso',
  'una ciudad latinoamericana vista a través de una aplicación',
  'la nostalgia por una tecnología que ya nadie más extraña en voz alta',
  'el momento exacto en que un electrodoméstico se puso "inteligente" y dejó de inspirar confianza',
  'gente distinta mirando el mismo celular por razones completamente distintas',
  'el algoritmo como vecino silencioso de la cuadra',
  'la burocracia digital comparada con la de antes, en persona',
  'un dato curioso menor que cambia cómo se mira la propia ciudad',
  'la primera vez que algo hecho por IA generó una reacción genuina, buena o mala',
  'el trabajo invisible detrás de una notificación push',
  'lo que se pierde y lo que se gana cuando un trámite se vuelve 100% remoto',
  'un negocio de barrio que resiste sin adaptarse a nada digital',
];

const IMAGE_TIMEOUT_MS = 10000;
const IMAGE_RETRIES = 2;

function slugify(text) {
  return text
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

function diaActualSantiago() {
  // getDay() depende de la zona horaria del proceso; forzamos America/Santiago
  // para que el guard de día no dependa de en qué región corre la función.
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Santiago', weekday: 'short' });
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[fmt.format(new Date())];
}

async function getRecentAngulos(supabaseUrl, serviceKey, limit = 6) {
  const resp = await fetch(
    `${supabaseUrl}/rest/v1/cronicas?select=angulo&order=publicado_en.desc&limit=${limit}`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  );
  if (!resp.ok) return [];
  const rows = await resp.json();
  return rows.map((r) => r.angulo).filter(Boolean);
}

function pickAngulo(recientes) {
  const disponibles = ANGULOS.filter((a) => !recientes.includes(a));
  const pool = disponibles.length ? disponibles : ANGULOS;
  return pool[Math.floor(Math.random() * pool.length)];
}

function buildCronicaPrompt(angulo) {
  return `Sos "Franco Islas", cronista independiente de la sección "Crónicas" de un portal de noticias (GeekNoticias). Escribís en primera persona sobre la fricción entre la tecnología y la vida cotidiana en Chile y Latinoamérica. Tu voz: ironía seca pero afecto real por lo que observás, curiosidad genuina, cercanía — nunca condescendencia ni cinismo vacío. No seguís una fórmula fija: cada crónica puede arrancar de una anécdota personal, una escena callejera, un objeto, una fila, un dato menor. Tenés libertad total sobre cómo estructurar el texto.

Esta entrega parte del ángulo: "${angulo}". Usalo como disparador, no como tema obligatorio a explicar punto por punto — dejá que la crónica vaya a donde tenga que ir.

Reglas duras, no negociables:
1. Es CRÓNICA/ENSAYO PERSONAL, no ficción narrativa emotiva y no una noticia verificada. No inventes hechos noticiosos concretos y verificables (nombres de empresas reales con datos falsos, cifras oficiales inventadas, eventos puntuales atribuidos a personas reales). Podés narrar una escena o anécdota genérica/hipotética presentada honestamente como reflexión personal, no como reportaje.
2. Primera persona, español de Chile sin exagerar el modismo, tono conversacional pero cuidado — no jerga técnica innecesaria.
3. Nada de moraleja de manual ni cierre tipo "en conclusión, la tecnología nos une y nos separa" — cerrá con algo específico, no genérico.
4. Extensión: 500-800 palabras, en 5-8 párrafos.

Devolvé SOLO un JSON válido (sin markdown, sin \`\`\`) con esta forma exacta:
{"titulo": "...", "resumen": "1-2 líneas para la vista previa", "contenido_html": "<p>...</p><p>...</p>...", "copy_instagram": "...", "imagen_prompt": "..."}

- "copy_instagram": versión para Facebook/Instagram — primera línea como gancho, párrafos cortos, termina invitando a comentar. Máximo 900 caracteres.
- "imagen_prompt": descripción EN INGLÉS (máx. 35 palabras) de una fotografía editorial realista de una escena cotidiana concreta relacionada al ángulo de esta crónica (no un collage abstracto de "tecnología"). Sin texto, sin logos, sin marcas de agua.`;
}

function parseCronicaJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('No se encontró JSON en la respuesta del modelo');
    return JSON.parse(text.slice(start, end + 1));
  }
}

async function writeWithGroq(prompt) {
  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.95,
      max_tokens: 3000,
    }),
  });
  if (!resp.ok) throw new Error(`Groq HTTP ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error(`Groq no devolvió contenido: ${JSON.stringify(data)}`);
  return parseCronicaJson(text);
}

async function writeWithNvidia(prompt) {
  const resp = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'meta/llama-3.3-70b-instruct',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.95,
      max_tokens: 3000,
    }),
  });
  if (!resp.ok) throw new Error(`NVIDIA NIM HTTP ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error(`NVIDIA NIM no devolvió contenido: ${JSON.stringify(data)}`);
  return parseCronicaJson(text);
}

async function writeCronica(prompt) {
  try {
    return await writeWithGroq(prompt);
  } catch (err) {
    console.error('Groq falló escribiendo la crónica, reintento con NVIDIA:', err.message || err);
    if (!process.env.NVIDIA_API_KEY) throw err;
    return await writeWithNvidia(prompt);
  }
}

async function tryPollinations(prompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);
  try {
    const seed = Math.floor(Math.random() * 1e9);
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1200&height=675&nologo=true&seed=${seed}`;
    const resp = await fetch(url, { signal: controller.signal });
    if (resp.ok) {
      resp.body?.cancel?.();
      return url;
    }
    return null;
  } catch (err) {
    console.error('Intento de Pollinations falló:', err.message || err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function findImage(imagenPrompt, angulo) {
  // Igual que en fetch-news.js/fetch-story.js: si falta imagen_prompt, el
  // fallback nunca es un texto genérico compartido por todas las crónicas
  // (eso es lo que causaba "siempre la misma imagen") — sumamos el ángulo.
  const fallback = `editorial photograph of everyday life, related to: ${angulo}`;
  const prompt = (imagenPrompt || fallback).slice(0, 300);
  for (let attempt = 0; attempt < IMAGE_RETRIES; attempt++) {
    const url = await tryPollinations(prompt);
    if (url) return { imagen_url: url, imagen_credito: 'Generada con IA' };
  }
  return { imagen_url: null, imagen_credito: null };
}

async function postToFacebook({ imagenUrl, copyInstagram, titulo, slug }) {
  const PAGE_ID = process.env.FB_PAGE_ID;
  const PAGE_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!PAGE_ID || !PAGE_TOKEN) return { posted: false, reason: 'FB_PAGE_ID/FB_PAGE_ACCESS_TOKEN no configurados' };

  const cronicaUrl = `https://geeknoticias.com/cronica/${encodeURIComponent(slug)}`;
  const disclaimer = '✍️ Crónica de Franco Islas, escrita con asistencia de IA — opinión/ensayo personal, no una noticia verificada.';
  const caption = `${copyInstagram || titulo}\n\n${disclaimer}\nLeé la crónica completa en ${cronicaUrl}\n\n#Crónicas #GeekNoticias`;

  const params = new URLSearchParams({ caption, access_token: PAGE_TOKEN });
  if (imagenUrl) params.set('url', imagenUrl);

  const endpoint = imagenUrl
    ? `https://graph.facebook.com/v20.0/${PAGE_ID}/photos`
    : `https://graph.facebook.com/v20.0/${PAGE_ID}/feed`;
  if (!imagenUrl) { params.delete('caption'); params.set('message', caption); }

  const resp = await fetch(endpoint, { method: 'POST', body: params });
  const data = await resp.json();
  if (!resp.ok) throw new Error(`Facebook HTTP ${resp.status}: ${JSON.stringify(data)}`);
  return { posted: true, id: data.id || data.post_id };
}

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  const isVercelCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const providedKey = req.query.key;
  const isManualTrigger = providedKey && providedKey === process.env.ADMIN_KEY;

  if (!isVercelCron && !isManualTrigger) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  const forzarDia = isManualTrigger && req.query.force === '1';
  if (!forzarDia && !DIAS_PUBLICACION.includes(diaActualSantiago())) {
    return res.status(200).json({ ok: true, skipped: true, motivo: 'Hoy no toca crónica (solo miércoles y domingo).' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'No hay Supabase conectado.' });
  }

  try {
    const recientes = await getRecentAngulos(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const angulo = pickAngulo(recientes);
    const cronica = await writeCronica(buildCronicaPrompt(angulo));

    const { imagen_url, imagen_credito } = await findImage(cronica.imagen_prompt, angulo);

    const urlHash = createHash('sha256').update(cronica.titulo + Date.now()).digest('hex');
    const slug = `${slugify(cronica.titulo)}-${urlHash.slice(0, 8)}`;

    const resp = await fetch(`${SUPABASE_URL}/rest/v1/cronicas`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        slug,
        angulo,
        titulo: cronica.titulo,
        resumen: cronica.resumen,
        contenido_html: cronica.contenido_html,
        copy_instagram: cronica.copy_instagram,
        imagen_url,
        imagen_credito,
      }),
    });
    if (!resp.ok) throw new Error(`Supabase insert HTTP ${resp.status}: ${await resp.text()}`);

    let facebook = { posted: false };
    try {
      facebook = await postToFacebook({ imagenUrl: imagen_url, copyInstagram: cronica.copy_instagram, titulo: cronica.titulo, slug });
    } catch (err) {
      console.error('No se pudo publicar en Facebook (la crónica ya quedó guardada en el sitio):', err.message || err);
      facebook = { posted: false, error: String(err.message || err) };
    }

    return res.status(200).json({ ok: true, angulo, slug, titulo: cronica.titulo, facebook });
  } catch (err) {
    console.error('Error generando crónica:', err);
    return res.status(500).json({ error: String(err.message || err) });
  }
}

// /api/cron/fetch-news.js
//
// Este endpoint lo llama Vercel Cron automáticamente (ver vercel.json) una
// vez al día. Busca noticias recientes de varias categorías, las reescribe
// con Groq (contenido 100% original, no copy-paste, para no tener
// problemas de "scraped content" con AdSense), les genera una imagen única
// con IA (Pollinations, con respaldo en Pexels si falla o tarda), y guarda
// todo en Supabase. También borra las noticias con más de 30 días.
//
// ─── VARIABLES DE ENTORNO NECESARIAS (configurar en Vercel) ─────────────
//   GNEWS_API_KEY              → cuenta gratis en https://gnews.io
//   GROQ_API_KEY               → gratis, sin tarjeta, en https://console.groq.com/keys
//   PEXELS_API_KEY             → cuenta gratis en https://www.pexels.com/api (respaldo)
//   SUPABASE_URL                → URL del proyecto Supabase
//   SUPABASE_SERVICE_ROLE_KEY   → service_role key (NO la anon key: esta
//                                  escribe saltándose las políticas RLS)
//   CRON_SECRET / ADMIN_KEY     → mismos que usa fetch-offers.js
//
// Pollinations.ai no necesita API key.
//
// Antes de usar esto hay que correr una vez sql/noticias.sql en el SQL
// Editor de Supabase para crear la tabla.

import { createHash } from 'node:crypto';

const CATEGORIES = [
  {
    categoria: 'ia',
    queries: ['inteligencia artificial', 'ChatGPT OR OpenAI OR Google DeepMind'],
    imageFallbackQuery: 'artificial intelligence technology',
    lang: 'es',
  },
  {
    categoria: 'videojuegos',
    queries: ['videojuegos', 'PlayStation OR Xbox OR Nintendo'],
    imageFallbackQuery: 'video games gaming',
    lang: 'es',
  },
  {
    categoria: 'actualidad',
    queries: ['Chile', 'Argentina OR México OR Colombia OR Latinoamérica'],
    imageFallbackQuery: 'news current events',
    lang: 'es',
  },
];

const MAX_PER_QUERY = 3; // candidatos por búsqueda
const TARGET_PER_CATEGORY = 4; // tope de noticias a publicar por categoría por corrida (12/día en total)
const RETENTION_DAYS = 30;
const CONCURRENCY = 6; // artículos procesados en paralelo, para no pasarse del límite de 60s de Vercel
const IMAGE_TIMEOUT_MS = 6000;

function slugify(text) {
  return text
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita tildes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

function hashUrl(url) {
  return createHash('sha256').update(url).digest('hex');
}

// ─── GNEWS ─────────────────────────────────────────────────────────────

async function fetchQueryArticles(query, lang) {
  const url = new URL('https://gnews.io/api/v4/search');
  url.searchParams.set('q', query);
  url.searchParams.set('lang', lang);
  url.searchParams.set('max', String(MAX_PER_QUERY));
  url.searchParams.set('apikey', process.env.GNEWS_API_KEY);

  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`GNews HTTP ${resp.status}: ${await resp.text()}`);
  }
  const data = await resp.json();
  return Array.isArray(data.articles) ? data.articles : [];
}

async function fetchCategoryArticles({ queries, lang }) {
  const seen = new Set();
  const all = [];
  for (const query of queries) {
    const articles = await fetchQueryArticles(query, lang);
    for (const article of articles) {
      if (article.url && !seen.has(article.url)) {
        seen.add(article.url);
        all.push(article);
      }
    }
    await new Promise((r) => setTimeout(r, 1200)); // evita el rate limit de GNews
  }
  return all;
}

// ─── SUPABASE ────────────────────────────────────────────────────────────

async function alreadyExists(supabaseUrl, serviceKey, urlHash) {
  const resp = await fetch(
    `${supabaseUrl}/rest/v1/noticias?fuente_url_hash=eq.${urlHash}&select=id`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  );
  if (!resp.ok) throw new Error(`Supabase HTTP ${resp.status}: ${await resp.text()}`);
  const rows = await resp.json();
  return rows.length > 0;
}

async function deleteOldNoticias(supabaseUrl, serviceKey) {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const resp = await fetch(
    `${supabaseUrl}/rest/v1/noticias?publicado_en=lt.${encodeURIComponent(cutoff)}`,
    { method: 'DELETE', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  );
  if (!resp.ok) throw new Error(`Supabase delete HTTP ${resp.status}: ${await resp.text()}`);
}

// Devuelve false si ya existía (conflicto de unique constraint), true si insertó.
async function saveNoticia(supabaseUrl, serviceKey, row) {
  const resp = await fetch(`${supabaseUrl}/rest/v1/noticias`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates,return=minimal',
    },
    body: JSON.stringify(row),
  });
  if (resp.status === 409) return false;
  if (!resp.ok) throw new Error(`Supabase insert HTTP ${resp.status}: ${await resp.text()}`);
  return true;
}

// ─── GROQ (reescritura) ───────────────────────────────────────────────

async function rewriteWithGroq(article) {
  const prompt = `Actúa como un redactor senior de tecnología y actualidad, especializado en artículos extensos y bien documentados para un medio digital serio. Reescribe totalmente la siguiente noticia con tus propias palabras (no copies frases del original ni la resumas superficialmente), ampliando con contexto, antecedentes relevantes, posibles implicancias y comparaciones cuando corresponda, en español, tono informativo y atractivo.

Título original: ${article.title}
Descripción original: ${article.description || ''}

Devuelve SOLO un JSON válido (sin markdown, sin \`\`\`) con esta forma exacta:
{"titulo": "...", "resumen": "una frase de 1-2 líneas para la vista previa", "contenido_html": "<p>...</p><h2>...</h2><p>...</p>...", "imagen_prompt": "..."}

El contenido_html debe tener: introducción, 4 subtítulos H2 con desarrollo sustancial cada uno (contexto, detalles, impacto/implicancias, y perspectiva a futuro), y una conclusión. Mínimo 700 palabras. No hagas un simple resumen: expandí cada sección con profundidad real. Sin jerga técnica excesiva ni inventar datos falsos o cifras que no puedas fundamentar en la información dada.

El campo imagen_prompt debe ser una descripción breve EN INGLÉS (máximo 20 palabras) de una imagen editorial fotorrealista que ilustre el tema del artículo, sin texto ni logos ni marcas de agua.`;

  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    }),
  });
  if (!resp.ok) throw new Error(`Groq HTTP ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error(`Groq no devolvió contenido: ${JSON.stringify(data)}`);
  return JSON.parse(text);
}

// ─── IMÁGENES: Pollinations (IA, sin key) con respaldo en Pexels ───────

async function findImagePexels(query) {
  const url = new URL('https://api.pexels.com/v1/search');
  url.searchParams.set('query', query);
  url.searchParams.set('per_page', '1');
  url.searchParams.set('orientation', 'landscape');

  const resp = await fetch(url, { headers: { Authorization: process.env.PEXELS_API_KEY } });
  if (!resp.ok) throw new Error(`Pexels HTTP ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  const photo = data.photos && data.photos[0];
  if (!photo) return { imagen_url: null, imagen_credito: null };
  return { imagen_url: photo.src.large, imagen_credito: photo.photographer };
}

async function findImage(imagenPrompt, fallbackQuery) {
  const prompt = (imagenPrompt || fallbackQuery || '').slice(0, 300);
  if (prompt) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);
    try {
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1200&height=675&nologo=true`;
      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (resp.ok) {
        resp.body?.cancel?.();
        return { imagen_url: url, imagen_credito: 'Generada con IA' };
      }
    } catch (err) {
      clearTimeout(timeout);
      console.error('Pollinations falló, uso Pexels de respaldo:', err.message || err);
    }
  }

  try {
    return await findImagePexels(fallbackQuery);
  } catch (err) {
    console.error('Pexels de respaldo también falló:', err.message || err);
    return { imagen_url: null, imagen_credito: null };
  }
}

// ─── CONCURRENCIA ────────────────────────────────────────────────────────

async function runWithConcurrency(items, limit, worker) {
  let index = 0;
  async function runner() {
    while (index < items.length) {
      const current = index++;
      await worker(items[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runner));
}

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  const isVercelCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const providedKey = req.query.key;
  const isManualTrigger = providedKey && providedKey === process.env.ADMIN_KEY;

  if (!isVercelCron && !isManualTrigger) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'No hay Supabase conectado (faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).' });
  }

  try {
    await deleteOldNoticias(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  } catch (err) {
    console.error('Error borrando noticias viejas:', err);
  }

  const report = {};
  let inserted = 0;
  const worklist = [];
  let isFirstCategory = true;

  for (const cat of CATEGORIES) {
    if (!isFirstCategory) await new Promise((r) => setTimeout(r, 1500));
    isFirstCategory = false;

    report[cat.categoria] = { found: 0, inserted: 0, skipped: 0, errors: [] };
    try {
      const articles = await fetchCategoryArticles(cat);
      report[cat.categoria].found = articles.length;
      for (const article of articles) worklist.push({ cat, article });
    } catch (err) {
      report[cat.categoria].errors.push(String(err.message || err));
    }
  }

  await runWithConcurrency(worklist, CONCURRENCY, async ({ cat, article }) => {
    const catReport = report[cat.categoria];
    if (catReport.inserted >= TARGET_PER_CATEGORY) return;
    if (!article.url || !article.title) return;
    const urlHash = hashUrl(article.url);

    try {
      if (await alreadyExists(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, urlHash)) {
        catReport.skipped++;
        return;
      }
      if (catReport.inserted >= TARGET_PER_CATEGORY) return; // recheck tras el await

      const rewritten = await rewriteWithGroq(article);
      const { imagen_url, imagen_credito } = await findImage(rewritten.imagen_prompt, cat.imageFallbackQuery);
      const slugBase = slugify(rewritten.titulo || article.title);
      const slug = `${slugBase}-${urlHash.slice(0, 8)}`;

      const wasInserted = await saveNoticia(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        slug,
        categoria: cat.categoria,
        titulo: rewritten.titulo,
        resumen: rewritten.resumen,
        contenido_html: rewritten.contenido_html,
        imagen_url,
        imagen_credito,
        fuente_nombre: article.source && article.source.name,
        fuente_url: article.url,
        fuente_url_hash: urlHash,
      });

      if (wasInserted) {
        inserted++;
        catReport.inserted++;
      } else {
        catReport.skipped++;
      }
    } catch (err) {
      console.error(`Error procesando "${article.title}":`, err);
      catReport.errors.push(String(err.message || err));
    }
  });

  return res.status(200).json({ ok: true, inserted, report, updatedAt: new Date().toISOString() });
}

// /api/cron/fetch-news.js
//
// Este endpoint lo llama Vercel Cron automáticamente (ver vercel.json) una
// vez al día. Busca noticias recientes de varias categorías, las reescribe
// con Gemini (contenido 100% original, no copy-paste, para no tener
// problemas de "scraped content" con AdSense), les busca una imagen libre
// de copyright en Pexels, y guarda todo en Supabase.
//
// ─── VARIABLES DE ENTORNO NECESARIAS (configurar en Vercel) ─────────────
//   GNEWS_API_KEY              → cuenta gratis en https://gnews.io
//   GEMINI_API_KEY             → gratis, sin tarjeta, en https://aistudio.google.com/apikey
//   PEXELS_API_KEY             → cuenta gratis en https://www.pexels.com/api
//   SUPABASE_URL                → URL del proyecto Supabase
//   SUPABASE_SERVICE_ROLE_KEY   → service_role key (NO la anon key: esta
//                                  escribe saltándose las políticas RLS)
//   CRON_SECRET / ADMIN_KEY     → mismos que usa fetch-offers.js
//
// Antes de usar esto hay que correr una vez sql/noticias.sql en el SQL
// Editor de Supabase para crear la tabla.

import { createHash } from 'node:crypto';

const CATEGORIES = [
  { categoria: 'ia', query: 'inteligencia artificial', lang: 'es' },
  { categoria: 'videojuegos', query: 'videojuegos', lang: 'es' },
  { categoria: 'actualidad', query: 'chile actualidad', lang: 'es' },
];

const MAX_PER_CATEGORY = 2; // controla el costo de OpenAI/Pexels por corrida

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

async function fetchCategoryArticles({ query, lang }) {
  const url = new URL('https://gnews.io/api/v4/search');
  url.searchParams.set('q', query);
  url.searchParams.set('lang', lang);
  url.searchParams.set('max', String(MAX_PER_CATEGORY));
  url.searchParams.set('apikey', process.env.GNEWS_API_KEY);

  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`GNews HTTP ${resp.status}: ${await resp.text()}`);
  }
  const data = await resp.json();
  return Array.isArray(data.articles) ? data.articles : [];
}

async function alreadyExists(supabaseUrl, serviceKey, urlHash) {
  const resp = await fetch(
    `${supabaseUrl}/rest/v1/noticias?fuente_url_hash=eq.${urlHash}&select=id`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  );
  if (!resp.ok) throw new Error(`Supabase HTTP ${resp.status}: ${await resp.text()}`);
  const rows = await resp.json();
  return rows.length > 0;
}

async function rewriteWithGemini(article) {
  const prompt = `Actúa como un redactor senior de tecnología y actualidad. Reescribe totalmente la siguiente noticia con tus propias palabras (no copies frases del original), integrando un breve análisis propio, en español, tono informativo y atractivo.

Título original: ${article.title}
Descripción original: ${article.description || ''}

Devuelve SOLO un JSON válido (sin markdown, sin \`\`\`) con esta forma exacta:
{"titulo": "...", "resumen": "una frase de 1-2 líneas para la vista previa", "contenido_html": "<p>...</p><h2>...</h2><p>...</p>..."}

El contenido_html debe tener: introducción breve, 2-3 subtítulos H2 con su desarrollo, y una conclusión. Mínimo 400 palabras. Sin jerga técnica excesiva.`;

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    }
  );
  if (!resp.ok) throw new Error(`Gemini HTTP ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Gemini no devolvió contenido: ${JSON.stringify(data)}`);
  return JSON.parse(text);
}

async function findImage(query) {
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

async function saveNoticia(supabaseUrl, serviceKey, row) {
  const resp = await fetch(`${supabaseUrl}/rest/v1/noticias`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
  });
  if (!resp.ok) throw new Error(`Supabase insert HTTP ${resp.status}: ${await resp.text()}`);
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

  const report = {};
  let inserted = 0;
  let isFirstCategory = true;

  for (const cat of CATEGORIES) {
    if (!isFirstCategory) await new Promise((r) => setTimeout(r, 1500));
    isFirstCategory = false;

    report[cat.categoria] = { found: 0, inserted: 0, skipped: 0, errors: [] };
    let articles = [];
    try {
      articles = await fetchCategoryArticles(cat);
      report[cat.categoria].found = articles.length;
    } catch (err) {
      report[cat.categoria].errors.push(String(err.message || err));
      continue;
    }

    for (const article of articles) {
      if (!article.url || !article.title) continue;
      const urlHash = hashUrl(article.url);

      try {
        if (await alreadyExists(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, urlHash)) {
          report[cat.categoria].skipped++;
          continue;
        }

        const rewritten = await rewriteWithGemini(article);
        const { imagen_url, imagen_credito } = await findImage(cat.query);
        const slugBase = slugify(rewritten.titulo || article.title);
        const slug = `${slugBase}-${urlHash.slice(0, 8)}`;

        await saveNoticia(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
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

        inserted++;
        report[cat.categoria].inserted++;
      } catch (err) {
        console.error(`Error procesando "${article.title}":`, err);
        report[cat.categoria].errors.push(String(err.message || err));
      }
    }
  }

  return res.status(200).json({ ok: true, inserted, report, updatedAt: new Date().toISOString() });
}

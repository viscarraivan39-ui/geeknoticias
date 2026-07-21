// /api/cron/fetch-news.js
//
// Este endpoint lo llama Vercel Cron automáticamente (ver vercel.json) una
// vez al día. Busca noticias recientes de varias categorías, las reescribe
// con Groq (contenido 100% original, no copy-paste, para no tener
// problemas de "scraped content" con AdSense; si Groq falla, reintenta con
// NVIDIA NIM), descarta las que sean semánticamente el mismo hecho que algo
// ya publicado (embeddings de NVIDIA NIM, aunque la URL fuente sea distinta),
// les genera una imagen única con IA (Pollinations, con respaldo en Pexels
// si falla o tarda), y guarda todo en Supabase.
//
// La cantidad total de noticias por día varía entre DAILY_MIN y DAILY_MAX
// (sembrado por fecha, no verdaderamente aleatorio cada corrida), y cada una
// se guarda con su `publicado_en` escalonado PUBLISH_STAGGER_MIN minutos
// después de la anterior — así en el sitio aparecen goteando durante el día
// en vez de todas juntas apenas corre el cron. El listado (/api/noticias)
// filtra por publicado_en <= ahora, así que las que tienen fecha futura
// todavía no se muestran aunque ya estén guardadas en la base.
//
// Vercel Cron en el plan Hobby solo permite una corrida por día, por eso el
// escalonado se resuelve así (con timestamps futuros + filtro de lectura) en
// vez de programar un cron cada 30 minutos.
//
// También borra las noticias con más de 30 días.
//
// ─── VARIABLES DE ENTORNO NECESARIAS (configurar en Vercel) ─────────────
//   GNEWS_API_KEY              → cuenta gratis en https://gnews.io
//   GROQ_API_KEY               → gratis, sin tarjeta, en https://console.groq.com/keys
//   NVIDIA_API_KEY             → gratis, sin tarjeta, en https://build.nvidia.com (respaldo)
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
import { embedTitles, maxSimilarity } from '../../lib/nvidiaEmbed.js';

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
const DAILY_MIN = 5; // total de noticias a publicar por día, mínimo
const DAILY_MAX = 10; // total de noticias a publicar por día, máximo
const PUBLISH_STAGGER_MIN = 30; // minutos de separación entre la hora de publicación de cada noticia
const RETENTION_DAYS = 30;
const DEDUP_LOOKBACK = 40; // últimos títulos por categoría contra los que se compara semánticamente
const DEDUP_THRESHOLD = 0.92; // similitud coseno a partir de la cual se considera el mismo hecho
const CONCURRENCY = 9; // artículos procesados en paralelo, para no pasarse del límite de 60s de Vercel
const IMAGE_CONCURRENCY = 3; // Pollinations (gratis) rechaza ráfagas grandes desde la misma IP; se limita aparte del resto
const IMAGE_TIMEOUT_MS = 8000;
const IMAGE_RETRIES = 2; // intentos con Pollinations antes de caer al stock genérico de Pexels (16s tope entre los dos)

// RNG determinístico (mulberry32) sembrado con la fecha del día, para que si
// el cron corre dos veces el mismo día (reintento) el total no cambie.
function seededRandom(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function dailyTarget() {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const rand = seededRandom(today);
  return DAILY_MIN + Math.floor(rand() * (DAILY_MAX - DAILY_MIN + 1));
}

// Reparte el total del día entre las categorías lo más parejo posible.
function splitTargetByCategory(total, categories) {
  const base = Math.floor(total / categories.length);
  let remainder = total - base * categories.length;
  const result = {};
  for (const cat of categories) {
    result[cat.categoria] = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;
  }
  return result;
}

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

async function getRecentTitles(supabaseUrl, serviceKey, categoria) {
  const resp = await fetch(
    `${supabaseUrl}/rest/v1/noticias?categoria=eq.${categoria}&select=titulo&order=publicado_en.desc&limit=${DEDUP_LOOKBACK}`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  );
  if (!resp.ok) throw new Error(`Supabase HTTP ${resp.status}: ${await resp.text()}`);
  const rows = await resp.json();
  return rows.map((r) => r.titulo).filter(Boolean);
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

// ─── REESCRITURA: Groq (principal) con respaldo en NVIDIA NIM ─────────

function buildRewritePrompt(article) {
  return `Actúa como un redactor senior de tecnología y actualidad, especializado en artículos extensos y bien documentados para un medio digital serio. Reescribe totalmente la siguiente noticia con tus propias palabras (no copies frases del original ni la resumas superficialmente), ampliando con contexto, antecedentes relevantes, posibles implicancias y comparaciones cuando corresponda, en español, tono informativo y atractivo.

Título original: ${article.title}
Descripción original: ${article.description || ''}

Devuelve SOLO un JSON válido (sin markdown, sin \`\`\`) con esta forma exacta:
{"titulo": "...", "resumen": "una frase de 1-2 líneas para la vista previa", "contenido_html": "<p>...</p><h2>...</h2><p>...</p>...", "imagen_prompt": "..."}

El campo "titulo" tiene que ser LLAMATIVO, con la energía de un título de YouTube de MrBeast: genera curiosidad o urgencia real, usa números concretos cuando el dato lo permita, lenguaje directo y con gancho, sin ser plano ni genérico. Ejemplos del tono buscado: "Esto es lo que cambia HOY con el nuevo modelo de OpenAI", "3 datos que nadie te contó sobre...", "Por qué todos están hablando de...". Reglas duras que no podés romper: el título tiene que seguir siendo 100% verdadero respecto al contenido (nada de prometer algo que el artículo no cumple), sin MAYÚSCULAS SOSTENIDAS completas, sin signos de exclamación en exceso, y sin clickbait vacío tipo "no vas a creer lo que pasó" que no diga nada concreto del tema.

El contenido_html debe tener: introducción, 4 subtítulos H2 con desarrollo sustancial cada uno (contexto, detalles, impacto/implicancias, y perspectiva a futuro), y una conclusión. Mínimo 700 palabras. No hagas un simple resumen: expandí cada sección con profundidad real. Sin jerga técnica excesiva ni inventar datos falsos o cifras que no puedas fundamentar en la información dada.

El campo imagen_prompt debe ser una descripción breve EN INGLÉS (máximo 30 palabras) de una imagen editorial fotorrealista y VISUALMENTE ESPECÍFICA al tema exacto de este artículo (nombres de producto/lugar/objeto concretos mencionados en la noticia, no una escena genérica de "tecnología" o "noticias"), sin texto ni logos ni marcas de agua.`;
}

// Parser tolerante: algunos modelos envuelven el JSON en texto o \`\`\`.
function parseRewriteJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('No se encontró JSON en la respuesta del modelo');
    return JSON.parse(text.slice(start, end + 1));
  }
}

async function rewriteWithGroq(article) {
  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: buildRewritePrompt(article) }],
      response_format: { type: 'json_object' },
    }),
  });
  if (!resp.ok) throw new Error(`Groq HTTP ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error(`Groq no devolvió contenido: ${JSON.stringify(data)}`);
  return parseRewriteJson(text);
}

// Respaldo si Groq falla o se satura. NVIDIA NIM expone una API compatible con OpenAI.
async function rewriteWithNvidia(article) {
  const resp = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'meta/llama-3.3-70b-instruct',
      messages: [{ role: 'user', content: buildRewritePrompt(article) }],
      temperature: 0.6,
      max_tokens: 3000,
    }),
  });
  if (!resp.ok) throw new Error(`NVIDIA NIM HTTP ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error(`NVIDIA NIM no devolvió contenido: ${JSON.stringify(data)}`);
  return parseRewriteJson(text);
}

async function rewriteArticle(article) {
  try {
    return await rewriteWithGroq(article);
  } catch (err) {
    console.error('Groq falló, reintentando con NVIDIA NIM:', err.message || err);
    if (!process.env.NVIDIA_API_KEY) throw err;
    return await rewriteWithNvidia(article);
  }
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

async function tryPollinations(prompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);
  try {
    // seed aleatorio: evita que Pollinations devuelva una imagen cacheada
    // igual a la de otro artículo con un prompt parecido.
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

async function findImage(imagenPrompt, fallbackQuery) {
  const prompt = (imagenPrompt || fallbackQuery || '').slice(0, 300);
  if (prompt) {
    for (let attempt = 0; attempt < IMAGE_RETRIES; attempt++) {
      const url = await tryPollinations(prompt);
      if (url) return { imagen_url: url, imagen_credito: 'Generada con IA' };
    }
    console.error('Pollinations agotó los reintentos, uso Pexels de respaldo.');
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

// Limita cuántas llamadas a `fn` corren al mismo tiempo, independiente de la
// concurrencia general de artículos (para no saturar la API gratuita de Pollinations).
function createLimiter(limit) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= limit || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    fn().then(resolve, reject).finally(() => { active--; next(); });
  };
  return (fn) => new Promise((resolve, reject) => { queue.push({ fn, resolve, reject }); next(); });
}

const limitImageCalls = createLimiter(IMAGE_CONCURRENCY);

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

  const metaDiaria = dailyTarget();
  const targetByCategory = splitTargetByCategory(metaDiaria, CATEGORIES);
  const runStart = Date.now();
  let publishIndex = 0; // se incrementa sin await de por medio, no hace falta lock

  const report = {};
  let inserted = 0;
  const worklist = [];
  let isFirstCategory = true;

  for (const cat of CATEGORIES) {
    if (!isFirstCategory) await new Promise((r) => setTimeout(r, 1500));
    isFirstCategory = false;

    report[cat.categoria] = { found: 0, inserted: 0, skipped: 0, duplicadosSemanticos: 0, errors: [] };
    try {
      const articles = await fetchCategoryArticles(cat);
      report[cat.categoria].found = articles.length;
      for (const article of articles) worklist.push({ cat, article });
    } catch (err) {
      report[cat.categoria].errors.push(String(err.message || err));
    }
  }

  // En paralelo (no dentro del loop de arriba, que va secuencial por el rate limit de GNews).
  await Promise.all(CATEGORIES.map(async (cat) => {
    try {
      const recentTitles = await getRecentTitles(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, cat.categoria);
      cat.existingEmbeddings = await embedTitles(recentTitles);
    } catch (err) {
      console.error(`No se pudieron cargar embeddings de "${cat.categoria}", sigo sin dedup semántico:`, err.message || err);
      cat.existingEmbeddings = [];
    }
  }));

  await runWithConcurrency(worklist, CONCURRENCY, async ({ cat, article }) => {
    const catReport = report[cat.categoria];
    const catTarget = targetByCategory[cat.categoria];
    if (catReport.inserted >= catTarget) return;
    if (!article.url || !article.title) return;
    const urlHash = hashUrl(article.url);

    try {
      if (await alreadyExists(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, urlHash)) {
        catReport.skipped++;
        return;
      }
      if (catReport.inserted >= catTarget) return; // recheck tras el await

      const rewritten = await rewriteArticle(article);

      try {
        const [nuevoEmbedding] = await embedTitles([rewritten.titulo]);
        const similitud = maxSimilarity(nuevoEmbedding, cat.existingEmbeddings || []);
        if (similitud >= DEDUP_THRESHOLD) {
          catReport.skipped++;
          catReport.duplicadosSemanticos++;
          return;
        }
        if (nuevoEmbedding) (cat.existingEmbeddings ||= []).push(nuevoEmbedding);
      } catch (err) {
        console.error('Dedup semántico falló, sigo sin bloquear la publicación:', err.message || err);
      }

      const { imagen_url, imagen_credito } = await limitImageCalls(() => findImage(rewritten.imagen_prompt, cat.imageFallbackQuery));
      const slugBase = slugify(rewritten.titulo || article.title);
      const slug = `${slugBase}-${urlHash.slice(0, 8)}`;

      // Escalonado: cada noticia "aparece" 30 min después de la anterior en vez
      // de publicarse todas apenas termina de procesarlas el cron.
      const publishAt = new Date(runStart + publishIndex * PUBLISH_STAGGER_MIN * 60000).toISOString();
      publishIndex++;

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
        publicado_en: publishAt,
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

  return res.status(200).json({ ok: true, inserted, metaDiaria, targetByCategory, report, updatedAt: new Date().toISOString() });
}

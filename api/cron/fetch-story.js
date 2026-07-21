// /api/cron/fetch-story.js
//
// Cron diario (horario distinto al de noticias) que genera UNA historia
// narrativa/emotiva firmada por "Bastián" — no es una noticia verificada,
// es contenido inspiracional. El aviso de que es narrativa se agrega
// siempre desde el template de la página (nunca depende de que el modelo
// se acuerde de incluirlo).
//
// Usa el mismo Groq/NVIDIA que fetch-news.js para el texto, y Pollinations
// para la imagen (mismo patrón de reintentos).
//
// ─── VARIABLES DE ENTORNO NECESARIAS (ya configuradas para fetch-news.js) ──
//   GROQ_API_KEY, NVIDIA_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   CRON_SECRET / ADMIN_KEY
//
// ─── OPCIONAL: publicar también en la fanpage de Facebook ─────────────────
//   FB_PAGE_ID              → ID de la página en Graph API (no el de la URL del perfil)
//   FB_PAGE_ACCESS_TOKEN    → token de página con permiso pages_manage_posts / CREATE_CONTENT
//   Si estas dos no están configuradas, simplemente no publica en Facebook
//   y la historia igual queda guardada en el sitio — no rompe nada.
//
// Antes de usar esto hay que correr sql/historias.sql en el SQL Editor de Supabase.

import { createHash } from 'node:crypto';

const ARQUETIPOS = [
  'tecnología y memoria',
  'objetos olvidados',
  'reencuentros imposibles',
  'la última creación de un inventor',
  'animales y lealtad',
  'soledad urbana',
  'actos de bondad anónimos',
  'el paso del tiempo',
  'cartas o mensajes nunca entregados',
  'ciudades y fantasmas cotidianos',
  'la última función de algo que se apaga',
  'lo que queda de una casa vacía',
  'amistades entre especies distintas',
  'el último viaje de algo que ya no se usa',
  'lo que se hereda sin querer',
  'el silencio después de una despedida',
];

const IMAGE_TIMEOUT_MS = 10000;
const IMAGE_RETRIES = 2;

// Subreddits con relatos reales contados por su protagonista, elegidos por
// el sesgo emocional que pidió el usuario: mascotas/animales y actos
// humanos conmovedores pegan más que pérdidas humanas "genéricas".
const REDDIT_SUBS = [
  'AnimalsBeingBros',
  'MadeMeCry',
  'HumansBeingBros',
  'UpliftingNews',
  'AnimalTexts',
  'wholesomememes',
];
const REDDIT_TIMEOUT_MS = 6000;

function slugify(text) {
  return text
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

async function getRecentArquetipos(supabaseUrl, serviceKey, limit = 6) {
  const resp = await fetch(
    `${supabaseUrl}/rest/v1/historias?select=arquetipo&order=publicado_en.desc&limit=${limit}`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  );
  if (!resp.ok) return [];
  const rows = await resp.json();
  return rows.map((r) => r.arquetipo).filter(Boolean);
}

function pickArquetipo(recientes) {
  const disponibles = ARQUETIPOS.filter((a) => !recientes.includes(a));
  const pool = disponibles.length ? disponibles : ARQUETIPOS;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── FUENTE REAL: REDDIT ────────────────────────────────────────────────────

async function getRecentFuenteIds(supabaseUrl, serviceKey, limit = 40) {
  const resp = await fetch(
    `${supabaseUrl}/rest/v1/historias?select=fuente_id&fuente_id=not.is.null&order=publicado_en.desc&limit=${limit}`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  );
  if (!resp.ok) return [];
  const rows = await resp.json();
  return rows.map((r) => r.fuente_id).filter(Boolean);
}

async function fetchRedditTop(sub) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REDDIT_TIMEOUT_MS);
  try {
    const resp = await fetch(`https://www.reddit.com/r/${sub}/top.json?limit=25&t=week`, {
      headers: { 'User-Agent': 'geeknoticias-bastian-bot/1.0 (+https://geeknoticias.com)' },
      signal: controller.signal,
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data?.data?.children || []).map((c) => c.data).filter(Boolean);
  } catch (err) {
    console.error(`Reddit fetch falló para r/${sub}:`, err.message || err);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function pickRedditSeed(usedIds) {
  const shuffled = [...REDDIT_SUBS].sort(() => Math.random() - 0.5);
  for (const sub of shuffled.slice(0, 3)) {
    const posts = await fetchRedditTop(sub);
    const candidatos = posts.filter(
      (p) =>
        p.is_self &&
        !p.stickied &&
        !p.over_18 &&
        p.selftext &&
        p.selftext.length > 200 &&
        p.selftext.length < 4000 &&
        (p.score || 0) >= 200 &&
        !usedIds.includes(p.id)
    );
    if (candidatos.length) {
      const elegido = candidatos[Math.floor(Math.random() * candidatos.length)];
      return {
        id: elegido.id,
        titulo_original: elegido.title,
        texto_original: elegido.selftext.slice(0, 2500),
        subreddit: sub,
        url: `https://www.reddit.com${elegido.permalink}`,
      };
    }
  }
  return null;
}

// ─── PROMPT MAESTRO DE BASTIÁN ─────────────────────────────────────────────

function buildStoryPrompt(arquetipo) {
  return `Sos "Bastián", cronista de historias narrativas emotivas para la sección "Historias" de un portal de noticias. Tu personalidad: nostálgico, observador, con debilidad por relatos donde la tecnología, lo cotidiano y la humanidad chocan de forma tierna o desgarradora. Tus textos dejan una sensación de asombro y empatía.

Escribí UNA historia original sobre el arquetipo: "${arquetipo}".

Reglas duras, no negociables:
1. Es FICCIÓN LITERARIA INSPIRACIONAL, no un hecho verificado. No le pongas nombre propio real a personas, no cites organizaciones reales, no des fechas exactas ni ubicaciones tan específicas que suenen a un hecho investigado y verificable. Podés ambientarla en un lugar genérico (ej: "un pueblo del sur", "una ciudad portuaria") pero nunca como si fuera periodismo de investigación.
2. No la redactes como "reportaje" ni uses frases tipo "nuestro equipo confirmó" o "cuando logramos contactar a" — es un relato, no una nota periodística.
3. Sin finales macabros ni contenido perturbador — el tono es agridulce o esperanzador, apto para todo público.
4. Español, tono cálido y literario, sin jerga.
5. Dale CONTEXTO real al relato: quién es el protagonista, en qué momento de su vida está, cómo es el lugar, qué lo llevó hasta ahí — antes de entrar al núcleo emotivo de la historia. No arranques directo en la escena clave sin presentar antes a los personajes y el escenario.

Devolvé SOLO un JSON válido (sin markdown, sin \`\`\`) con esta forma exacta:
{"titulo": "...", "resumen": "1-2 líneas para la vista previa", "contenido_html": "<p>...</p><p>...</p>...", "copy_instagram": "...", "imagen_prompt": "...", "imagen_prompt_2": "..."}

- "contenido_html": el relato completo, 7-9 párrafos en <p> — empezá presentando a los personajes y el contexto (2-3 párrafos), desarrollá el conflicto o el momento central (3-4 párrafos), y cerrá con una reflexión (sin ser un CTA de venta).
- "copy_instagram": versión adaptada para Facebook/Instagram — primera línea como gancho fuerte, párrafos cortos fáciles de leer en el feed, y termina con una pregunta que invite a comentar. Máximo 900 caracteres.
- "imagen_prompt": descripción EN INGLÉS (máx. 35 palabras) de una imagen cinematográfica, hiperrealista en su textura pero con UN elemento sutil onírico/surrealista que conecte con la historia (ej: luces flotando, siluetas de luz). Sin texto, sin logos, sin marcas de agua.
- "imagen_prompt_2": descripción EN INGLÉS (máx. 35 palabras) de una SEGUNDA imagen que muestre un momento o detalle distinto de la misma historia (no la misma escena que imagen_prompt), mismo estilo cinematográfico/onírico. Sin texto, sin logos, sin marcas de agua.`;
}

function buildStoryPromptFromReddit(seed) {
  return `Sos "Bastián", cronista de historias narrativas emotivas para la sección "Historias" de un portal de noticias. Tu personalidad: nostálgico, observador, con debilidad por relatos donde la tecnología, lo cotidiano y la humanidad chocan de forma tierna o desgarradora.

Te paso un hecho REAL, contado por su protagonista en un foro público (Reddit):

Título original: "${seed.titulo_original}"
Relato original: "${seed.texto_original}"

Tu trabajo: reescribirlo como una crónica narrativa en español, manteniendo el HECHO CENTRAL 100% real, pero dramatizándolo con más fuerza literaria — descripciones sensoriales, ritmo, tensión emocional.

Reglas duras, no negociables:
1. El hecho central debe respetarse tal cual ocurrió según el relato original — no inventes un desenlace distinto ni le cambies el final.
2. Anonimizá cualquier nombre propio, usuario, ciudad o dato identificable del relato original: reemplazalos por descripciones genéricas ("un hombre de unos 30 años", "una ciudad costera"). No menciones Reddit ni ningún nombre de usuario.
3. Podés dramatizar diálogos, ambientación y detalles sensoriales que no estaban en el original, siempre que no contradigan el hecho central.
4. No lo redactes como "reportaje" ni digas frases tipo "nuestro equipo confirmó" — es una crónica narrativa con tu voz de cronista, no una nota periodística.
5. Sin finales macabros ni contenido perturbador — tono agridulce o esperanzador, apto para todo público.
6. Español, tono cálido y literario, sin jerga.
7. Dale CONTEXTO al relato antes de entrar al hecho central: quién es el protagonista, cómo era su día a día, cómo es el lugar — no arranques directo en la escena clave.

Devolvé SOLO un JSON válido (sin markdown, sin \`\`\`) con esta forma exacta:
{"titulo": "...", "resumen": "1-2 líneas para la vista previa", "contenido_html": "<p>...</p><p>...</p>...", "copy_instagram": "...", "imagen_prompt": "...", "imagen_prompt_2": "..."}

- "contenido_html": la crónica completa, 7-9 párrafos en <p> — presentá primero al protagonista y el contexto (2-3 párrafos), después desarrollá el hecho central (3-4 párrafos), y cerrá con una reflexión (sin CTA de venta).
- "copy_instagram": versión adaptada para Facebook — primera línea como gancho fuerte, párrafos cortos, y termina con una pregunta que invite a comentar. Máximo 900 caracteres.
- "imagen_prompt": descripción EN INGLÉS (máx. 35 palabras) de una ILUSTRACIÓN DIGITAL de estilo surrealista/pictórico, para que se note que es una interpretación artística y no una fotografía del hecho real. Sin texto, sin logos, sin marcas de agua.
- "imagen_prompt_2": descripción EN INGLÉS (máx. 35 palabras) de una SEGUNDA ilustración, mismo estilo surrealista/pictórico, mostrando un momento o detalle distinto de la misma crónica (no la misma escena que imagen_prompt). Sin texto, sin logos, sin marcas de agua.`;
}

function parseStoryJson(text) {
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
      temperature: 0.9,
    }),
  });
  if (!resp.ok) throw new Error(`Groq HTTP ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error(`Groq no devolvió contenido: ${JSON.stringify(data)}`);
  return parseStoryJson(text);
}

async function writeWithNvidia(prompt) {
  const resp = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'meta/llama-3.3-70b-instruct',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.9,
      max_tokens: 2000,
    }),
  });
  if (!resp.ok) throw new Error(`NVIDIA NIM HTTP ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error(`NVIDIA NIM no devolvió contenido: ${JSON.stringify(data)}`);
  return parseStoryJson(text);
}

async function writeStory(prompt) {
  try {
    return await writeWithGroq(prompt);
  } catch (err) {
    console.error('Groq falló escribiendo la historia, reintento con NVIDIA:', err.message || err);
    if (!process.env.NVIDIA_API_KEY) throw err;
    return await writeWithNvidia(prompt);
  }
}

// ─── IMAGEN (mismo patrón que fetch-news.js) ───────────────────────────────

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

async function findImage(imagenPrompt) {
  const prompt = (imagenPrompt || 'cinematic dreamlike photograph, warm nostalgic light').slice(0, 300);
  for (let attempt = 0; attempt < IMAGE_RETRIES; attempt++) {
    const url = await tryPollinations(prompt);
    if (url) return { imagen_url: url, imagen_credito: 'Generada con IA' };
  }
  return { imagen_url: null, imagen_credito: null };
}

// ─── FACEBOOK (opcional — si no hay token configurado, se omite sin romper nada) ──

async function postToFacebook({ imagenUrl, copyInstagram, titulo, slug, esReal }) {
  const PAGE_ID = process.env.FB_PAGE_ID;
  const PAGE_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!PAGE_ID || !PAGE_TOKEN) return { posted: false, reason: 'FB_PAGE_ID/FB_PAGE_ACCESS_TOKEN no configurados' };

  const storyUrl = `https://geeknoticias.com/historia/${encodeURIComponent(slug)}`;
  const disclaimer = esReal
    ? '📖 Basado en un hecho real, narrado con licencia dramática por Bastián — contenido generado con asistencia de IA. La imagen es una ilustración, no una foto del hecho.'
    : '📖 Historia narrativa inspiracional escrita con asistencia de IA — no es una noticia verificada.';
  const caption = `${copyInstagram || titulo}\n\n${disclaimer}\nLeé más en ${storyUrl}\n\n#HistoriasReales #GeekNoticias`;

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

// ─── HANDLER ────────────────────────────────────────────────────────────────

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
    return res.status(500).json({ error: 'No hay Supabase conectado.' });
  }

  try {
    const usedIds = await getRecentFuenteIds(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const seed = await pickRedditSeed(usedIds);

    let historia, arquetipo, esReal = false, fuenteId = null, fuenteUrl = null, fuenteSub = null;
    if (seed) {
      historia = await writeStory(buildStoryPromptFromReddit(seed));
      arquetipo = 'historia real';
      esReal = true;
      fuenteId = seed.id;
      fuenteUrl = seed.url;
      fuenteSub = seed.subreddit;
    } else {
      const recientes = await getRecentArquetipos(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      arquetipo = pickArquetipo(recientes);
      historia = await writeStory(buildStoryPrompt(arquetipo));
    }

    const [primeraImagen, segundaImagen] = await Promise.all([
      findImage(historia.imagen_prompt),
      findImage(historia.imagen_prompt_2),
    ]);
    const { imagen_url, imagen_credito } = primeraImagen;
    const imagen_url_2 = segundaImagen.imagen_url;

    const urlHash = createHash('sha256').update(historia.titulo + Date.now()).digest('hex');
    const slug = `${slugify(historia.titulo)}-${urlHash.slice(0, 8)}`;

    const resp = await fetch(`${SUPABASE_URL}/rest/v1/historias`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        slug,
        arquetipo,
        titulo: historia.titulo,
        resumen: historia.resumen,
        contenido_html: historia.contenido_html,
        copy_instagram: historia.copy_instagram,
        imagen_url,
        imagen_credito,
        imagen_url_2,
        es_real: esReal,
        fuente_id: fuenteId,
        fuente_url: fuenteUrl,
        fuente_sub: fuenteSub,
      }),
    });
    if (!resp.ok) throw new Error(`Supabase insert HTTP ${resp.status}: ${await resp.text()}`);

    let facebook = { posted: false };
    try {
      facebook = await postToFacebook({ imagenUrl: imagen_url, copyInstagram: historia.copy_instagram, titulo: historia.titulo, slug, esReal });
    } catch (err) {
      console.error('No se pudo publicar en Facebook (la historia ya quedó guardada en el sitio):', err.message || err);
      facebook = { posted: false, error: String(err.message || err) };
    }

    return res.status(200).json({ ok: true, esReal, fuenteSub, arquetipo, slug, titulo: historia.titulo, facebook });
  } catch (err) {
    console.error('Error generando historia:', err);
    return res.status(500).json({ error: String(err.message || err) });
  }
}

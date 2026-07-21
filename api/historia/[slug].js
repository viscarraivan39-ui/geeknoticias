// /api/historia/[slug].js
//
// Página server-rendered de una historia de Bastián. El aviso de que es
// contenido narrativo (no una noticia verificada) se arma acá, siempre,
// nunca depende de que el modelo lo haya incluido en el texto generado.

import { rateLimit } from '../../lib/rateLimit.js';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Inserta la segunda imagen después del párrafo del medio, para que el
// relato "respire" en vez de tener las dos imágenes juntas arriba.
function insertMidImage(contenidoHtml, imgTag) {
  if (!imgTag) return contenidoHtml;
  const cierres = [...contenidoHtml.matchAll(/<\/p>/g)];
  if (cierres.length < 2) return contenidoHtml + imgTag;
  const medio = cierres[Math.floor(cierres.length / 2) - 1];
  const pos = medio.index + medio[0].length;
  return contenidoHtml.slice(0, pos) + imgTag + contenidoHtml.slice(pos);
}

function renderPage(h) {
  const fecha = new Date(h.publicado_en).toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' });
  const canonicalUrl = `https://geeknoticias.com/historia/${encodeURIComponent(h.slug)}`;

  const aviso = h.es_real
    ? `<div class="aviso"><b>Basado en un hecho real.</b> Este relato parte de un hecho real, contado públicamente por su protagonista, y fue narrado con licencia dramática por Bastián con asistencia de IA. Nombres y detalles identificables fueron cambiados. Las imágenes son ilustraciones artísticas, no fotografías del hecho.${h.fuente_url ? ` <a href="${escapeHtml(h.fuente_url)}" target="_blank" rel="noopener noreferrer nofollow">Ver fuente original</a>.` : ''}</div>`
    : `<div class="aviso"><b>Historia inspirada en hechos reales.</b> Este es un relato narrativo/inspiracional escrito con asistencia de IA, no una noticia verificada. Los nombres, lugares y detalles son ilustrativos.</div>`;

  const imgTag2 = h.imagen_url_2 ? `<img src="${escapeHtml(h.imagen_url_2)}" alt="${escapeHtml(h.titulo)}">` : '';
  const contenidoConImagen = insertMidImage(h.contenido_html, imgTag2);

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(h.titulo)} — Historias, GeekNoticias</title>
<meta name="description" content="${escapeHtml(h.resumen)}">
<link rel="canonical" href="${canonicalUrl}">
<meta property="og:title" content="${escapeHtml(h.titulo)}">
<meta property="og:description" content="${escapeHtml(h.resumen)}">
<meta property="og:url" content="${canonicalUrl}">
${h.imagen_url ? `<meta property="og:image" content="${escapeHtml(h.imagen_url)}">` : ''}
<meta property="og:type" content="article">
<meta name="robots" content="index, follow">

<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5927579839118584"
     crossorigin="anonymous"></script>

<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&family=Playfair+Display:ital,wght@1,600&display=swap" rel="stylesheet">
<style>
  :root{
    --bg:#fdfdfd; --card-bg:#fff; --text:#292929; --text-dim:#71717a; --title:#18181b;
    --border:#e7e7e9; --accent:#7c3aed; --accent-soft:rgba(124,58,237,0.1); --footer-bg:#111111;
  }
  @media (prefers-color-scheme: dark){
    :root{
      --bg:#111111; --card-bg:#18181b; --text:#c9c9cc; --text-dim:#8b8b93; --title:#f4f4f5;
      --border:#2a2a2e; --accent:#b794f6; --accent-soft:rgba(183,148,246,0.14);
    }
  }
  *{box-sizing:border-box;}
  html{scroll-behavior:smooth;}
  body{margin:0; background:var(--bg); color:var(--text); font-family:'Inter', ui-sans-serif, system-ui, sans-serif; -webkit-font-smoothing:antialiased;}
  a{color:var(--accent); text-decoration:none;}
  img{max-width:100%; display:block; border-radius:14px; border:1px solid var(--border);}
  header{background:color-mix(in srgb, var(--bg) 85%, transparent); backdrop-filter:blur(10px); position:sticky; top:0; z-index:10; border-bottom:1px solid var(--border); padding:18px 20px;}
  header .inner{max-width:720px; margin:0 auto; display:flex; align-items:center; justify-content:space-between;}
  .logo{font-size:18px; font-weight:800; letter-spacing:-0.02em; color:var(--title);}
  .logo .dot{color:var(--accent);}
  header .inner > a:last-child{font-size:13px; font-weight:600; color:var(--text-dim);}
  main{max-width:720px; margin:0 auto; padding:36px 20px 60px;}
  .aviso{background:var(--accent-soft); border:1px solid var(--accent); border-radius:12px; padding:14px 16px; font-size:13px; color:var(--text); margin-bottom:24px; line-height:1.5;}
  .aviso b{color:var(--accent);}
  .cat{font-family:'JetBrains Mono', monospace; font-size:11.5px; font-weight:600; text-transform:uppercase; letter-spacing:.04em; background:var(--accent-soft); color:var(--accent); display:inline-block; padding:5px 12px; border-radius:6px; margin-bottom:16px;}
  h1{font-family:'Playfair Display', serif; font-style:italic; font-size:clamp(26px,4vw,38px); font-weight:600; line-height:1.2; margin:0 0 10px; color:var(--title);}
  .meta{font-size:12.5px; color:var(--text-dim); font-family:'JetBrains Mono', monospace; margin-bottom:22px;}
  .contenido{font-size:18px; line-height:1.85; color:var(--text); font-family:'Georgia', 'Playfair Display', serif;}
  .contenido p{margin:0 0 18px;}
  .contenido img{margin:8px 0 24px;}
  .credito{font-size:11px; color:var(--text-dim); margin-top:6px; font-family:'Inter', sans-serif; font-style:normal;}
  .ad-slot{margin:32px 0;}
  .firma{margin-top:36px; padding-top:20px; border-top:1px solid var(--border); font-size:13px; color:var(--text-dim); font-family:'Inter', sans-serif;}
  footer{background:var(--footer-bg); color:rgba(255,255,255,0.55); padding:30px 20px; text-align:center; font-size:12.5px;}
  footer a{color:rgba(255,255,255,0.8);}
  @media (prefers-reduced-motion: reduce){ html{scroll-behavior:auto;} }
</style>
</head>
<body>
<header><div class="inner"><a class="logo" href="/">Geek<span class="dot">Noticias</span></a><a href="/historias.html">← Todas las historias</a></div></header>
<main>
  ${aviso}
  <span class="cat">${escapeHtml(h.arquetipo)}</span>
  <h1>${escapeHtml(h.titulo)}</h1>
  <div class="meta">${escapeHtml(fecha)} · Historias</div>
  ${h.imagen_url ? `<img src="${escapeHtml(h.imagen_url)}" alt="${escapeHtml(h.titulo)}">${h.imagen_credito ? `<div class="credito">${escapeHtml(h.imagen_credito)}</div>` : ''}` : ''}
  <div class="ad-slot"><ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-5927579839118584" data-ad-format="fluid" data-ad-layout="in-article"></ins><script>(adsbygoogle = window.adsbygoogle || []).push({});</script></div>
  <div class="contenido">${contenidoConImagen}</div>
  <div class="firma">Escrito por <b>Bastián</b>, cronista de historias de GeekNoticias.</div>
</main>
<footer>© ${new Date().getFullYear()} GeekNoticias · <a href="/privacidad.html">Privacidad</a> · <a href="/terminos.html">Términos</a></footer>
</body>
</html>`;
}

export default async function handler(req, res) {
  if (!(await rateLimit(req, res))) return;

  const slug = req.query.slug;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !slug) {
    res.status(404);
    return res.send('Historia no encontrada.');
  }

  try {
    const url = new URL(`${SUPABASE_URL}/rest/v1/historias`);
    url.searchParams.set('select', '*');
    url.searchParams.set('slug', `eq.${slug}`);
    url.searchParams.set('limit', '1');

    const resp = await fetch(url, {
      headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
    });
    if (!resp.ok) throw new Error(`Supabase HTTP ${resp.status}`);
    const rows = await resp.json();
    const historia = rows[0];

    if (!historia) {
      res.status(404);
      return res.send('Historia no encontrada.');
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');
    return res.status(200).send(renderPage(historia));
  } catch (err) {
    console.error('Error cargando historia:', err);
    res.status(500);
    return res.send('Error cargando la historia.');
  }
}

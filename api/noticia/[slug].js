// /api/noticia/[slug].js
//
// Página server-rendered de UNA noticia (HTML completo, no JSON). Se sirve
// así en vez de client-side rendering para que Google/AdSense vean el
// contenido directamente en la respuesta HTTP (mejor SEO). La URL amigable
// /noticia/:slug -> esta función está definida en vercel.json (rewrites).

import { rateLimit } from '../../lib/rateLimit.js';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const CATEGORIA_LABEL = { ia: 'Inteligencia Artificial', videojuegos: 'Videojuegos', actualidad: 'Actualidad' };

function renderPage(n, related) {
  const categoriaLabel = CATEGORIA_LABEL[n.categoria] || n.categoria;
  const fecha = new Date(n.publicado_en).toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' });
  const canonicalUrl = `https://geeknoticias.com/noticia/${encodeURIComponent(n.slug)}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: n.titulo,
    description: n.resumen,
    image: n.imagen_url ? [n.imagen_url] : undefined,
    datePublished: n.publicado_en,
    dateModified: n.publicado_en,
    author: { '@type': 'Organization', name: 'GeekNoticias' },
    publisher: {
      '@type': 'Organization',
      name: 'GeekNoticias',
      logo: { '@type': 'ImageObject', url: 'https://geeknoticias.com/favicon.ico' },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
  };

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(n.titulo)} — GeekNoticias</title>
<meta name="description" content="${escapeHtml(n.resumen)}">
<link rel="canonical" href="${canonicalUrl}">
<meta property="og:title" content="${escapeHtml(n.titulo)}">
<meta property="og:description" content="${escapeHtml(n.resumen)}">
<meta property="og:url" content="${canonicalUrl}">
${n.imagen_url ? `<meta property="og:image" content="${escapeHtml(n.imagen_url)}">` : ''}
<meta property="og:type" content="article">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>

<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5927579839118584"
     crossorigin="anonymous"></script>

<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
<style>
  :root{ --ink:#171521; --paper:#FFF6E9; --paper-2:#FFE0B8; --trust:#2B5CFF; --trust-deep:#0A1F6B; --energy:#FFA800; --accent:#7C3AED; --line:rgba(23,21,33,0.14); }
  *{box-sizing:border-box;}
  body{margin:0; background:var(--paper); color:var(--ink); font-family:'Space Grotesk', sans-serif; -webkit-font-smoothing:antialiased;}
  a{color:var(--trust); text-decoration:none;}
  img{max-width:100%; display:block; border-radius:14px; border:2px solid var(--ink);}
  header{background:var(--paper); border-bottom:2px solid var(--ink); padding:16px 20px;}
  header .inner{max-width:760px; margin:0 auto; display:flex; align-items:center; justify-content:space-between;}
  .logo{font-family:'Archivo Black', sans-serif; font-size:20px;}
  .logo .dot{color:#FF2D2D;}
  main{max-width:760px; margin:0 auto; padding:32px 20px 60px;}
  .cat{font-family:'JetBrains Mono', monospace; font-size:12px; font-weight:700; background:linear-gradient(135deg, var(--energy), #FF6B00); display:inline-block; padding:5px 12px; border-radius:6px; border:1.5px solid var(--ink); margin-bottom:14px;}
  h1{font-family:'Archivo Black', sans-serif; font-size:clamp(26px,4.2vw,40px); line-height:1.08; margin:0 0 10px;}
  .meta{font-size:12.5px; opacity:.65; font-family:'JetBrains Mono', monospace; margin-bottom:20px;}
  .contenido{font-size:17px; line-height:1.7;}
  .contenido h2{font-family:'Archivo Black', sans-serif; font-size:22px; margin:32px 0 10px;}
  .contenido p{margin:0 0 16px;}
  .credito{font-size:11px; opacity:.5; margin-top:6px;}
  .ad-slot{margin:32px 0;}
  .fuente{margin-top:40px; padding-top:20px; border-top:1.5px dashed var(--line); font-size:13px; opacity:.7;}
  .relacionadas{margin-top:40px; padding-top:24px; border-top:1.5px dashed var(--line);}
  .relacionadas h3{font-family:'Archivo Black', sans-serif; font-size:16px; margin:0 0 14px;}
  .relacionadas ul{list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:10px;}
  .relacionadas a{font-weight:600; font-size:14.5px;}
  .relacionadas a:hover{text-decoration:underline;}
  footer{background:var(--trust-deep); color:var(--paper); padding:30px 20px; text-align:center; font-size:12.5px;}
  footer a{color:var(--paper); opacity:.8;}
</style>
</head>
<body>
<header><div class="inner"><a class="logo" href="/">Geek<span class="dot">Noticias</span></a><a href="/">← Todas las noticias</a></div></header>
<main>
  <span class="cat">${escapeHtml(categoriaLabel)}</span>
  <h1>${escapeHtml(n.titulo)}</h1>
  <div class="meta">${escapeHtml(fecha)}</div>
  ${n.imagen_url ? `<img src="${escapeHtml(n.imagen_url)}" alt="${escapeHtml(n.titulo)}">${n.imagen_credito ? `<div class="credito">Foto: ${escapeHtml(n.imagen_credito)} / Pexels</div>` : ''}` : ''}
  <div class="ad-slot"><ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-5927579839118584" data-ad-format="fluid" data-ad-layout="in-article"></ins><script>(adsbygoogle = window.adsbygoogle || []).push({});</script></div>
  <div class="contenido">${n.contenido_html}</div>
  ${related && related.length ? `<div class="relacionadas"><h3>Más de ${escapeHtml(categoriaLabel)}</h3><ul>${related.map((r) => `<li><a href="/noticia/${encodeURIComponent(r.slug)}">${escapeHtml(r.titulo)}</a></li>`).join('')}</ul></div>` : ''}
  ${n.fuente_nombre ? `<div class="fuente">Basado en información publicada originalmente por ${escapeHtml(n.fuente_nombre)}.</div>` : ''}
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
    return res.send('Noticia no encontrada.');
  }

  try {
    const url = new URL(`${SUPABASE_URL}/rest/v1/noticias`);
    url.searchParams.set('select', '*');
    url.searchParams.set('slug', `eq.${slug}`);
    url.searchParams.set('limit', '1');

    const resp = await fetch(url, {
      headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
    });
    if (!resp.ok) throw new Error(`Supabase HTTP ${resp.status}`);
    const rows = await resp.json();
    const noticia = rows[0];

    if (!noticia) {
      res.status(404);
      return res.send('Noticia no encontrada.');
    }

    let related = [];
    try {
      const relatedUrl = new URL(`${SUPABASE_URL}/rest/v1/noticias`);
      relatedUrl.searchParams.set('select', 'slug,titulo');
      relatedUrl.searchParams.set('categoria', `eq.${noticia.categoria}`);
      relatedUrl.searchParams.set('slug', `neq.${noticia.slug}`);
      relatedUrl.searchParams.set('order', 'publicado_en.desc');
      relatedUrl.searchParams.set('limit', '4');
      const relatedResp = await fetch(relatedUrl, {
        headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
      });
      if (relatedResp.ok) related = await relatedResp.json();
    } catch (err) {
      console.error('Error cargando relacionadas:', err);
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');
    return res.status(200).send(renderPage(noticia, related));
  } catch (err) {
    console.error('Error cargando noticia:', err);
    res.status(500);
    return res.send('Error cargando la noticia.');
  }
}

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
  html{scroll-behavior:smooth;}
  body{margin:0; background:var(--paper); color:var(--ink); font-family:'Space Grotesk', sans-serif; -webkit-font-smoothing:antialiased;}
  a{color:var(--trust); text-decoration:none;}
  img{max-width:100%; display:block; border-radius:14px; border:2px solid var(--ink);}

  @keyframes fadeUp{ from{opacity:0; transform:translateY(16px);} to{opacity:1; transform:translateY(0);} }

  header{background:rgba(255,246,233,0.88); backdrop-filter:blur(8px); position:sticky; top:0; z-index:10; border-bottom:2px solid var(--ink); padding:16px 20px;}
  header .inner{max-width:760px; margin:0 auto; display:flex; align-items:center; justify-content:space-between;}
  .logo{font-family:'Archivo Black', sans-serif; font-size:20px; transition:transform .2s ease;}
  .logo:hover{transform:rotate(-2deg) scale(1.03);}
  .logo .dot{color:#FF2D2D;}
  main{max-width:760px; margin:0 auto; padding:32px 20px 60px;}
  .cat{font-family:'JetBrains Mono', monospace; font-size:12px; font-weight:700; background:linear-gradient(135deg, var(--energy), #FF6B00); display:inline-block; padding:5px 12px; border-radius:6px; border:1.5px solid var(--ink); margin-bottom:14px; animation:fadeUp .5s ease both;}
  h1{font-family:'Archivo Black', sans-serif; font-size:clamp(26px,4.2vw,40px); line-height:1.08; margin:0 0 10px; animation:fadeUp .5s ease .05s both;}
  .meta{font-size:12.5px; opacity:.65; font-family:'JetBrains Mono', monospace; margin-bottom:20px; animation:fadeUp .5s ease .1s both;}
  main > img{animation:fadeUp .6s ease .12s both;}
  .contenido{font-size:17px; line-height:1.7; animation:fadeUp .6s ease .16s both;}
  .contenido h2{font-family:'Archivo Black', sans-serif; font-size:22px; margin:32px 0 10px;}
  .contenido p{margin:0 0 16px;}
  .credito{font-size:11px; opacity:.5; margin-top:6px;}
  .ad-slot{margin:32px 0;}
  .fuente{margin-top:40px; padding-top:20px; border-top:1.5px dashed var(--line); font-size:13px; opacity:.7;}
  .relacionadas{margin-top:40px; padding-top:24px; border-top:1.5px dashed var(--line);}
  .relacionadas h3{font-family:'Archivo Black', sans-serif; font-size:16px; margin:0 0 14px;}
  .relacionadas ul{list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:10px;}
  .relacionadas a{font-weight:600; font-size:14.5px; background-image:linear-gradient(var(--trust), var(--trust)); background-size:0% 2px; background-repeat:no-repeat; background-position:0 100%; transition:background-size .25s ease;}
  .relacionadas a:hover{background-size:100% 2px;}

  .comentarios{margin-top:40px; padding-top:24px; border-top:1.5px dashed var(--line);}
  .comentarios h3{font-family:'Archivo Black', sans-serif; font-size:16px; margin:0 0 16px;}
  .comentarios__lista{display:flex; flex-direction:column; gap:14px; margin-bottom:24px;}
  .comentario{background:#fff; border:2px solid var(--ink); border-radius:12px; padding:12px 14px; opacity:0; transform:translateY(10px); animation:fadeUp .4s ease forwards;}
  .comentario__cab{display:flex; justify-content:space-between; align-items:baseline; margin-bottom:4px;}
  .comentario__nombre{font-weight:700; font-size:13.5px;}
  .comentario__fecha{font-size:11px; opacity:.55; font-family:'JetBrains Mono', monospace;}
  .comentario__texto{font-size:14px; line-height:1.5;}
  .comentarios__vacio{font-size:13.5px; opacity:.6; margin-bottom:24px;}
  .comentarios__form{display:flex; flex-direction:column; gap:10px; background:#fff; border:2px solid var(--ink); border-radius:14px; padding:16px; box-shadow:3px 3px 0 var(--ink);}
  .comentarios__form input, .comentarios__form textarea{font-family:'Space Grotesk', sans-serif; font-size:14px; border:2px solid var(--ink); border-radius:8px; padding:10px 12px; outline:0; background:var(--paper); resize:vertical;}
  .comentarios__form input:focus, .comentarios__form textarea:focus{border-color:var(--trust);}
  .comentarios__form button{align-self:flex-start; border:2px solid var(--ink); background:var(--energy); color:var(--ink); font-weight:700; font-size:14px; padding:10px 22px; border-radius:999px; cursor:pointer; box-shadow:3px 3px 0 var(--ink); transition:transform .15s ease;}
  .comentarios__form button:hover{transform:translateY(-2px);}
  .comentarios__form button:disabled{opacity:.6; cursor:default; transform:none;}
  .comentarios__msg{font-size:13px; margin-top:2px;}

  footer{background:var(--trust-deep); color:var(--paper); padding:30px 20px; text-align:center; font-size:12.5px;}
  footer a{color:var(--paper); opacity:.8;}

  @media (prefers-reduced-motion: reduce){
    html{scroll-behavior:auto;}
    *, *::before, *::after{animation-duration:0.01ms !important; animation-iteration-count:1 !important; transition-duration:0.01ms !important;}
  }
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

  <div class="comentarios" id="comentarios">
    <h3>Comentarios</h3>
    <div class="comentarios__lista" id="comentariosLista"><div class="comentarios__vacio">Cargando comentarios…</div></div>
    <form class="comentarios__form" id="comentariosForm">
      <p style="position:absolute; left:-9999px;" aria-hidden="true"><label>Empresa: <input name="empresa" tabindex="-1" autocomplete="off"></label></p>
      <input type="text" name="nombre" placeholder="Tu nombre" maxlength="40" required>
      <textarea name="texto" placeholder="Escribí tu comentario…" rows="3" maxlength="600" required></textarea>
      <button type="submit">Comentar</button>
      <div class="comentarios__msg" id="comentariosMsg"></div>
    </form>
  </div>
</main>
<footer>© ${new Date().getFullYear()} GeekNoticias · <a href="/privacidad.html">Privacidad</a> · <a href="/terminos.html">Términos</a></footer>

<script>
(function () {
  const SLUG = ${JSON.stringify(n.slug)};
  const lista = document.getElementById('comentariosLista');
  const form = document.getElementById('comentariosForm');
  const msg = document.getElementById('comentariosMsg');

  function escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function comentarioHtml(c, i) {
    const fecha = new Date(c.creado_en).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    return '<div class="comentario" style="--i:' + i + '; animation-delay:' + (i * 60) + 'ms">' +
      '<div class="comentario__cab"><span class="comentario__nombre">' + escapeHtml(c.nombre) + '</span><span class="comentario__fecha">' + fecha + '</span></div>' +
      '<div class="comentario__texto">' + escapeHtml(c.texto) + '</div></div>';
  }

  async function cargarComentarios() {
    try {
      const resp = await fetch('/api/comentarios?slug=' + encodeURIComponent(SLUG));
      const data = await resp.json();
      const comentarios = data.comentarios || [];
      lista.innerHTML = comentarios.length
        ? comentarios.map(comentarioHtml).join('')
        : '<div class="comentarios__vacio">Sé el primero en comentar.</div>';
    } catch {
      lista.innerHTML = '<div class="comentarios__vacio">No se pudieron cargar los comentarios.</div>';
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = form.querySelector('[name="nombre"]').value;
    const texto = form.querySelector('[name="texto"]').value;
    const empresa = form.querySelector('[name="empresa"]').value;
    const btn = form.querySelector('button');
    btn.disabled = true;
    msg.textContent = '';
    try {
      const resp = await fetch('/api/comentarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: SLUG, nombre, texto, empresa }),
      });
      const data = await resp.json();
      if (resp.ok) {
        form.reset();
        await cargarComentarios();
      } else {
        msg.textContent = data.error || 'No se pudo publicar el comentario.';
      }
    } catch {
      msg.textContent = 'No se pudo publicar el comentario. Intentá de nuevo.';
    }
    btn.disabled = false;
  });

  cargarComentarios();
})();
</script>
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

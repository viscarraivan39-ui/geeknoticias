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
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">
<style>
  :root{
    --bg:#fdfdfd; --card-bg:#fff; --text:#292929; --text-dim:#71717a; --title:#18181b;
    --border:#e7e7e9; --accent:#e8590c; --accent-soft:rgba(232,89,12,0.1); --chip-bg:#f4f4f5; --footer-bg:#111111;
  }
  @media (prefers-color-scheme: dark){
    :root{
      --bg:#111111; --card-bg:#18181b; --text:#c9c9cc; --text-dim:#8b8b93; --title:#f4f4f5;
      --border:#2a2a2e; --accent:#ff7a33; --accent-soft:rgba(255,122,51,0.14); --chip-bg:#232327;
    }
  }
  *{box-sizing:border-box;}
  html{scroll-behavior:smooth;}
  body{margin:0; background:var(--bg); color:var(--text); font-family:'Inter', ui-sans-serif, system-ui, sans-serif; -webkit-font-smoothing:antialiased;}
  a{color:var(--accent); text-decoration:none;}
  img{max-width:100%; display:block; border-radius:14px; border:1px solid var(--border);}

  @keyframes fadeUp{ from{opacity:0; transform:translateY(14px);} to{opacity:1; transform:translateY(0);} }

  header{background:color-mix(in srgb, var(--bg) 85%, transparent); backdrop-filter:blur(10px); position:sticky; top:0; z-index:10; border-bottom:1px solid var(--border); padding:18px 20px;}
  header .inner{max-width:760px; margin:0 auto; display:flex; align-items:center; justify-content:space-between;}
  .logo{font-size:18px; font-weight:800; letter-spacing:-0.02em;}
  .logo .dot{color:var(--accent);}
  header .inner > a:last-child{font-size:13px; font-weight:600; color:var(--text-dim);}
  main{max-width:760px; margin:0 auto; padding:36px 20px 60px;}
  .cat{font-family:'JetBrains Mono', monospace; font-size:11.5px; font-weight:600; text-transform:uppercase; letter-spacing:.04em; background:var(--accent-soft); color:var(--accent); display:inline-block; padding:5px 12px; border-radius:6px; margin-bottom:16px; animation:fadeUp .5s ease both;}
  h1{font-size:clamp(26px,4vw,38px); font-weight:800; letter-spacing:-0.02em; line-height:1.12; margin:0 0 10px; color:var(--title); animation:fadeUp .5s ease .05s both;}
  .meta{font-size:12.5px; color:var(--text-dim); font-family:'JetBrains Mono', monospace; margin-bottom:22px; animation:fadeUp .5s ease .1s both;}
  main > img{animation:fadeUp .55s ease .12s both;}
  .contenido{font-size:17px; line-height:1.75; color:var(--text); animation:fadeUp .55s ease .16s both;}
  .contenido h2{font-size:21px; font-weight:700; letter-spacing:-0.01em; color:var(--title); margin:34px 0 10px;}
  .contenido p{margin:0 0 16px;}
  .credito{font-size:11px; color:var(--text-dim); margin-top:6px;}
  .ad-slot{margin:32px 0;}
  .fuente{margin-top:40px; padding-top:20px; border-top:1px solid var(--border); font-size:13px; color:var(--text-dim);}
  .relacionadas{margin-top:40px; padding-top:24px; border-top:1px solid var(--border);}
  .relacionadas h3{font-size:15px; font-weight:700; color:var(--title); margin:0 0 14px;}
  .relacionadas ul{list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:10px;}
  .relacionadas a{font-weight:600; font-size:14.5px; color:var(--title);}
  .relacionadas a:hover{color:var(--accent);}

  .comentarios{margin-top:40px; padding-top:24px; border-top:1px solid var(--border);}
  .comentarios h3{font-size:15px; font-weight:700; color:var(--title); margin:0 0 16px;}
  .comentarios__lista{display:flex; flex-direction:column; gap:12px; margin-bottom:24px;}
  .comentario{background:var(--card-bg); border:1px solid var(--border); border-radius:12px; padding:13px 15px; opacity:0; transform:translateY(10px); animation:fadeUp .4s ease forwards;}
  .comentario__cab{display:flex; justify-content:space-between; align-items:baseline; margin-bottom:4px;}
  .comentario__nombre{font-weight:700; font-size:13.5px; color:var(--title);}
  .comentario__fecha{font-size:11px; color:var(--text-dim); font-family:'JetBrains Mono', monospace;}
  .comentario__texto{font-size:14px; line-height:1.5; color:var(--text);}
  .comentarios__vacio{font-size:13.5px; color:var(--text-dim); margin-bottom:24px;}
  .comentarios__form{display:flex; flex-direction:column; gap:10px; background:var(--card-bg); border:1px solid var(--border); border-radius:14px; padding:16px; box-shadow:0 1px 2px rgba(0,0,0,0.04);}
  .comentarios__form input, .comentarios__form textarea{font-family:'Inter', sans-serif; font-size:14px; border:1px solid var(--border); border-radius:8px; padding:10px 12px; outline:0; background:var(--bg); color:var(--text); resize:vertical;}
  .comentarios__form input:focus, .comentarios__form textarea:focus{border-color:var(--accent);}
  .comentarios__form button{align-self:flex-start; border:0; background:var(--accent); color:#fff; font-weight:700; font-size:14px; padding:10px 22px; border-radius:999px; cursor:pointer; transition:opacity .15s ease;}
  .comentarios__form button:hover{opacity:.88;}
  .comentarios__form button:disabled{opacity:.5; cursor:default;}
  .comentarios__msg{font-size:13px; margin-top:2px; color:var(--text-dim);}

  footer{background:var(--footer-bg); color:rgba(255,255,255,0.55); padding:30px 20px; text-align:center; font-size:12.5px;}
  footer a{color:rgba(255,255,255,0.8);}

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

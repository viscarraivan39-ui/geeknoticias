// /api/sitemap.xml.js
//
// Sitemap dinámico: lista home, páginas legales y todas las noticias
// publicadas. Servido en /sitemap.xml vía rewrite en vercel.json.

const SITE = 'https://geeknoticias.com';

function escapeXml(str) {
  return String(str).replace(/&/g, '&amp;');
}

export default async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  let noticias = [];
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const url = new URL(`${SUPABASE_URL}/rest/v1/noticias`);
      url.searchParams.set('select', 'slug,publicado_en');
      url.searchParams.set('order', 'publicado_en.desc');
      url.searchParams.set('limit', '1000');

      const resp = await fetch(url, {
        headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
      });
      if (resp.ok) noticias = await resp.json();
    } catch (err) {
      console.error('Error generando sitemap:', err);
    }
  }

  const staticUrls = [
    { loc: `${SITE}/`, changefreq: 'hourly', priority: '1.0' },
    { loc: `${SITE}/privacidad.html`, changefreq: 'monthly', priority: '0.3' },
    { loc: `${SITE}/terminos.html`, changefreq: 'monthly', priority: '0.3' },
  ];

  const noticiaUrls = noticias.map((n) => ({
    loc: `${SITE}/noticia/${encodeURIComponent(n.slug)}`,
    lastmod: n.publicado_en,
    changefreq: 'weekly',
    priority: '0.8',
  }));

  const allUrls = [...staticUrls, ...noticiaUrls];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls
  .map(
    (u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    ${u.lastmod ? `<lastmod>${new Date(u.lastmod).toISOString()}</lastmod>` : ''}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).send(xml);
}

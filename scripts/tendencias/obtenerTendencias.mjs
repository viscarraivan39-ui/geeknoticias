// Trae las tendencias de búsqueda del día desde el feed RSS público y gratis
// de Google Trends (sin API key, sin librería — el paquete npm
// "google-trends-api" está roto desde que Google cambió sus endpoints
// internos, así que se usa el feed RSS directo en su lugar).
//
// Uso: node obtenerTendencias.mjs [geo] [cantidad]
//   node obtenerTendencias.mjs CL 5

const geo = process.argv[2] || "CL";
const cantidad = parseInt(process.argv[3] || "5", 10);

function extraerTag(bloque, tag) {
  const m = bloque.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : null;
}

function extraerNewsItems(bloqueItem) {
  const items = [];
  const regex = /<ht:news_item>([\s\S]*?)<\/ht:news_item>/g;
  let m;
  while ((m = regex.exec(bloqueItem))) {
    const b = m[1];
    items.push({
      titulo: extraerTag(b, "ht:news_item_title"),
      url: extraerTag(b, "ht:news_item_url"),
      fuente: extraerTag(b, "ht:news_item_source"),
    });
  }
  return items;
}

export async function obtenerTendencias(geoArg = geo, limite = cantidad) {
  const resp = await fetch(`https://trends.google.com/trending/rss?geo=${geoArg}`);
  if (!resp.ok) throw new Error(`Google Trends RSS HTTP ${resp.status}`);
  const xml = await resp.text();

  const items = [];
  const regexItem = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = regexItem.exec(xml)) && items.length < limite) {
    const bloque = m[1];
    items.push({
      tema: extraerTag(bloque, "title"),
      trafico: extraerTag(bloque, "ht:approx_traffic"),
      noticias: extraerNewsItems(bloque),
    });
  }
  return items;
}

// Si se corre directo (no importado), imprime el resultado. Comparación vía
// pathToFileURL en vez de `file://${argv[1]}` a mano — en Windows esa
// construcción manual no matchea bien contra import.meta.url.
import { pathToFileURL } from "node:url";
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const tendencias = await obtenerTendencias();
  console.log(JSON.stringify(tendencias, null, 2));
}

// /api/indicadores.js
//
// Dólar, cobre, UF, UTM y bitcoin — para el baner superior. Fuente:
// mindicador.cl (API pública del gobierno de Chile, sin key).
// Cacheado agresivo porque estos valores se actualizan una vez al día hábil.

export default async function handler(req, res) {
  try {
    const resp = await fetch('https://mindicador.cl/api');
    if (!resp.ok) throw new Error(`mindicador.cl HTTP ${resp.status}`);
    const data = await resp.json();

    const pick = (key) => {
      const item = data[key];
      if (!item) return null;
      return { valor: item.valor, fecha: item.fecha };
    };

    const indicadores = {
      dolar: pick('dolar'),
      cobre: pick('libra_cobre'),
      uf: pick('uf'),
      utm: pick('utm'),
      bitcoin: pick('bitcoin'),
    };

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=21600');
    return res.status(200).json({ indicadores });
  } catch (err) {
    console.error('Error consultando mindicador.cl:', err);
    return res.status(500).json({ error: 'No se pudieron cargar los indicadores.' });
  }
}

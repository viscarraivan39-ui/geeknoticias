# Tendencias — fuente para el newsjacking diario

Trae las tendencias de búsqueda del día en Chile (o cualquier país) desde el
feed RSS público y gratis de Google Trends. Cada tendencia viene con
noticias reales vinculadas (título, fuente, link) — no es solo una palabra
suelta, ya trae los hechos para armar el guion.

**Por qué RSS y no el paquete npm `google-trends-api`:** ese paquete está
roto — Google cambió los endpoints internos de los que dependía (probado el
31 de julio de 2026, devuelve 404/HTML en vez de JSON en todos los países
probados). El feed RSS (`trends.google.com/trending/rss?geo=XX`) sigue
funcionando y es más simple: sin librería, sin scraping frágil.

## Uso

```
node obtenerTendencias.mjs CL 5
```

O importado:

```js
import { obtenerTendencias } from './obtenerTendencias.mjs';
const tendencias = await obtenerTendencias('CL', 5);
```

## Regla editorial — no todo lo que tiende sirve

El feed trae de todo, sin filtrar: deporte, entretenimiento, pero también
temas políticos/legales sensibles (denuncias, querellas, acusaciones)
mezclados en la misma lista. Antes de convertir una tendencia en guion de
video:

- **Priorizar**: deporte, entretenimiento, tecnología — temas livianos,
  bajo riesgo, alto interés masivo.
- **Evitar o tratar con mucho cuidado**: denuncias/querellas/acusaciones
  contra personas específicas — aunque la fuente sea seria (La Tercera,
  BioBioChile, etc.), un video corto de 30-60s no tiene espacio para el
  contexto legal completo, y repetir una acusación sin ese contexto es un
  riesgo real de difamación.

## Cómo se usa hoy en el flujo de producción

Esto resuelve el paso de "conseguir temas confiables" — **no** genera el
guion automáticamente todavía. El guion de cada video sigue armándose
siguiendo la Biblia de Video (ver el skill `producir-video-geeknoticias`),
usando estos temas + noticias reales vinculadas como la base de hechos.

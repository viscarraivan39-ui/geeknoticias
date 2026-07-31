# Pipeline de video GeekNoticias

Genera videos verticales (9:16) narrados a partir de un guion estructurado
según la Biblia de Video: guion → TTS (Edge TTS) → imágenes (foto real de
Wikimedia Commons para personas/lugares reales, FLUX vía NVIDIA NIM para todo
lo demás) → ffmpeg (zoompan, subtítulos, overlays de marca) → video final.

## Requisitos

- Node.js 18+, ffmpeg/ffprobe en el PATH
- Variable de entorno `NVIDIA_API_KEY` (build.nvidia.com/settings/api-keys)

## Uso

```
npm install
NVIDIA_API_KEY=nvapi-... node build.mjs
```

El resultado queda en `assets/final.mp4`.

## Editar el guion

El array `BLOQUES` en `build.mjs` define el guion. Cada bloque puede traer:

- `tomas`: array de imágenes, una por cada momento del diálogo (recomendado).
  Cada toma es `{ personaReal: "Nombre" }` (busca foto real en Commons) o
  `{ imagenPrompt: "..." }` (genera con FLUX).
- o, si no hay `tomas`, un único `imagenPrompt`/`personaReal` para todo el bloque.

Ver el skill `producir-video-geeknoticias` para la metodología completa
(estructura de guion, reglas de qué usar cuándo, limitaciones conocidas).

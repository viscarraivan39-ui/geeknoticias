// /lib/nvidiaEmbed.js
//
// Embeddings de NVIDIA NIM (build.nvidia.com), API compatible con OpenAI.
// Se usa para detectar si el título de una noticia nueva es semánticamente
// muy parecido a uno ya publicado (dos fuentes distintas cubriendo el
// mismo hecho, que el dedup por URL no detecta porque la URL es distinta).

const EMBED_MODEL = 'nvidia/nv-embedqa-e5-v5';

export async function embedTitles(titles) {
  if (!process.env.NVIDIA_API_KEY || !titles.length) return [];

  const resp = await fetch('https://integrate.api.nvidia.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: titles,
      input_type: 'passage',
    }),
  });
  if (!resp.ok) throw new Error(`NVIDIA embeddings HTTP ${resp.status}: ${await resp.text()}`);
  const body = await resp.json();
  return body.data?.map((d) => d.embedding) ?? [];
}

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Devuelve la similitud máxima del embedding nuevo contra la lista de existentes (0 si no hay ninguno).
export function maxSimilarity(nuevoEmbedding, existentesEmbeddings) {
  if (!nuevoEmbedding || !existentesEmbeddings.length) return 0;
  return Math.max(...existentesEmbeddings.map((e) => cosineSimilarity(nuevoEmbedding, e)));
}

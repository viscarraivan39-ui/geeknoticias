// Llamada de chat a Groq / NVIDIA NIM con lista de modelos de respaldo.
// En agosto-2026 se retiraron llama-3.3-70b (Groq 404, NVIDIA 410) y los tres
// crons dejaron de publicar. Ahora cada proveedor prueba sus modelos en orden:
// si uno fue retirado o está al límite de cupo (los límites de Groq son por
// modelo), pasa al siguiente. Timeouts y 5xx se lanzan tal cual para que el
// llamador caiga al otro proveedor sin gastar el tiempo de la función.

const PROVEEDORES = {
  Groq: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    key: () => process.env.GROQ_API_KEY,
    modelos: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'llama-3.1-8b-instant'],
    json: true,
  },
  'NVIDIA NIM': {
    url: 'https://integrate.api.nvidia.com/v1/chat/completions',
    key: () => process.env.NVIDIA_API_KEY,
    modelos: ['openai/gpt-oss-20b'],
    json: false,
  },
};

const PASAR_AL_SIGUIENTE = new Set([400, 404, 410, 422, 429]);

export async function chatConRespaldo(proveedor, { prompt, temperature, maxTokens, fetchFn = fetch }) {
  const p = PROVEEDORES[proveedor];
  let ultimoError;
  for (const model of p.modelos) {
    const razona = model.startsWith('openai/gpt-oss');
    const body = {
      model,
      messages: [{ role: 'user', content: prompt }],
      // gpt-oss gasta parte de max_tokens en razonar: se deja margen extra.
      max_tokens: razona ? maxTokens + 1500 : maxTokens,
    };
    if (temperature !== undefined) body.temperature = temperature;
    if (razona) body.reasoning_effort = 'low';
    if (p.json) body.response_format = { type: 'json_object' };
    const resp = await fetchFn(p.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${p.key()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      ultimoError = new Error(`${proveedor} HTTP ${resp.status} (${model}): ${await resp.text()}`);
      if (PASAR_AL_SIGUIENTE.has(resp.status)) {
        console.error(ultimoError.message.slice(0, 300));
        continue;
      }
      throw ultimoError;
    }
    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) {
      ultimoError = new Error(`${proveedor} (${model}) no devolvió contenido: ${JSON.stringify(data).slice(0, 300)}`);
      console.error(ultimoError.message);
      continue;
    }
    return { text, finishReason: data.choices?.[0]?.finish_reason, model };
  }
  throw ultimoError;
}

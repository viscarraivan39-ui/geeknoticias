---
name: producir-video-geeknoticias
description: Genera un video narrado vertical (9:16) para GeekNoticias/AvíspateYa a partir de una noticia o tema, siguiendo la Biblia de Video (gancho/contexto/problema/giro/CTA). Usar cuando el usuario pida "haz un video de...", "arma el video sobre...", o pida iterar sobre el pipeline de video (imágenes, voz, subtítulos, overlays).
---

# Producir video GeekNoticias

Pipeline completo: guion → voz (Edge TTS) → imágenes → ffmpeg → video final
vertical 9:16, listo para TikTok/Reels/FB Shorts o YouTube Shorts.

Script real: `scripts/video-pipeline/build.mjs` (en este repo). Requiere
`NVIDIA_API_KEY` en el entorno y ffmpeg/ffprobe instalados.

El guion se pasa como argumento: `node build.mjs guiones/<archivo>.mjs`. Cada
video nuevo es un archivo nuevo en `guiones/` (exporta `id` + `bloques`), no
se edita el guion anterior. El resultado queda en
`assets/<id-del-guion>/final.mp4` — cada guion en su propia carpeta, así que
se pueden generar varios videos en lote sin que se pisen entre sí.

## 1. Estructura del guion (Biblia de Video — obligatoria, no saltarse)

1. **Gancho (0-3/7s):** cero marca, pregunta disruptiva o revelación urgente.
   Open loop: plantea la premisa fuerte, no adelanta el giro.
2. **Cuerpo**, en 3 pasos fijos:
   - **Contexto:** por qué importa el tema, rápido.
   - **Problema/Conflicto:** la controversia/fricción central.
   - **Giro/Solución:** el dato/respuesta que es el pago por haber visto el video.
3. **CTA (últimos 5-10s):** nunca genérico ("visita la web") — el beneficio
   específico de hacer clic (ej. "lee el documento filtrado"). Mostrar el CTA
   en pantalla.

Short-form (15-60s): fórmula ceñida, todo directo. Long-form (1.5-5min):
mismo gancho agresivo, cuerpo más rico con más fuentes/contexto.

**Timing de cortes:** nunca un plano estático más de 2.5-3.5s. Si un bloque
dura más de ~10s, partirlo en más `tomas` (no dejar 1-2 tomas largas).

## 2. Cómo decidir cada imagen (regla obligatoria)

Por cada "toma" (sub-plano) del guion, preguntarse: **¿el diálogo en ese
momento nombra una persona pública real, un lugar real específico, o algo
genérico?**

- **Persona/lugar real** (ej. un jugador, un presidente de federación, un
  edificio específico) → `{ personaReal: "Nombre exacto" }`. El script busca
  en Wikimedia Commons y filtra solo licencias reutilizables comercialmente
  (Public Domain, CC0, CC BY, CC BY-SA — nunca NC ni ND). Es más correcto
  editorialmente que inventar una cara con IA, y evita el filtro de FLUX.
- **Todo lo demás** (objetos, manos, ambientes, escenas simbólicas, gente sin
  rostro identificable) → `{ imagenPrompt: "..." }` en inglés, para FLUX
  (NVIDIA NIM, `black-forest-labs/flux.1-dev`).

**Las imágenes deben seguir el diálogo palabra a palabra**, no ser una sola
imagen genérica repetida para todo el bloque. Si el bloque menciona a 3
personas distintas, son 3 tomas distintas (o más), no 1.

### Limitación conocida de FLUX — no pelear contra esto, diseñar alrededor

FLUX bloquea (`CONTENT_FILTERED`) casi cualquier rostro humano realista
reconocible, incluso sin nombrar a nadie ("retrato de empresario genérico" ya
se bloqueó en pruebas). Por eso:

- Nunca usar `imagenPrompt` para representar una persona real — usar siempre
  `personaReal` para eso (foto real, no generada).
- Si un prompt de FLUX necesita mostrar personas de forma genérica (ej. una
  multitud, un tumulto), evitar primeros planos de rostro: usar siluetas,
  planos muy amplios, o enfocar en manos/objetos en vez de caras.
- El script ya tiene un prompt de respaldo (`PROMPT_RESPALDO`) que se usa
  automáticamente si FLUX bloquea algo después de reintentar — el render no
  se cae por esto, pero conviene diseñar el prompt original para no
  necesitarlo.

## 3. Voz

Edge TTS, voz `es-CL-LorenzoNeural` (masculina, español chileno), gratis, sin
API key. El script ya tiene reintentos automáticos (el WebSocket no oficial de
Edge TTS a veces corta la síntesis a mitad de camino).

El primer bloque (`gancho`) lleva 0.7s de silencio real al inicio del audio
(no solo delay de video) para que no arranque "a mitad de frase" — ver
`LEAD_IN_GANCHO` / `agregarSilencioInicial` en el script.

## 4. Capa de post-producción (aplicada siempre, ya integrada al script)

- **Crossfade** de 0.4s entre tomas de un mismo bloque (nunca corte seco) —
  `concatConCrossfade` con `xfade`. Cada toma se renderiza 0.4s más larga de
  lo que "vale" en el timeline para tener material de sobra en el solape.
- **Viñeta sutil + grano de película** (`vignette=PI/6,noise=alls=8:allf=t+u`)
  sobre cada bloque, antes de los subtítulos — rompe el look plano de imagen
  generada por IA. Sube el peso del archivo (~2x), es esperado.
- **Compresor de audio** (`acompressor`) en la voz al mezclarla con el video de
  cada bloque — la deja más pareja/frontal, no varía tanto de volumen entre
  frases.
- **Música de fondo** (`mezclarMusica`, paso final después de los overlays de
  marca): toma un `.mp3` al azar de `scripts/video-pipeline/music/`, lo mezcla
  a **-28dB fijo** (nunca tapa la voz) y lo ajusta a la duración exacta del
  video. Si la carpeta está vacía, se omite sin romper el render — **nunca
  poner música ahí sin verificar que sea de licencia libre** (mismo criterio
  que las fotos de Commons: nunca "no comercial"). Ver `music/README.md` para
  fuentes recomendadas.

## 5. Overlays de marca (fijos, no cambiar sin que el usuario lo pida)

**Sin flash de marca** — se probó un golpe visual (logo grande + banner rojo
"ÚLTIMA HORA" a los 3-4s) y no funcionó: interrumpía muy pronto y quedaba
feo. No reintroducirlo salvo pedido explícito.

- Marca de agua discreta y fija, sin franjas pesadas: logo chico
  arriba-izquierda (semi-transparente, fundido de entrada) + texto
  `geeknoticias.com` chico abajo-derecha (semi-transparente, sin caja de
  fondo). Ninguno de los dos toca la zona de subtítulos.
- Subtítulos en el tercio inferior — líneas cortas (~26 caracteres) para no
  cortarse en los bordes en 1080px de ancho.
- El banner rojo con la palabra clave del bloque (`keyword`, ej. "MUNDIAL
  2026") en el centro de pantalla al inicio de cada bloque **sí se mantiene**
  — es distinto al flash de marca que se sacó, y no generó queja.

## 5b. Duración del guion — no forzar todo a <60s

Un video de menos de un minuto para una noticia con varios ángulos reales
(un jugador, una llamada, un fallo de comité, una filtración financiera)
sale acelerado y sin desarrollo. **La duración la define la profundidad real
de la noticia, no un número fijo**: si hay 4-5 hechos distintos que contar,
el cuerpo (contexto → problema → giro) se extiende para darles espacio a
todos, aunque el video termine pasando el minuto — eso es long-form válido
según la sección 1, no un error. No recortar contenido real solo para
quedar bajo 60s.

## 5c. Prompts de imagen únicos entre videos, no solo dentro de uno

No alcanza con que las tomas de UN video sigan el diálogo (sección 2) — si
dos videos distintos son del mismo rubro (ej. dos noticias de fútbol), sus
prompts genéricos ("estadio con luces, plano amplio, confetti") pueden
generar imágenes visualmente parecidas entre sí aunque el texto del prompt
sea distinto, porque FLUX converge a composiciones similares para
descripciones genéricas del mismo tipo de escena. Al escribir `imagenPrompt`
para escenas genéricas, sumar un detalle visual específico y distinto de esa
noticia en particular (un color de uniforme, un elemento de escenario
concreto, un ángulo de cámara poco común) en vez de quedarse en la
descripción más obvia de la categoría.

## 6. Pendiente / fuera de alcance de este skill todavía

- No hay conector automático "noticia real → JSON de `BLOQUES`" — hoy ese
  guion se arma a mano siguiendo las reglas de arriba.
- No hay publicación automática a Facebook (a propósito, hasta aprobar calidad
  de forma consistente).
- No hay cola/lote para generar varios videos por corrida.
- GIFs/memes de reacción como pattern-interrupt: no implementado, evaluar
  Tenor/GIPHY API (licencia pensada para este uso) antes que "memes" sueltos
  de origen incierto.

## 7. Al terminar un render

Copiar `assets/final.mp4` a un lugar que el usuario pueda abrir fácilmente
(su carpeta de Descargas), no dejarlo solo en la carpeta del proyecto.

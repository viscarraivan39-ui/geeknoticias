// Pilot v3 — Especificación técnica GeekNoticias (vertical 9:16):
// guion (Biblia de Video) -> TTS (Edge TTS) -> imágenes (Pollinations, varias por
// bloque, cortes cada ~3s) -> zoom alternado -> subtítulos -> overlays permanentes
// (logo esquina, cintillo web, flash de marca "ÚLTIMA HORA" a los 3-4s) -> video.

import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const VOICE = "es-CL-LorenzoNeural";
const W = 1080, H = 1920; // vertical 9:16
const FPS = 30;
const FONT = "C\\:/Windows/Fonts/arialbd.ttf";
const CORTE_SEG = 3.2; // cortes de plano cada 2.5-3.5s
const LOGO_PATH = "C:\\Users\\Maxi\\Nueva carpeta\\geeknoticias\\img\\logo.png";

// Estructura "Biblia de Video GeekNoticias": Gancho -> Contexto -> Problema -> Giro/Solución -> CTA específico.
// Gancho reformulado como pregunta disruptiva (regla de apertura), sin ceder el final.
// El guion (BLOQUES) se pasa como primer argumento de CLI, apuntando a un
// archivo en guiones/. Ej: node build.mjs guiones/tech-github-models.mjs
const guionArg = process.argv[2];
if (!guionArg) {
  console.error("Uso: node build.mjs guiones/<archivo>.mjs");
  process.exit(1);
}
const guionPath = guionArg.startsWith(".") || guionArg.includes("/") ? guionArg : `./guiones/${guionArg}`;
const { id: GUION_ID, bloques: BLOQUES } = await import(new URL(guionPath, import.meta.url));

const ANGULOS = [
  "wide establishing shot",
  "close-up detail shot",
  "dramatic low angle shot",
  "over-the-shoulder shot",
  "medium shot, different framing",
  "high angle shot",
];

// Para bloques con "sinRostro: true": "close-up"/"over-the-shoulder" tienden a
// reintroducir un rostro en cuadro pese a decir "no visible face" en el prompt
// base, y FLUX vuelve a bloquear (CONTENT_FILTERED). Solo ángulos que mantienen
// distancia/anonimato.
const ANGULOS_SIN_ROSTRO = [
  "wide establishing shot, subject small in frame",
  "dramatic low angle shot, silhouette only",
  "high angle shot, distant framing",
];

const DIR = `assets/${GUION_ID}`;
if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });

async function generarAudio(bloque, intento = 0) {
  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = await tts.toStream(bloque.texto);
    const chunks = [];
    await new Promise((resolve, reject) => {
      audioStream.on("data", (c) => chunks.push(c));
      audioStream.on("end", resolve);
      audioStream.on("error", reject);
    });
    const path = `${DIR}/${bloque.id}.mp3`;
    writeFileSync(path, Buffer.concat(chunks));
    return path;
  } catch (err) {
    // El WebSocket no oficial de Edge TTS a veces se cierra antes de "turn.end"
    // (corte transitorio) — reintentar, mismo patrón que descargarImagen.
    if (intento < 4) {
      await sleep(3000 * (intento + 1));
      return generarAudio(bloque, intento + 1);
    }
    throw err;
  }
}

function createLimiter(limit) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= limit || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    fn().then(resolve, reject).finally(() => { active--; next(); });
  };
  return (fn) => new Promise((resolve, reject) => { queue.push({ fn, resolve, reject }); next(); });
}
const limitImg = createLimiter(2); // FLUX no tiene el mismo rate-limit agresivo que Pollinations gratis
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const FLUX_URL = "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-dev";
// Prompt de respaldo comprobado como seguro (no dispara CONTENT_FILTERED) para
// cuando el prompt real se bloquea repetidamente y no vale la pena tirar abajo
// todo el render por eso — mejor una imagen genérica que cero imagen.
const PROMPT_RESPALDO = "Empty stadium under dramatic lighting, photorealistic, vertical composition";

async function llamarFlux(prompt) {
  const seed = Math.floor(Math.random() * 1e9);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  const resp = await fetch(FLUX_URL, {
    method: "POST",
    signal: controller.signal,
    headers: {
      Authorization: `Bearer ${NVIDIA_API_KEY}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      cfg_scale: 3.5,
      width: 768,
      height: 1344,
      steps: 30,
      seed,
    }),
  });
  clearTimeout(timeout);
  if (resp.status === 429) throw Object.assign(new Error("429"), { retryable: true });
  if (!resp.ok) throw new Error(`FLUX HTTP ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  const art = data.artifacts?.[0];
  if (!art) throw new Error("FLUX: respuesta sin artifacts");
  if (art.finishReason && art.finishReason !== "SUCCESS") {
    throw Object.assign(new Error(`FLUX finishReason=${art.finishReason}`), {
      retryable: true,
      contentFiltered: art.finishReason === "CONTENT_FILTERED",
    });
  }
  return art.base64;
}

async function descargarImagen(prompt, path, intento = 0) {
  if (!NVIDIA_API_KEY) throw new Error("Falta NVIDIA_API_KEY en el entorno");
  try {
    const base64 = await llamarFlux(prompt);
    writeFileSync(path, Buffer.from(base64, "base64"));
    return path;
  } catch (err) {
    if (intento < 3) {
      await sleep(4000 * (intento + 1));
      return descargarImagen(prompt, path, intento + 1);
    }
    // Cualquier falla persistente (filtro de contenido, timeout de red, 5xx
    // transitorio de NVIDIA) cae al respaldo — mejor una imagen genérica que
    // tirar abajo todo el render de un video por una sola toma.
    console.log(`      ⚠ falla persistente (${err.message}), usando prompt de respaldo para ${path}`);
    try {
      const base64 = await llamarFlux(PROMPT_RESPALDO);
      writeFileSync(path, Buffer.from(base64, "base64"));
      return path;
    } catch (err2) {
      throw err; // si hasta el respaldo falla, ahí sí propagar el error original
    }
  }
}

// Licencias que permiten reuso comercial. Cualquier cosa "NC" (no comercial) o
// share-alike estricta queda afuera — este es contenido comercial.
const LICENCIAS_OK = ["public domain", "cc0", "cc by", "pdm"];

function licenciaUsable(licenseShortName) {
  // Wikimedia devuelve "CC BY 4.0", "CC BY-SA 3.0", "Public domain", etc. —
  // espacios, no guiones, y variando mayúsculas/versión.
  const l = (licenseShortName || "").toLowerCase();
  return LICENCIAS_OK.some((ok) => l.startsWith(ok)) && !l.includes("nc") && !l.includes("nd");
}

// Busca una foto real de una persona/lugar/cosa específica en Wikimedia Commons,
// filtrando solo licencias reutilizables comercialmente. Devuelve null si no
// encuentra nada usable (el llamador debe caer a FLUX en ese caso).
// Wikimedia pide un User-Agent identificable (etiqueta de la API) — sin esto
// es más fácil terminar limitado/bloqueado bajo carga.
const WM_HEADERS = { "User-Agent": "GeekNoticiasVideoPipeline/1.0 (contacto: viscarraivan39@gmail.com)" };

async function buscarFotoReal(query) {
  try {
    const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=6&format=json&srlimit=8`;
    const searchResp = await fetch(searchUrl, { headers: WM_HEADERS });
    if (!searchResp.ok) return null;
    const searchData = await searchResp.json();
    const titles = (searchData.query?.search || []).map((r) => r.title);

    for (const title of titles) {
      const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url|extmetadata|size&format=json`;
      const infoResp = await fetch(infoUrl, { headers: WM_HEADERS });
      if (!infoResp.ok) continue;
      const infoData = await infoResp.json();
      const page = Object.values(infoData.query?.pages || {})[0];
      const info = page?.imageinfo?.[0];
      if (!info) continue;
      const licencia = info.extmetadata?.LicenseShortName?.value;
      if (!licenciaUsable(licencia)) continue;
      if (info.width < 600 || info.height < 600) continue; // muy chica, descartar
      return { url: info.url, licencia, credito: info.extmetadata?.Artist?.value?.replace(/<[^>]+>/g, "") || "" };
    }
    return null;
  } catch (err) {
    // Commons caído/rate-limited/respuesta rara -> tratar como "sin resultado",
    // el llamador cae a FLUX. No vale la pena tirar abajo el render por esto.
    console.log(`      ⚠ buscarFotoReal("${query}") falló: ${err.message}`);
    return null;
  }
}

async function descargarFotoReal(query, path) {
  const foto = await buscarFotoReal(query);
  if (!foto) return null;
  const resp = await fetch(foto.url);
  if (!resp.ok) return null;
  writeFileSync(path, Buffer.from(await resp.arrayBuffer()));
  console.log(`      ✓ foto real de Commons (${foto.licencia}): ${path}`);
  return path;
}

async function duracionSegundos(path) {
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1", path,
  ]);
  return parseFloat(stdout.trim());
}

// Máximo de caracteres por línea a fontsize 44 en 1080px de ancho (portrait) con
// margen de seguridad — evita el corte en los bordes que salía con 6-7 palabras
// a fontsize 52 (ancho real de la fuente bold variaba demasiado por palabra
// como para fiarse solo del conteo de palabras).
const MAX_CHARS_LINEA = 26;

function generarSubtitulos(texto, duracion, offset = 0) {
  const palabras = texto.split(/\s+/);
  const frases = [];
  let actual = [];
  let largoActual = 0;
  for (const palabra of palabras) {
    const largoNuevo = largoActual + (actual.length ? 1 : 0) + palabra.length;
    if (actual.length && largoNuevo > MAX_CHARS_LINEA) {
      frases.push(actual.join(" "));
      actual = [palabra];
      largoActual = palabra.length;
    } else {
      actual.push(palabra);
      largoActual = largoNuevo;
    }
  }
  if (actual.length) frases.push(actual.join(" "));

  const totalPalabras = palabras.length;
  let acumulado = offset;
  return frases.map((frase) => {
    const nPalabras = frase.split(/\s+/).length;
    const dur = (nPalabras / totalPalabras) * duracion;
    const inicio = acumulado;
    acumulado += dur;
    return { texto: frase, inicio, fin: acumulado };
  });
}

// Da un respiro visual antes de que arranque el habla del primer bloque —
// sin esto, el video parte "a mitad de frase" porque audio y video arrancan en
// el mismo instante exacto. Silencio real al inicio del audio (no solo delay
// de video) para que la sincronía con subtítulos/imágenes se mantenga exacta.
const LEAD_IN_GANCHO = 0.7;

async function agregarSilencioInicial(audioPath, segundos) {
  const outPath = audioPath.replace(/\.mp3$/, "_lead.mp3");
  await run("ffmpeg", [
    "-y",
    "-f", "lavfi", "-t", segundos.toFixed(3), "-i", "anullsrc=r=24000:cl=mono",
    "-i", audioPath,
    "-filter_complex", "[0:a][1:a]concat=n=2:v=0:a=1[out]",
    "-map", "[out]",
    outPath,
  ]);
  return outPath;
}

function esc(texto) {
  return texto
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "’")
    .replace(/%/g, "\\%");
}

// Sub-plano: imagen fija + zoom in/out alternado, sin paneo (evita salirse de cuadro en vertical).
async function armarSubPlano(imagenPath, dur, index, outPath) {
  const frames = Math.max(1, Math.round(dur * FPS));
  const zoomIn = index % 2 === 0;
  const zExpr = zoomIn ? "min(zoom+0.0015,1.18)" : "if(eq(on,0),1.18,max(zoom-0.0015,1.0))";
  // d=1: sin -framerate en el input, ffmpeg entregaba la imagen a su tasa por
  // defecto (25fps) y zoompan generaba `d` frames de salida POR CADA frame de
  // entrada recibido -> explosión de frames (ej. 26 frames esperados salían 572).
  // Con -framerate FPS en el input, cada frame de entrada ya corresponde 1:1 a
  // un frame de salida, así que d=1 alcanza y el total real lo fija -frames:v.
  const zoompan = `zoompan=z='${zExpr}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=${FPS}`;

  await run("ffmpeg", [
    "-y",
    "-loop", "1", "-framerate", String(FPS), "-t", dur.toFixed(3), "-i", imagenPath,
    "-vf", `scale=${Math.round(W * 1.12)}:${Math.round(H * 1.12)},${zoompan}`,
    "-frames:v", String(frames),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-r", String(FPS),
    outPath,
  ]);
  return outPath;
}

async function concatVideoOnly(clipNames, outName, cwd) {
  const listName = `${outName}.txt`;
  writeFileSync(`${cwd}/${listName}`, clipNames.map((p) => `file '${p}'`).join("\n"));
  await run("ffmpeg", [
    "-y", "-f", "concat", "-safe", "0", "-i", listName,
    "-c", "copy", outName,
  ], { cwd });
}

const TRANS_DUR = 0.4; // duración del crossfade entre tomas de un mismo bloque

// Encadena clips con crossfade (xfade) en vez de cortes secos. Cada clip debe
// venir ya renderizado TRANS_DUR más largo de lo que realmente "vale" en el
// timeline (ver armarSubPlano/procesarBloque) — ese sobrante es el material
// que se consume durante el solape de cada transición. El resultado sale
// ligeramente más largo que la suma de duraciones "reales" (sobra ~TRANS_DUR
// al final), lo cual es seguro: el combine final con audio usa "-shortest".
async function concatConCrossfade(clipPaths, duracionesPadded, outPath) {
  if (clipPaths.length === 1) {
    await run("ffmpeg", ["-y", "-i", clipPaths[0], "-c", "copy", outPath]);
    return;
  }
  const inputs = clipPaths.flatMap((p) => ["-i", p]);
  const partes = [];
  let prevLabel = "0:v";
  let cumulative = duracionesPadded[0];
  for (let i = 1; i < clipPaths.length; i++) {
    const offset = cumulative - TRANS_DUR;
    const outLabel = i === clipPaths.length - 1 ? "vout" : `vx${i}`;
    partes.push(`[${prevLabel}][${i}:v]xfade=transition=fade:duration=${TRANS_DUR}:offset=${offset.toFixed(3)}[${outLabel}]`);
    prevLabel = outLabel;
    cumulative += duracionesPadded[i] - TRANS_DUR;
  }
  await run("ffmpeg", [
    "-y", ...inputs,
    "-filter_complex", partes.join(";"),
    "-map", "[vout]",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
    outPath,
  ]);
}

async function procesarBloque(bloque) {
  console.log(`   -> ${bloque.id}`);
  let audioPath = await generarAudio(bloque);
  const duracionHabla = await duracionSegundos(audioPath);
  console.log(`      audio: ${duracionHabla.toFixed(2)}s`);

  const leadIn = bloque.id === "gancho" ? LEAD_IN_GANCHO : 0;
  if (leadIn > 0) {
    audioPath = await agregarSilencioInicial(audioPath, leadIn);
  }
  const duracion = duracionHabla + leadIn;

  // Si el bloque trae "tomas" explícitas, esas mandan (una por sub-plano, en el
  // orden en que ocurren en el diálogo). Si no, se usa el modo viejo de una sola
  // imagen/prompt genérico repetido para todo el bloque.
  const nSubPlanos = bloque.tomas
    ? bloque.tomas.length
    : Math.min(4, Math.max(1, Math.round(duracion / CORTE_SEG)));
  const duracionesSub = Array.from({ length: nSubPlanos }, () => duracion / nSubPlanos);

  let imagenPaths;
  if (bloque.tomas) {
    imagenPaths = await Promise.all(
      bloque.tomas.map(async (toma, i) => {
        const path = `${DIR}/${bloque.id}_toma${i}.jpg`;
        if (toma.personaReal) {
          const fotoPath = await descargarFotoReal(toma.personaReal, path);
          if (fotoPath) return fotoPath;
          console.log(`      ⚠ sin foto real usable para "${toma.personaReal}", cae a FLUX`);
        }
        const angulos = toma.personaReal ? ANGULOS_SIN_ROSTRO : ANGULOS;
        const prompt = toma.imagenPrompt
          || `Photorealistic editorial photo related to: ${toma.personaReal}, no visible identifiable face, vertical composition`;
        return limitImg(() => descargarImagen(`${prompt}, ${angulos[i % angulos.length]}`, path));
      })
    );
  } else if (bloque.personaReal) {
    const fotoPath = await descargarFotoReal(bloque.personaReal, `${DIR}/${bloque.id}_real.jpg`);
    imagenPaths = fotoPath
      ? duracionesSub.map(() => fotoPath)
      : await Promise.all(duracionesSub.map((_, i) =>
          limitImg(() => descargarImagen(`${bloque.imagenPrompt}, ${ANGULOS_SIN_ROSTRO[i % ANGULOS_SIN_ROSTRO.length]}`, `${DIR}/${bloque.id}_img${i}.jpg`))
        ));
  } else {
    const angulos = bloque.sinRostro ? ANGULOS_SIN_ROSTRO : ANGULOS;
    imagenPaths = await Promise.all(
      duracionesSub.map((_, i) =>
        limitImg(() => descargarImagen(
          `${bloque.imagenPrompt}, ${angulos[i % angulos.length]}`,
          `${DIR}/${bloque.id}_img${i}.jpg`
        ))
      )
    );
  }

  // Cada toma se renderiza TRANS_DUR más larga (si hay más de una) para tener
  // material de sobra en el solape del crossfade — sin esto, xfade "come"
  // contenido real del final de cada plano y el timeline se descuadra.
  const extra = nSubPlanos > 1 ? TRANS_DUR : 0;
  const subClipPaths = [];
  const duracionesPadded = [];
  for (let i = 0; i < nSubPlanos; i++) {
    const totalDur = duracionesSub[i] + extra;
    duracionesPadded.push(totalDur);
    const outPath = `${DIR}/${bloque.id}_sub${i}.mp4`;
    await armarSubPlano(imagenPaths[i], totalDur, i, outPath);
    subClipPaths.push(outPath);
  }
  const visualName = `${bloque.id}_visual.mp4`;
  await concatConCrossfade(subClipPaths, duracionesPadded, `${DIR}/${visualName}`);

  // Subtítulos (tercio inferior, por encima del cintillo web) + palabra de ruptura.
  const subs = generarSubtitulos(bloque.texto, duracionHabla, leadIn);
  const drawtexts = subs.map((s) =>
    `drawtext=fontfile='${FONT}':text='${esc(s.texto)}':fontcolor=white:fontsize=44:borderw=4:bordercolor=black@0.85:x=(w-text_w)/2:y=h-360:enable='between(t,${s.inicio.toFixed(2)},${s.fin.toFixed(2)})'`
  );
  if (bloque.keyword) {
    drawtexts.push(
      `drawtext=fontfile='${FONT}':text='${esc(bloque.keyword)}':fontcolor=white:fontsize=80:borderw=6:bordercolor=black@0.9:box=1:boxcolor=0xE63946@0.85:boxborderw=20:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,0.2,1.6)'`
    );
  }
  // Viñeta sutil + grano de película: rompe la apariencia "plana digital" de
  // imagen generada por IA. noise=alls=8 es sutil (equivalente aproximado a
  // ~3% de opacidad de una textura de grano), t+u = ruido animado y uniforme
  // (no un patrón fijo pegado a la pantalla).
  const capaCine = "vignette=PI/6,noise=alls=8:allf=t+u";
  const withTextPath = `${DIR}/${bloque.id}_textos.mp4`;
  await run("ffmpeg", [
    "-y", "-i", `${DIR}/${visualName}`,
    "-vf", [capaCine, ...drawtexts].join(","),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
    withTextPath,
  ]);

  // Compresor de audio en la voz: la deja más compacta/frontal/enérgica en vez
  // de variar mucho de volumen entre frases.
  const finalPath = `${DIR}/${bloque.id}_clip.mp4`;
  await run("ffmpeg", [
    "-y", "-i", withTextPath, "-i", audioPath,
    "-map", "0:v", "-map", "1:a",
    "-af", "acompressor=threshold=-18dB:ratio=3:attack=5:release=50:makeup=2",
    "-c:v", "copy", "-c:a", "aac", "-b:a", "160k",
    "-shortest",
    finalPath,
  ]);
  return `${bloque.id}_clip.mp4`;
}

// Marca de agua discreta y fija — SIN el flash de "ÚLTIMA HORA" + logo grande
// que había antes (feedback: quedaba feo, interrumpía en los primeros
// segundos) y SIN la franja negra pesada abajo. Solo dos elementos chicos,
// semi-transparentes, con fundido de entrada, que no tocan la zona de
// subtítulos (subtítulos en y=h-360; la marca de agua va más abajo, en
// y=h-70, fuera de esa franja):
// - logo chico arriba-izquierda
// - texto "geeknoticias.com" chico abajo-derecha
async function aplicarOverlaysDeMarca(inputName, outName) {
  const filter = [
    `[1:v]scale=150:-1,format=rgba,colorchannelmixer=aa=0.55,fade=t=in:st=1:d=0.6:alpha=1[logosmall]`,
    `[0:v][logosmall]overlay=30:40[v1]`,
    `[v1]drawtext=fontfile='${FONT}':text='geeknoticias.com':fontcolor=white@0.55:fontsize=32:borderw=2:bordercolor=black@0.4:x=w-text_w-30:y=h-70:enable='gte(t,1)'[vout]`,
  ].join(";");

  await run("ffmpeg", [
    "-y", "-i", `${DIR}/${inputName}`,
    "-loop", "1", "-i", LOGO_PATH,
    "-filter_complex", filter,
    "-map", "[vout]", "-map", "0:a",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
    "-c:a", "copy",
    "-shortest",
    `${DIR}/${outName}`,
  ]);
}

const MUSIC_DIR = "music";

// Mezcla música de fondo de la carpeta local (si hay algo ahí) con la pista de
// voz ya mezclada: -28dB fijo para que nunca tape al locutor, recortada/loopeada
// a la duración exacta del video. Si no hay música disponible, no hace nada
// (el pipeline no depende de tener tracks — la carpeta puede estar vacía).
async function mezclarMusica(inputName, outName) {
  const candidatos = existsSync(MUSIC_DIR)
    ? readdirSync(MUSIC_DIR).filter((f) => /\.mp3$/i.test(f))
    : [];
  if (candidatos.length === 0) {
    console.log("      (sin música de fondo — carpeta music/ vacía, se omite)");
    await run("ffmpeg", ["-y", "-i", `${DIR}/${inputName}`, "-c", "copy", `${DIR}/${outName}`]);
    return;
  }
  const elegida = candidatos[Math.floor(Math.random() * candidatos.length)];
  console.log(`      música de fondo: ${elegida}`);
  await run("ffmpeg", [
    "-y",
    "-i", `${DIR}/${inputName}`,
    "-stream_loop", "-1", "-i", `${MUSIC_DIR}/${elegida}`,
    "-filter_complex",
    "[1:a]volume=-28dB[music];[0:a][music]amix=inputs=2:duration=first:dropout_transition=0[aout]",
    "-map", "0:v", "-map", "[aout]",
    "-c:v", "copy", "-c:a", "aac", "-b:a", "160k",
    `${DIR}/${outName}`,
  ]);
}

async function main() {
  console.log("1/4 — Procesando bloques (audio + sub-planos + textos)...");
  const clips = [];
  for (const bloque of BLOQUES) {
    clips.push(await procesarBloque(bloque));
  }

  console.log("2/4 — Concatenando bloques...");
  const listName = "sinmarca_list.txt";
  writeFileSync(`${DIR}/${listName}`, clips.map((p) => `file '${p}'`).join("\n"));
  await run("ffmpeg", [
    "-y", "-f", "concat", "-safe", "0", "-i", listName,
    "-c", "copy", "sinmarca.mp4",
  ], { cwd: DIR });

  console.log("3/5 — Aplicando marca de agua (logo + geeknoticias.com)...");
  await aplicarOverlaysDeMarca("sinmarca.mp4", "conmarca.mp4");

  console.log("4/5 — Mezclando música de fondo...");
  await mezclarMusica("conmarca.mp4", "final.mp4");

  const duracionTotal = await duracionSegundos(`${DIR}/final.mp4`);
  console.log(`5/5 — Video final listo en ${DIR}/final.mp4 — duración: ${duracionTotal.toFixed(1)}s (${(duracionTotal / 60).toFixed(2)} min)`);
}

main().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});

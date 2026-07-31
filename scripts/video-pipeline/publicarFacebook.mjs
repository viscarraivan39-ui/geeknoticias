// Publica un video local en la Fan Page de Facebook (Graph API /videos —
// distinto del endpoint /photos que ya usa lib/cronStory.js para imágenes).
//
// Uso: node publicarFacebook.mjs <ruta-al-video.mp4> "<descripción/caption>"
//
// Requiere FB_PAGE_ID y FB_PAGE_ACCESS_TOKEN en el entorno (mismas variables
// que ya usa lib/cronStory.js — el token necesita el permiso
// pages_manage_posts para poder publicar).

import { readFileSync } from "node:fs";

const [, , videoPath, caption] = process.argv;
if (!videoPath) {
  console.error('Uso: node publicarFacebook.mjs <ruta-al-video.mp4> "<caption>"');
  process.exit(1);
}

const PAGE_ID = process.env.FB_PAGE_ID;
const PAGE_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;
if (!PAGE_ID || !PAGE_TOKEN) {
  console.error("Faltan FB_PAGE_ID / FB_PAGE_ACCESS_TOKEN en el entorno.");
  process.exit(1);
}

const form = new FormData();
form.append("source", new Blob([readFileSync(videoPath)], { type: "video/mp4" }), "video.mp4");
form.append("description", caption || "");
form.append("access_token", PAGE_TOKEN);

console.log(`Subiendo ${videoPath} a la página ${PAGE_ID}...`);
const resp = await fetch(`https://graph-video.facebook.com/v20.0/${PAGE_ID}/videos`, {
  method: "POST",
  body: form,
});
const data = await resp.json();
if (!resp.ok) {
  console.error("ERROR de Facebook:", JSON.stringify(data, null, 2));
  process.exit(1);
}
console.log("Publicado. ID del video:", data.id);

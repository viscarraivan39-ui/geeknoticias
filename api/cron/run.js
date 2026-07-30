// /api/cron/run.js
//
// Despachador único para los 3 crons de contenido. Existía un archivo por
// cron (fetch-news.js, fetch-story.js, fetch-cronica.js) hasta que el plan
// Hobby de Vercel (límite de 12 funciones serverless por deployment) empezó
// a rechazar el deploy al agregar Crónicas. La lógica de cada uno vive ahora
// en lib/cronNews.js, lib/cronStory.js y lib/cronCronica.js como módulos
// normales (no archivos de api/), y este único endpoint elige cuál correr
// según ?job=.
//
// Uso:
//   /api/cron/run?job=news     (Vercel Cron nativo, 1x/día — ver vercel.json)
//   /api/cron/run?job=story&key=ADMIN_KEY     (cron-job.org, 3x/día)
//   /api/cron/run?job=cronica&key=ADMIN_KEY   (cron-job.org, mié./dom.)

import { runNews } from '../../lib/cronNews.js';
import { runStory } from '../../lib/cronStory.js';
import { runCronica } from '../../lib/cronCronica.js';

export default async function handler(req, res) {
  const job = req.query.job;
  if (job === 'news') return runNews(req, res);
  if (job === 'story') return runStory(req, res);
  if (job === 'cronica') return runCronica(req, res);
  return res.status(400).json({ error: 'Job desconocido. Usá ?job=news, ?job=story o ?job=cronica.' });
}

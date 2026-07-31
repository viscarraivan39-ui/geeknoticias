export const id = "deporte-kings-world-cup";

// Short-form (~30s). También todo genérico (sin nombres de jugadores
// confirmados en la fuente) -> segundo test del camino FLUX puro, con un
// tema visual totalmente distinto al de tech (cancha/estadio vs oficina).
export const bloques = [
  {
    id: "gancho",
    texto: "Argentina debutó goleando en el torneo que está revolucionando el fútbol. ¿Qué es la Kings World Cup Nations?",
    tomas: [
      { imagenPrompt: "Dramatic low angle shot of a soccer stadium at night with bright lights, no visible faces, photorealistic vertical photo" },
      { imagenPrompt: "Close-up of a soccer ball on the pitch under stadium lights, photorealistic vertical photo" },
    ],
    keyword: null,
  },
  {
    id: "contexto",
    texto: "La Kings World Cup Nations es el nuevo formato que mezcla fútbol tradicional con las reglas más dinámicas que hicieron famosa a la Kings League. Selecciones nacionales, partidos más cortos, y mucho más ritmo.",
    tomas: [
      { imagenPrompt: "Wide establishing shot of a modern soccer stadium filled with fans, dramatic lighting, no visible faces close, photorealistic vertical photo" },
      { imagenPrompt: "Scoreboard on a stadium screen showing a match in progress, photorealistic vertical photo" },
      { imagenPrompt: "Close-up of soccer cleats on green grass, dynamic motion blur, no visible faces, photorealistic vertical photo" },
    ],
    keyword: "KINGS WORLD CUP",
  },
  {
    id: "problema",
    texto: "El desafío para Argentina era claro: un formato nuevo, reglas distintas, y un rival exigente como Alemania en el debut. La presión de arrancar bien marcaba el tono de todo el torneo.",
    tomas: [
      { imagenPrompt: "Dramatic wide shot of an empty locker room before a match, tense atmosphere, no visible faces, photorealistic vertical photo" },
      { imagenPrompt: "Close-up of a tactical board with soccer formations drawn in chalk, photorealistic vertical photo" },
    ],
    keyword: "DEBUT ANTE ALEMANIA",
  },
  {
    id: "giro",
    texto: "Argentina resolvió el debut goleando desde el primer tiempo, con un nivel de juego que sorprendió incluso a los que ya seguían el torneo desde su lanzamiento. El resultado puso a la selección como una de las candidatas fuertes.",
    tomas: [
      { imagenPrompt: "Confetti falling over an empty soccer pitch after a celebration, stadium lights, photorealistic vertical photo" },
      { imagenPrompt: "Close-up of a soccer scoreboard showing a large winning margin, dramatic lighting, photorealistic vertical photo" },
    ],
    keyword: "GOLEADA",
  },
  {
    id: "cta",
    texto: "Te dejamos el resumen completo del partido y el próximo cruce de Argentina. Link en el primer comentario.",
    imagenPrompt: "Close-up of hands holding a smartphone showing a sports highlights video, blurred stadium background, photorealistic vertical photo",
    keyword: null,
  },
];

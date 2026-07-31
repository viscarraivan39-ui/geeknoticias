export const id = "entretenimiento-casa-famosos";

// Short-form (~30s). Prueba el camino de foto real en un rubro distinto a
// política/deporte -> ¿Wikimedia Commons tiene buena cobertura de figuras del
// entretenimiento latino?
export const bloques = [
  {
    id: "gancho",
    texto: "Nadie lo esperaba en la casa más famosa de México, y su misión secreta puede desequilibrar todo el juego.",
    tomas: [
      { personaReal: "Fede Vigevani" },
      { imagenPrompt: "Dramatic reality TV studio entrance with bright spotlights, no visible faces, photorealistic vertical photo" },
    ],
    keyword: null,
  },
  {
    id: "contexto",
    texto: "La Casa de los Famosos México estrenó su cuarta temporada con Galilea Montijo al mando y dieciocho habitantes confirmados, entre ellos tres sorpresas que nadie había anunciado antes del arranque.",
    tomas: [
      { personaReal: "Galilea Montijo" },
      { imagenPrompt: "Wide shot of a reality TV house living room set with modern furniture, bright colorful lighting, no visible faces, photorealistic vertical photo" },
      { imagenPrompt: "Close-up of a red velvet curtain opening on a TV studio stage, dramatic lighting, photorealistic vertical photo" },
    ],
    keyword: "ESTRENO",
  },
  {
    id: "problema",
    texto: "Entre las sorpresas, Fede Vigevani apareció como habitante de incógnito. No compite por el premio: su única misión es cumplir pedidos del público para desequilibrar el juego desde adentro, sin que los demás sepan bien qué está pasando.",
    tomas: [
      { personaReal: "Fede Vigevani" },
      { imagenPrompt: "Close-up of a smartphone screen showing a live voting poll interface, colorful graphics, photorealistic vertical photo" },
    ],
    keyword: "HABITANTE DE INCÓGNITO",
  },
  {
    id: "giro",
    texto: "Esto cambia por completo la dinámica del juego: ahora los demás habitantes no solo compiten entre ellos, compiten contra una decisión externa que el público controla en tiempo real, y que puede activarse en cualquier momento.",
    tomas: [
      { imagenPrompt: "Dramatic wide shot of a reality TV confessional room with a single chair and spotlight, photorealistic vertical photo" },
      { imagenPrompt: "Close-up of hands holding a phone with a countdown timer on screen, dim colorful lighting, photorealistic vertical photo" },
    ],
    keyword: "TODO CAMBIA",
  },
  {
    id: "cta",
    texto: "Te dejamos el resumen completo del estreno y quiénes son todos los habitantes. Link en el primer comentario.",
    imagenPrompt: "Close-up of hands holding a smartphone showing entertainment news, colorful blurred background, photorealistic vertical photo",
    keyword: null,
  },
];

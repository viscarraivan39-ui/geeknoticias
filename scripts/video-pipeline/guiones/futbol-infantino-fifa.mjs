export const id = "futbol-infantino-fifa";

export const bloques = [
  {
    id: "gancho",
    texto: "¿Puede Infantino terminar denunciado ante el Comité Olímpico? Lo que se supo esta semana lo pone contra las cuerdas.",
    tomas: [
      { personaReal: "Gianni Infantino" },
      { personaReal: "Gianni Infantino" },
    ],
    keyword: null,
  },
  {
    id: "contexto",
    texto: "La FIFA acaba de cerrar el Mundial 2026, pero para su presidente la celebración duró poco. En los días siguientes a la final, empezó a acumular denuncias, críticas y una polémica que todavía no se apaga.",
    tomas: [
      { imagenPrompt: "Empty World Cup stadium after the final match, confetti settling on the pitch under stadium lights, photorealistic vertical shot" },
      { personaReal: "Gianni Infantino" },
      { imagenPrompt: "Close-up of newspaper front pages with sports headlines on a table, dramatic lighting, no visible faces, photorealistic vertical photo" },
      { imagenPrompt: "Press photographers' cameras with flashes going off, dark background, no visible faces, photorealistic vertical photo" },
    ],
    keyword: "MUNDIAL 2026",
  },
  {
    id: "problema",
    texto: "Todo partió con una tarjeta roja. El delantero estadounidense Folarin Balogun fue expulsado durante el torneo, pero la sanción se levantó después de una llamada telefónica de Donald Trump a Infantino pidiendo revisar el caso. El cinco de julio, el comité disciplinario de la FIFA falló a favor de Balogun. La Federación Noruega de Fútbol ya anunció que presentará una denuncia formal ante la Comisión de Ética del COI por cómo se tomó esa decisión.",
    tomas: [
      { imagenPrompt: "Referee's hand holding up a red card, close-up, blurred soccer pitch in the background, no visible faces, photorealistic sports photography, vertical composition" },
      { personaReal: "Folarin Balogun" },
      { imagenPrompt: "Close-up of a hand holding a phone during a call, dark office setting, no visible face, photorealistic vertical photo" },
      { personaReal: "Donald Trump" },
      { imagenPrompt: "Wooden gavel on a desk in a formal committee room, dramatic lighting, no visible faces, photorealistic vertical photo" },
      { personaReal: "Folarin Balogun" },
      { imagenPrompt: "Close-up of a formal letter document with an official stamp, dramatic lighting, no visible faces, photorealistic vertical photo" },
      { personaReal: "Gianni Infantino" },
    ],
    keyword: "COMITÉ DE ÉTICA",
  },
  {
    id: "giro",
    texto: "Pero el dato más fuerte lo reveló el diario británico The Times: la FIFA estaría evaluando vender un porcentaje del Mundial a inversores cercanos a Trump, y Infantino pasaría a ser comisionado de esa nueva empresa a cargo del torneo. Días antes, el propio Infantino había respondido a sus críticos acusándolos de difundir odio y falsos rumores, una frase que, lejos de bajar la tensión, la subió.",
    tomas: [
      { imagenPrompt: "Close-up of a newspaper page with financial headlines, dark moody lighting, no visible faces, photorealistic vertical photo" },
      { imagenPrompt: "Stock market financial charts on a screen, dramatic blue lighting, no visible faces, photorealistic vertical photo" },
      { personaReal: "Donald Trump" },
      { personaReal: "Gianni Infantino" },
      { imagenPrompt: "Close-up of two hands shaking, dark suit sleeves, blurred stadium lights in the background, no visible faces, photorealistic editorial photograph, vertical composition" },
      { personaReal: "Gianni Infantino" },
      { imagenPrompt: "Close-up of a smartphone screen showing social media comments, dim lighting, no visible faces, photorealistic vertical photo" },
    ],
    keyword: "THE TIMES",
  },
  {
    id: "cta",
    texto: "Te dejamos el informe completo de The Times sobre el plan de privatización. Link en el primer comentario.",
    imagenPrompt: "Close-up of hands holding a smartphone showing a financial news headline, blurred stadium lights in the background, photorealistic vertical photo",
    keyword: null,
  },
];

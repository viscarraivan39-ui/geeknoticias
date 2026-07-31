export const id = "tech-github-models";

// Short-form (~30-35s). Sin personas reales -> todo el guion prueba el
// camino genérico de FLUX (oficina/código), sin pasar por Wikimedia Commons.
export const bloques = [
  {
    id: "gancho",
    texto: "¿Usabas GitHub para probar modelos de inteligencia artificial gratis? Se terminó, y muchos ni se enteraron.",
    tomas: [
      { imagenPrompt: "Close-up of hands typing on a laptop keyboard with code on screen, dark room, blue glow, no visible face, photorealistic vertical photo" },
      { imagenPrompt: "Laptop screen showing lines of code with a red error notification, dramatic lighting, no visible face, photorealistic vertical photo" },
    ],
    keyword: null,
  },
  {
    id: "contexto",
    texto: "GitHub Models era el servicio que dejaba probar modelos de IA directo desde la plataforma, sin pagar ni salir del entorno de trabajo. Miles de desarrolladores lo usaban para experimentar antes de decidir qué modelo integrar en sus proyectos.",
    tomas: [
      { imagenPrompt: "Wide shot of a modern software office with multiple monitors showing code, no visible faces, photorealistic vertical photo" },
      { imagenPrompt: "Close-up of a computer screen with a dashboard showing multiple AI model icons, blue interface, photorealistic vertical photo" },
      { imagenPrompt: "Hands typing on a mechanical keyboard, close-up, dim lighting, no visible face, photorealistic vertical photo" },
    ],
    keyword: "GITHUB MODELS",
  },
  {
    id: "problema",
    texto: "Microsoft confirmó que el servicio se retira por completo el 30 de julio. Sin aviso masivo, sin alternativa integrada, sin plan de transición claro para quienes lo tenían metido en su flujo diario de trabajo.",
    tomas: [
      { imagenPrompt: "Close-up of a shutdown notice message on a dark computer screen, red warning icon, no visible face, photorealistic vertical photo" },
      { imagenPrompt: "Empty office desk with a closed laptop, dim lighting, moody atmosphere, no visible faces, photorealistic vertical photo" },
      { imagenPrompt: "Hand scrolling through a phone showing a tech news headline, blurred background, photorealistic vertical photo" },
    ],
    keyword: "SE RETIRA HOY",
  },
  {
    id: "giro",
    texto: "La buena noticia: no hace falta pagar para seguir probando modelos de IA. NVIDIA NIM y Groq siguen ofreciendo acceso gratuito a decenas de modelos de primer nivel, con límites generosos y sin tarjeta de crédito.",
    tomas: [
      { imagenPrompt: "Close-up of a computer screen showing a green checkmark and API key interface, photorealistic vertical photo" },
      { imagenPrompt: "Server room with glowing blue lights, wide shot, no visible faces, photorealistic vertical photo" },
    ],
    keyword: "ALTERNATIVAS GRATIS",
  },
  {
    id: "cta",
    texto: "Te dejamos la comparativa completa de alternativas gratuitas. Link en el primer comentario.",
    imagenPrompt: "Close-up of hands holding a smartphone showing a comparison chart, blurred office background, photorealistic vertical photo",
    keyword: null,
  },
];

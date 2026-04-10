import { NextResponse } from "next/server";

// Script templates based on proven patterns from top-performing content
const SCRIPT_TEMPLATES = {
  HOOK_PREGUNTA: {
    name: "Hook con Pregunta",
    structure: [
      { part: "HOOK", duration: "0-3s", instruction: "Pregunta provocadora que genera curiosidad" },
      { part: "PROBLEMA", duration: "3-8s", instruction: "Describe el dolor/problema que vive la audiencia" },
      { part: "REVELACION", duration: "8-20s", instruction: "Revela la causa real (algo que no esperan)" },
      { part: "SOLUCION", duration: "20-35s", instruction: "Explica el principio o metodo de sanacion" },
      { part: "PRUEBA", duration: "35-45s", instruction: "Dato, testimonio o explicacion cientifica" },
      { part: "CTA", duration: "45-60s", instruction: "Invitacion a actuar (comentar, guardar, seguir, link)" },
    ],
  },
  HOOK_AFIRMACION: {
    name: "Hook con Afirmacion Fuerte",
    structure: [
      { part: "HOOK", duration: "0-3s", instruction: "Afirmacion bold que detiene el scroll" },
      { part: "CONTEXTO", duration: "3-10s", instruction: "Por que la mayoria no sabe esto" },
      { part: "EXPLICACION", duration: "10-30s", instruction: "Desarrollo del tema con ejemplos claros" },
      { part: "TRANSFORMACION", duration: "30-45s", instruction: "Que cambia cuando aplicas esto" },
      { part: "CTA", duration: "45-60s", instruction: "Llamado a la accion" },
    ],
  },
  HOOK_HISTORIA: {
    name: "Hook con Historia/Caso",
    structure: [
      { part: "HOOK", duration: "0-3s", instruction: "Inicio de historia que genera empatia" },
      { part: "SITUACION", duration: "3-12s", instruction: "Contexto de la persona/caso" },
      { part: "CONFLICTO", duration: "12-25s", instruction: "El punto de quiebre o descubrimiento" },
      { part: "RESOLUCION", duration: "25-40s", instruction: "Como se resolvio/que aprendio" },
      { part: "LECCION", duration: "40-50s", instruction: "Leccion aplicable para el espectador" },
      { part: "CTA", duration: "50-60s", instruction: "Invitacion a transformar su propia vida" },
    ],
  },
  HOOK_LISTA: {
    name: "Hook con Lista/Pasos",
    structure: [
      { part: "HOOK", duration: "0-3s", instruction: "Numero + promesa (ej: 3 cosas que...)" },
      { part: "PUNTO 1", duration: "3-15s", instruction: "Primer punto con ejemplo" },
      { part: "PUNTO 2", duration: "15-30s", instruction: "Segundo punto con ejemplo" },
      { part: "PUNTO 3", duration: "30-45s", instruction: "Tercer punto (el mas impactante)" },
      { part: "RESUMEN", duration: "45-55s", instruction: "Conclusion que une los puntos" },
      { part: "CTA", duration: "55-60s", instruction: "Llamado a actuar" },
    ],
  },
};

export async function POST(req: Request) {
  try {
    const { topPosts, theme, templateType } = await req.json();

    const template = SCRIPT_TEMPLATES[templateType as keyof typeof SCRIPT_TEMPLATES] || SCRIPT_TEMPLATES.HOOK_PREGUNTA;

    // Analyze top posts to extract patterns
    const hooks = topPosts?.map((p: any) => p.hook).filter(Boolean) || [];
    const themes = topPosts?.map((p: any) => p.theme).filter(Boolean) || [];
    const avgSaves = topPosts?.reduce((s: number, p: any) => s + (p.saves || 0), 0) / (topPosts?.length || 1);

    // Generate 3 script variations
    const scripts = [];
    for (let i = 0; i < 3; i++) {
      const script = {
        variation: i + 1,
        templateName: template.name,
        theme: theme || "SANACION",
        totalDuration: "45-60 segundos",
        sections: template.structure.map((section) => ({
          ...section,
          suggestedContent: `[Escribe tu contenido para: ${section.instruction}]`,
        })),
        inspirationHooks: hooks.slice(0, 5),
        tips: [
          "Los primeros 3 segundos determinan si ven el video o no",
          "Habla directo a camara, con conviccion",
          "Usa subtitulos - 80% ve sin sonido",
          `Tus posts con mas saves (${Math.round(avgSaves)} promedio) hablan de: ${[...new Set(themes)].join(", ")}`,
          "Termina siempre con CTA claro: 'Guarda este video', 'Comenta SANAR', 'Link en bio'",
        ],
      };
      scripts.push(script);
    }

    return NextResponse.json({
      scripts,
      templates: Object.entries(SCRIPT_TEMPLATES).map(([id, t]) => ({
        id,
        name: t.name,
        sections: t.structure.length,
      })),
      patternAnalysis: {
        topHooks: hooks.slice(0, 5),
        bestThemes: [...new Set(themes)],
        avgSavesTopPosts: Math.round(avgSaves),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

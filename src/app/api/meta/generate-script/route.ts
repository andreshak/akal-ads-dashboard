import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

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
    const { topPosts, theme, templateType, cta, funnel } = await req.json();

    // CTA segun objetivo elegido
    const CTA_TEXTS: Record<string, string> = {
      LEADS: "Comenta la palabra SANAR y te envio toda la informacion gratis por mensaje. Guarda este video para no perderlo.",
      VENTA: "El link de mi programa esta en la bio. Si quieres transformar esto de verdad, este es tu momento — cupos limitados.",
      TRAFICO: "Toda la informacion completa esta en el link de mi bio. Entra ahora y empieza tu proceso.",
      MENSAJES: "Escribeme la palabra QUIERO por mensaje directo y te ayudo personalmente con tu caso.",
      ENGAGEMENT: "Guarda este video y compartelo con alguien que lo necesite. Sigueme para mas contenido como este.",
      AWARENESS: "Sigueme para seguir aprendiendo como sanar de forma natural. Comenta que tema quieres que profundice.",
    };
    const ctaText = CTA_TEXTS[cta as string] || CTA_TEXTS.LEADS;

    // Guia de tono segun etapa de funnel
    const FUNNEL_GUIDE: Record<string, string> = {
      TOFU: "ETAPA TOFU: no vendas nada. Solo educa, sorprende y genera curiosidad. El objetivo es que te descubran.",
      MOFU: "ETAPA MOFU: muestra tu metodo y autoridad. Audiencia ya te conoce — genera confianza con resultados.",
      BOFU: "ETAPA BOFU: aqui SI vendes. Audiencia caliente lista para comprar. Se directo con la oferta.",
      RMK: "ETAPA RMK: recupera al que no compro. Resuelve la objecion principal y crea urgencia.",
    };
    const funnelGuide = FUNNEL_GUIDE[funnel as string] || FUNNEL_GUIDE.TOFU;

    const template = SCRIPT_TEMPLATES[templateType as keyof typeof SCRIPT_TEMPLATES] || SCRIPT_TEMPLATES.HOOK_PREGUNTA;

    // Analyze top posts to extract patterns
    const hooks = topPosts?.map((p: any) => p.hook).filter(Boolean) || [];
    const themes = topPosts?.map((p: any) => p.theme).filter(Boolean) || [];
    const avgSaves = topPosts?.reduce((s: number, p: any) => s + (p.saves || 0), 0) / (topPosts?.length || 1);

    // Pull REAL transcriptions of top viral videos (the actual spoken script that worked)
    let transcriptions: any[] = [];
    try {
      let q = supabase
        .from("ig_content")
        .select("hook, transcription, saves, shares, theme, permalink")
        .not("transcription", "is", null)
        .order("saves", { ascending: false })
        .limit(20);
      if (theme && theme !== "ALL") q = q.eq("theme", theme);
      const { data } = await q;
      const mapRow = (p: any) => ({
        hook: p.hook,
        saves: p.saves,
        shares: p.shares,
        theme: p.theme,
        permalink: p.permalink,
        spokenHook: p.transcription.split(/[.!?]\s/)[0]?.substring(0, 150),
        fullScript: p.transcription.substring(0, 1200),
      });
      transcriptions = (data || [])
        .filter((p: any) => p.transcription && p.transcription.length > 60)
        .map(mapRow);
      // Si el tema tiene pocas, completa con top virales de cualquier tema
      if (transcriptions.length < 15 && theme && theme !== "ALL") {
        const have = new Set(transcriptions.map((t: any) => t.permalink));
        const { data: extra } = await supabase
          .from("ig_content")
          .select("hook, transcription, saves, shares, theme, permalink")
          .not("transcription", "is", null)
          .order("saves", { ascending: false })
          .limit(30);
        for (const p of extra || []) {
          if (transcriptions.length >= 18) break;
          if (p.transcription && p.transcription.length > 60 && !have.has(p.permalink)) {
            transcriptions.push(mapRow(p));
          }
        }
      }
    } catch {}

    // Testimonios reales de alumnos (para la seccion PRUEBA)
    let testimonios: string[] = [];
    try {
      const { data: tData } = await supabase
        .from("testimonios")
        .select("transcription, title")
        .not("transcription", "is", null)
        .limit(30);
      testimonios = (tData || [])
        .filter((x: any) => x.transcription && x.transcription.length > 40)
        .map((x: any) => {
          const txt = x.transcription.replace(/\s+/g, " ").trim();
          // Primeras 2-3 frases del testimonio
          return txt.split(/(?<=[.!?])\s/).slice(0, 3).join(" ").substring(0, 320);
        });
    } catch {}
    const pickTestimonio = (i: number) =>
      testimonios.length ? testimonios[i % testimonios.length] : null;

    // Generate 3 script variations
    // Segmenta una transcripcion real en las secciones de la estructura (por peso de duracion)
    const parseSecs = (d: string) => {
      const m = (d || "").match(/(\d+)-(\d+)/);
      return m ? parseInt(m[2]) - parseInt(m[1]) : 10;
    };
    const segmentInto = (fullText: string, sections: any[]) => {
      const sentences = (fullText || "")
        .replace(/\s+/g, " ")
        .split(/(?<=[.!?])\s+/)
        .filter((s) => s.trim().length > 2);
      if (sentences.length === 0) return null;
      const weights = sections.map((s) => parseSecs(s.duration));
      const totalW = weights.reduce((a, b) => a + b, 0);
      const out: string[] = [];
      let idx = 0;
      sections.forEach((_, si) => {
        const take = si === sections.length - 1
          ? sentences.length - idx
          : Math.max(1, Math.round((weights[si] / totalW) * sentences.length));
        out.push(sentences.slice(idx, idx + take).join(" ").trim() || "...");
        idx += take;
      });
      return out;
    };

    const scripts: any[] = [];

    // 1) Guiones REALES: top transcripciones del tema segmentadas en la estructura
    for (const t of transcriptions.slice(0, 15)) {
      const segs = segmentInto(t.fullScript, template.structure);
      if (!segs) continue;
      scripts.push({
        variation: scripts.length + 1,
        templateName: template.name,
        theme: t.theme || theme || "GENERAL",
        totalDuration: "45-60 segundos",
        isReal: true,
        sourceMetrics: `💾 ${t.saves} saves · 🔄 ${t.shares} shares`,
        sourceLink: t.permalink,
        cta, funnel,
        hasTestimonio: !!pickTestimonio(scripts.length),
        sections: template.structure.map((section: any, si: number) => ({
          ...section,
          // CTA = cierre elegido; PRUEBA = testimonio real de alumno si hay
          suggestedContent:
            section.part === "CTA" ? ctaText
            : section.part === "PRUEBA" && pickTestimonio(scripts.length)
            ? `[TESTIMONIO ALUMNO]: "${pickTestimonio(scripts.length)}"`
            : (segs[si] || ""),
        })),
        tips: [
          funnelGuide,
          `Este guion REAL genero ${t.saves} saves. Adaptalo con tu voz, no lo copies literal.`,
          "Los primeros 3 segundos definen si ven el video — manten el hook tal cual funciono.",
          `Cierre ajustado para ${cta || "LEADS"}: cambialo si necesitas otra accion.`,
        ],
      });
    }

    // 2) Si faltan, completa con plantilla guiada usando hooks reales como inspiracion
    while (scripts.length < 15) {
      const exampleHook = transcriptions[scripts.length]?.spokenHook
        || hooks[scripts.length]
        || "Escribe un hook que detenga el scroll en 3 segundos";
      scripts.push({
        variation: scripts.length + 1,
        templateName: template.name,
        theme: theme || "SANACION",
        totalDuration: "45-60 segundos",
        isReal: false,
        cta, funnel,
        sections: template.structure.map((section: any) => ({
          ...section,
          suggestedContent: section.part === "HOOK"
            ? `Ej: "${exampleHook}"`
            : section.part === "CTA"
            ? ctaText
            : section.part === "PRUEBA" && pickTestimonio(scripts.length)
            ? `[TESTIMONIO ALUMNO]: "${pickTestimonio(scripts.length)}"`
            : `[${section.instruction}]`,
        })),
        tips: [
          "Plantilla guiada — completa cada seccion con tu contenido.",
          `Hooks que funcionan en tu cuenta: ${hooks.slice(0, 3).map((h: string) => `"${h}"`).join(" · ")}`,
          `Tus posts top hablan de: ${[...new Set(themes)].slice(0, 5).join(", ")}`,
          "Termina con CTA claro: 'Guarda esto', 'Comenta SANAR', 'Link en bio'.",
        ],
      });
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
      // Real spoken scripts from your top viral videos (transcribed with AI)
      realTranscriptions: transcriptions,
      hasTranscriptions: transcriptions.length > 0,
      testimoniosCount: testimonios.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

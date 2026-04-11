import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Proven viral formulas adapted to health/wellness niche
const VIRAL_FORMULAS = {
  REVELACION_SECRETA: {
    name: "Revelacion Secreta",
    structure: "Lo que nadie te dice sobre [TEMA]",
    examples: [
      "Lo que nadie te dice sobre la inflamación crónica",
      "El secreto que los médicos no te cuentan sobre el cáncer",
      "La verdad oculta detrás de tu enfermedad",
    ],
  },
  LISTA_NUMERADA: {
    name: "Lista Numerada",
    structure: "[NUMERO] razones/señales/errores de [TEMA]",
    examples: [
      "3 señales de que tu cuerpo está inflamado",
      "5 errores que agravan tu enfermedad autoinmune",
      "7 alimentos que están matando tu sistema inmune",
    ],
  },
  PREGUNTA_IDENTIFICACION: {
    name: "Pregunta de Identificacion",
    structure: "¿Sufres de [SINTOMA]? Este video es para ti",
    examples: [
      "¿Despiertas cansado todos los dias? Esto es por qué",
      "¿Sientes que nada te sana? Aqui la razón",
      "¿Tomas 3+ medicamentos al dia? Debes ver esto",
    ],
  },
  CONTRADICCION: {
    name: "Contradiccion de Creencia",
    structure: "[CREENCIA COMUN] está mal. La realidad es [VERDAD]",
    examples: [
      "El dolor crónico NO es genético. Es emocional",
      "No necesitas más pastillas, necesitas entender tu cuerpo",
      "El cáncer no se hereda, se activa por el estrés",
    ],
  },
  ANTES_DESPUES: {
    name: "Transformacion",
    structure: "Asi cambió [PERSONA/PARTE DEL CUERPO] despues de [ACCION]",
    examples: [
      "Así cambió mi inflamación después de 30 días de agua de mar",
      "De 5 pastillas diarias a cero: mi transformación",
      "Cómo sané mi migraña cronica sin medicamentos",
    ],
  },
  METAFORA_CORPORAL: {
    name: "Metafora Corporal",
    structure: "Tu cuerpo es como [METAFORA]. Por eso [EXPLICACION]",
    examples: [
      "Tu cuerpo es como una batería: si no lo cargas bien, colapsa",
      "La inflamación es fuego silencioso dentro de ti",
      "Tus emociones son señales que tu cuerpo convierte en enfermedad",
    ],
  },
  ERROR_COMUN: {
    name: "Error Comun",
    structure: "Deja de [ACCION COMUN]. Esto es lo que debes hacer",
    examples: [
      "Deja de tomar agua con limón en ayunas. Esto es mejor",
      "Deja de buscar la pastilla mágica. La sanación empieza aquí",
      "Deja de ignorar tus emociones. Tu cuerpo las está guardando",
    ],
  },
  URGENCIA: {
    name: "Urgencia",
    structure: "Si [CONDICION], debes ver este video AHORA",
    examples: [
      "Si tomas antiinflamatorios regularmente, DEBES ver esto",
      "Si tienes fibromialgia, este video puede cambiar tu vida",
      "Antes de que sea tarde: lo que nadie te dijo sobre el cancer",
    ],
  },
};

function generateIdeas(topTheme: string, topHooks: string[], winningWords: string[]) {
  const ideas: any[] = [];

  Object.entries(VIRAL_FORMULAS).forEach(([id, formula]) => {
    // Generate theme-specific ideas
    const themeVariations: Record<string, string[]> = {
      CANCER: [
        "Las 3 verdades sobre el cancer que tu oncologo no te dice",
        "¿Por que algunos sanan el cancer y otros no? El factor clave",
        "El error que comete el 90% de pacientes con cancer",
      ],
      INFLAMACION: [
        "5 señales de que tu cuerpo esta inflamado (sin que lo sepas)",
        "Como bajar la inflamacion sin medicamentos en 30 dias",
        "La inflamacion cronica es una emocion atrapada en tu cuerpo",
      ],
      ESTRES: [
        "El estres no es mental, es quimico. Como detenerlo",
        "¿Por que el estres te esta matando lentamente?",
        "3 tecnicas para salir del modo supervivencia de tu cuerpo",
      ],
      EMOCIONAL: [
        "Como tus emociones estan creando tu enfermedad",
        "La culpa que cargas se convierte en dolor fisico",
        "Sanar empieza cuando dejas de mendigar amor",
      ],
      ALIMENTACION: [
        "Deja de contar calorias. Esto es lo que de verdad importa",
        "5 alimentos que parecen sanos pero te estan inflamando",
        "¿Sabias que comer mas puede sanar tu metabolismo?",
      ],
      MENTE: [
        "Tus pensamientos crean tu biologia. Asi funciona",
        "El dialogo interno que te esta enfermando",
        "Cambia esta frase y cambias tu salud",
      ],
      RESPIRACION: [
        "Respirar bien podria reemplazar muchos medicamentos",
        "3 tecnicas de respiracion para calmar el sistema nervioso",
        "Tu respiracion es la medicina gratis que no usas",
      ],
    };

    const themeIdeas = themeVariations[topTheme] || themeVariations.EMOCIONAL;
    ideas.push({
      formulaId: id,
      formulaName: formula.name,
      structure: formula.structure,
      hookIdeas: [...themeIdeas.slice(0, 2), ...formula.examples.slice(0, 1)],
      scriptOutline: [
        `HOOK (0-3s): ${formula.examples[0]}`,
        "PROBLEMA (3-10s): Describe el dolor/confusion que vive el viewer",
        "REVELACION (10-25s): Explica la causa real (algo contraintuitivo)",
        "SOLUCION (25-45s): Da 1-3 pasos concretos",
        "CTA (45-60s): 'Guarda este video y comenta SANAR si quieres saber mas'",
      ],
      estimatedEngagement: "Alta potencial - formato probado en el nicho",
    });
  });

  return ideas;
}

export async function POST(req: Request) {
  try {
    const { theme, count = 5 } = await req.json().catch(() => ({}));

    // Get top posts from the selected theme (or all)
    let query = supabase.from("ig_content").select("hook, saves, shares, theme, caption, published_at").order("saves", { ascending: false }).limit(50);
    if (theme && theme !== "ALL") query = query.eq("theme", theme);
    const { data: topPosts } = await query;

    const hooks = (topPosts || []).map((p: any) => p.hook).filter(Boolean);

    // Extract winning words (used in top posts)
    const words: Record<string, number> = {};
    const stopWords = new Set(["para", "como", "cuando", "donde", "este", "esta", "todo", "nada", "pero", "porque", "hacer", "puede", "mucho", "poco", "estar", "tener"]);
    hooks.forEach((h: string) => {
      (h || "").toLowerCase().replace(/[^\wáéíóúñ\s]/g, " ").split(/\s+/).forEach((w: string) => {
        if (w.length >= 5 && !stopWords.has(w)) words[w] = (words[w] || 0) + 1;
      });
    });
    const winningWords = Object.entries(words).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([w]) => w);

    // Generate ideas
    const ideas = generateIdeas(theme || "EMOCIONAL", hooks, winningWords);

    return NextResponse.json({
      theme: theme || "ALL",
      topPostsAnalyzed: topPosts?.length || 0,
      winningWords,
      sampleTopHooks: hooks.slice(0, 5),
      ideas,
      guidelines: [
        "Los primeros 3 segundos determinan si ven el video o no",
        "Usa subtitulos siempre (80% ve sin sonido)",
        "Habla directo a camara con conviccion",
        "Termina con CTA claro que genere interaccion",
        "Posts con mas saves tienden a ser los que venden mejor en ads",
      ],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

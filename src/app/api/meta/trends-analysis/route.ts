import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Extract hook patterns from top content
function classifyHookType(hook: string): string {
  const lower = (hook || "").toLowerCase();
  if (lower.match(/^(¿|\?)/) || lower.includes("?")) return "PREGUNTA";
  if (lower.match(/^\d/) || lower.match(/^(tres|cuatro|cinco|tre|\d)/)) return "LISTA_NUMERADA";
  if (lower.includes("comenta") || lower.includes("escribe") || lower.includes("etiqueta")) return "CTA_DIRECTO";
  if (lower.startsWith("así") || lower.startsWith("esto") || lower.startsWith("este") || lower.startsWith("esta")) return "AFIRMACION_DEMOSTRATIVA";
  if (lower.includes("nunca") || lower.includes("siempre") || lower.includes("jamás") || lower.includes("todo")) return "AFIRMACION_ABSOLUTA";
  if (lower.includes("secreto") || lower.includes("verdad") || lower.includes("nadie te") || lower.includes("no te dicen")) return "REVELACION";
  if (lower.includes("cómo") || lower.includes("como ")) return "COMO_HACER";
  if (lower.includes("si ") && lower.includes("este video")) return "CONDICIONAL_PROBLEMA";
  if (lower.includes("dejar") || lower.includes("deja de")) return "IMPERATIVO_PARAR";
  if (lower.includes("puedes") || lower.includes("puedo")) return "POSIBILIDAD";
  return "OTROS";
}

function extractWordFrequency(hooks: string[], minLength: number = 4): Array<{word: string; count: number}> {
  const stopWords = new Set(["para", "tener", "tenia", "estar", "estoy", "puede", "sido", "desde", "esto", "este", "esta", "estos", "estas", "como", "cuando", "donde", "porque", "pero", "mucho", "poco", "hacer", "tiene", "tenga", "todos", "todas", "cada", "entre", "sobre", "hasta", "sino", "otro", "otra", "otros", "otras", "quien", "tambien", "muchas", "también"]);
  const freq: Record<string, number> = {};
  hooks.forEach(h => {
    const words = (h || "").toLowerCase().replace(/[^\wáéíóúñ\s]/g, " ").split(/\s+/);
    words.forEach(w => {
      if (w.length >= minLength && !stopWords.has(w)) {
        freq[w] = (freq[w] || 0) + 1;
      }
    });
  });
  return Object.entries(freq).map(([word, count]) => ({ word, count })).sort((a, b) => b.count - a.count).slice(0, 20);
}

export async function GET() {
  try {
    // Get top 100 posts by saves
    const { data: topPosts } = await supabase
      .from("ig_content")
      .select("*")
      .order("saves", { ascending: false })
      .limit(100);

    // Get top 50 by shares (viral)
    const { data: topShares } = await supabase
      .from("ig_content")
      .select("*")
      .order("shares", { ascending: false })
      .limit(50);

    // Get top 30 by reach (mass)
    const { data: topReach } = await supabase
      .from("ig_content")
      .select("*")
      .order("reach", { ascending: false })
      .limit(30);

    // Get all for stats
    const { data: allPosts } = await supabase
      .from("ig_content")
      .select("theme, saves, shares, reach, engagement_rate, hook, published_at, cta_category, ad_potential");

    // Theme performance
    const themeStats: Record<string, any> = {};
    (allPosts || []).forEach((p: any) => {
      const t = p.theme || "OTROS";
      if (!themeStats[t]) themeStats[t] = { count: 0, totalSaves: 0, totalShares: 0, totalReach: 0, topPost: null };
      themeStats[t].count++;
      themeStats[t].totalSaves += p.saves || 0;
      themeStats[t].totalShares += p.shares || 0;
      themeStats[t].totalReach += p.reach || 0;
      if (!themeStats[t].topPost || (p.saves || 0) > (themeStats[t].topPost.saves || 0)) {
        themeStats[t].topPost = { hook: p.hook, saves: p.saves, shares: p.shares };
      }
    });
    const themes = Object.entries(themeStats).map(([theme, s]: any) => ({
      theme,
      count: s.count,
      avgSaves: Math.round(s.totalSaves / s.count),
      avgShares: Math.round(s.totalShares / s.count),
      totalReach: s.totalReach,
      topPost: s.topPost,
    })).sort((a, b) => b.avgSaves - a.avgSaves);

    // Hook type analysis
    const hookTypes: Record<string, any> = {};
    (topPosts || []).forEach((p: any) => {
      const ht = classifyHookType(p.hook || "");
      if (!hookTypes[ht]) hookTypes[ht] = { count: 0, totalSaves: 0, examples: [] };
      hookTypes[ht].count++;
      hookTypes[ht].totalSaves += p.saves || 0;
      if (hookTypes[ht].examples.length < 3) hookTypes[ht].examples.push({ hook: p.hook, saves: p.saves });
    });
    const hookPatterns = Object.entries(hookTypes).map(([type, s]: any) => ({
      type,
      count: s.count,
      avgSaves: Math.round(s.totalSaves / s.count),
      examples: s.examples,
    })).sort((a, b) => b.avgSaves - a.avgSaves);

    // Word frequency in top hooks
    const topHooks = (topPosts || []).map((p: any) => p.hook || "").filter(Boolean);
    const topWords = extractWordFrequency(topHooks);

    // Best time patterns (day of week from published_at)
    const dayStats: Record<string, any> = {};
    (allPosts || []).forEach((p: any) => {
      if (!p.published_at) return;
      const d = new Date(p.published_at);
      const day = d.getDay();
      const dayName = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"][day];
      if (!dayStats[dayName]) dayStats[dayName] = { count: 0, totalSaves: 0, totalShares: 0 };
      dayStats[dayName].count++;
      dayStats[dayName].totalSaves += p.saves || 0;
      dayStats[dayName].totalShares += p.shares || 0;
    });
    const dayOfWeek = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"].map(d => ({
      day: d,
      count: dayStats[d]?.count || 0,
      avgSaves: dayStats[d] ? Math.round(dayStats[d].totalSaves / dayStats[d].count) : 0,
      avgShares: dayStats[d] ? Math.round(dayStats[d].totalShares / dayStats[d].count) : 0,
    }));

    // Viral formulas - cross-reference high saves + high shares
    const { data: viralPosts } = await supabase
      .from("ig_content")
      .select("*")
      .gte("saves", 50)
      .gte("shares", 5)
      .order("saves", { ascending: false })
      .limit(20);

    // Content recency analysis - are you posting the winning themes recently?
    const now = new Date();
    const last30days = new Date(now.getTime() - 30 * 86400000);
    const { data: recentPosts } = await supabase
      .from("ig_content")
      .select("theme, saves")
      .gte("published_at", last30days.toISOString());
    const recentThemes: Record<string, number> = {};
    (recentPosts || []).forEach((p: any) => {
      if (p.theme) recentThemes[p.theme] = (recentThemes[p.theme] || 0) + 1;
    });

    // Underexploited themes (high saves avg but low recent count)
    const underexploited = themes
      .filter(t => t.avgSaves >= 30 && (recentThemes[t.theme] || 0) < 3)
      .slice(0, 5);

    return NextResponse.json({
      totalAnalyzed: allPosts?.length || 0,
      themes,
      hookPatterns,
      topWords,
      dayOfWeek,
      viralPosts: viralPosts || [],
      topBySaves: (topPosts || []).slice(0, 15),
      topByShares: (topShares || []).slice(0, 15),
      topByReach: (topReach || []).slice(0, 15),
      recentThemes,
      underexploited,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const TOKEN = process.env.META_ACCESS_TOKEN!;
const ACCOUNT = process.env.META_AD_ACCOUNT_ID!;

// Interest suggestions by content theme - based on Meta's targeting options
const THEME_INTERESTS: Record<string, any[]> = {
  CANCER: [
    { name: "Medicina alternativa", type: "interest", audience: "500K+" },
    { name: "Medicina natural", type: "interest", audience: "1M+" },
    { name: "Salud holística", type: "interest", audience: "300K+" },
    { name: "Nutrición", type: "interest", audience: "10M+" },
    { name: "Bruce Lipton", type: "interest", audience: "50K+" },
    { name: "Louise Hay", type: "interest", audience: "100K+" },
    { name: "Joe Dispenza", type: "interest", audience: "80K+" },
  ],
  INFLAMACION: [
    { name: "Antiinflamatorios", type: "interest", audience: "200K+" },
    { name: "Dieta antiinflamatoria", type: "interest", audience: "500K+" },
    { name: "Artritis", type: "interest", audience: "1M+" },
    { name: "Fibromialgia", type: "interest", audience: "300K+" },
    { name: "Autoinmune", type: "interest", audience: "400K+" },
  ],
  AGUA_DE_MAR: [
    { name: "Medicina natural", type: "interest", audience: "1M+" },
    { name: "Nutrición holística", type: "interest", audience: "200K+" },
    { name: "Biorresonancia", type: "interest", audience: "80K+" },
    { name: "Terapia alternativa", type: "interest", audience: "500K+" },
  ],
  INCONSCIENTE: [
    { name: "Louise Hay", type: "interest", audience: "100K+" },
    { name: "Bruce Lipton", type: "interest", audience: "50K+" },
    { name: "Joe Dispenza", type: "interest", audience: "80K+" },
    { name: "PNL (Programación Neurolingüística)", type: "interest", audience: "500K+" },
    { name: "Meditación", type: "interest", audience: "5M+" },
    { name: "Autoconocimiento", type: "interest", audience: "2M+" },
  ],
  EMOCIONAL: [
    { name: "Psicología", type: "interest", audience: "10M+" },
    { name: "Autoestima", type: "interest", audience: "3M+" },
    { name: "Terapia emocional", type: "interest", audience: "500K+" },
    { name: "Coaching de vida", type: "interest", audience: "2M+" },
    { name: "Desarrollo personal", type: "interest", audience: "15M+" },
  ],
  RESPIRACION: [
    { name: "Yoga", type: "interest", audience: "50M+" },
    { name: "Pranayama", type: "interest", audience: "100K+" },
    { name: "Wim Hof", type: "interest", audience: "300K+" },
    { name: "Meditación", type: "interest", audience: "5M+" },
  ],
  MIGRANAS: [
    { name: "Dolor crónico", type: "interest", audience: "2M+" },
    { name: "Migrañas", type: "interest", audience: "3M+" },
    { name: "Neurología", type: "interest", audience: "500K+" },
  ],
  CRONICA: [
    { name: "Enfermedad crónica", type: "interest", audience: "1M+" },
    { name: "Diabetes", type: "interest", audience: "10M+" },
    { name: "Hipertensión", type: "interest", audience: "5M+" },
    { name: "Salud integral", type: "interest", audience: "3M+" },
  ],
  MENTE: [
    { name: "Mindfulness", type: "interest", audience: "5M+" },
    { name: "Desarrollo personal", type: "interest", audience: "15M+" },
    { name: "Louise Hay", type: "interest", audience: "100K+" },
  ],
  SANACION: [
    { name: "Medicina natural", type: "interest", audience: "1M+" },
    { name: "Terapia alternativa", type: "interest", audience: "500K+" },
    { name: "Salud holística", type: "interest", audience: "300K+" },
  ],
};

export async function GET() {
  try {
    // Get top-performing themes from Supabase content library
    const { data: topContent } = await supabase
      .from("ig_content")
      .select("theme, saves, engagement_rate")
      .order("saves", { ascending: false })
      .limit(100);

    const themeScores: Record<string, number> = {};
    (topContent || []).forEach((p: any) => {
      if (p.theme) themeScores[p.theme] = (themeScores[p.theme] || 0) + (p.saves || 0);
    });

    const topThemes = Object.entries(themeScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([theme, score]) => ({ theme, score }));

    // Generate interest stacks for top themes
    const interestStacks = topThemes.map((t) => ({
      theme: t.theme,
      totalSaves: t.score,
      interests: THEME_INTERESTS[t.theme] || [],
    }));

    // Get custom audiences from the ad account
    let customAudiences: any[] = [];
    try {
      const res = await fetch(
        `https://graph.facebook.com/v22.0/${ACCOUNT}/customaudiences?fields=name,subtype,description,approximate_count_lower_bound,approximate_count_upper_bound,time_updated,retention_days&limit=50&access_token=${TOKEN}`
      );
      const data = await res.json();
      customAudiences = (data.data || []).map((a: any) => ({
        id: a.id,
        name: a.name,
        subtype: a.subtype,
        description: a.description,
        size: a.approximate_count_lower_bound
          ? `${a.approximate_count_lower_bound.toLocaleString()}-${a.approximate_count_upper_bound?.toLocaleString()}`
          : "Calculando...",
        retentionDays: a.retention_days,
        lastUpdated: a.time_updated,
      }));
    } catch (e) {}

    // Lookalike suggestions based on best sources
    const lalSuggestions = [
      {
        source: "Purchasers (180d)",
        tier: "LAL 1%",
        recommendation: "Mejor calidad. Usar para BOFU/ventas directas.",
        estimatedSize: "~500K-1M por país",
        priority: "ALTA",
      },
      {
        source: "Engagers IG 365d",
        tier: "LAL 1-3%",
        recommendation: "Audiencia tibia basada en tu cuenta de 294K seguidores.",
        estimatedSize: "~1-3M por país",
        priority: "ALTA",
      },
      {
        source: "Video Viewers 75%",
        tier: "LAL 1-3%",
        recommendation: "Quienes ven el 75%+ de tus reels son high-intent.",
        estimatedSize: "~800K-2M por país",
        priority: "MEDIA",
      },
      {
        source: "Page Engagers 90d",
        tier: "LAL 2-5%",
        recommendation: "Audiencia más amplia, ideal para TOFU.",
        estimatedSize: "~2-5M por país",
        priority: "MEDIA",
      },
      {
        source: "Checkout Abandoners",
        tier: "LAL 1%",
        recommendation: "Personas similares a quienes iniciaron checkout pero no compraron.",
        estimatedSize: "~300K-800K por país",
        priority: "ALTA",
      },
    ];

    // Custom audience recipes to create
    const customAudienceRecipes = [
      { name: "IG Engagers 365d", source: "Instagram Business Profile", days: 365, type: "IG_BUSINESS_PROFILE", priority: "CRÍTICO" },
      { name: "IG Engagers 90d (HOT)", source: "Instagram Business Profile", days: 90, type: "IG_BUSINESS_PROFILE", priority: "CRÍTICO" },
      { name: "Video Viewers 75% - 90d", source: "Video 75%", days: 90, type: "VIDEO_VIEW", priority: "ALTA" },
      { name: "Video Viewers 95% - 90d", source: "Video 95%", days: 90, type: "VIDEO_VIEW", priority: "ALTA" },
      { name: "Web Visitors 30d", source: "Website pixel", days: 30, type: "WEBSITE", priority: "ALTA" },
      { name: "Checkout Abandoners 14d", source: "InitiateCheckout (no purchase)", days: 14, type: "WEBSITE", priority: "CRÍTICO" },
      { name: "View Content 30d", source: "ViewContent event", days: 30, type: "WEBSITE", priority: "MEDIA" },
      { name: "Purchasers 180d (EXCLUIR de prospecting)", source: "Purchase event", days: 180, type: "WEBSITE", priority: "CRÍTICO" },
    ];

    return NextResponse.json({
      topThemes,
      interestStacks,
      customAudiences,
      lalSuggestions,
      customAudienceRecipes,
      accountSummary: {
        totalCustomAudiences: customAudiences.length,
        activeSources: [...new Set(customAudiences.map((a: any) => a.subtype))],
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

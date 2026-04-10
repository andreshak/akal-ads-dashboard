import { NextResponse } from "next/server";

const TOKEN = process.env.META_ACCESS_TOKEN!;

async function getIGAccount() {
  const res = await fetch(
    `https://graph.facebook.com/v22.0/me/accounts?fields=instagram_business_account{id,name,username,followers_count,media_count,profile_picture_url}&access_token=${TOKEN}`,
    { next: { revalidate: 3600 } }
  );
  const data = await res.json();
  const page = data.data?.[0];
  return page?.instagram_business_account || null;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50");

    const ig = await getIGAccount();
    if (!ig) return NextResponse.json({ error: "No Instagram account found" }, { status: 404 });

    // Get media
    const mediaRes = await fetch(
      `https://graph.facebook.com/v22.0/${ig.id}/media?fields=id,caption,media_type,media_product_type,timestamp,like_count,comments_count,permalink,thumbnail_url,media_url&limit=${limit}&access_token=${TOKEN}`,
      { next: { revalidate: 1800 } }
    );
    const mediaData = await mediaRes.json();
    const posts = mediaData.data || [];

    // Get insights for each post
    const enriched = await Promise.all(
      posts.map(async (post: any) => {
        let reach = 0, saved = 0, shares = 0, plays = 0;
        try {
          const insRes = await fetch(
            `https://graph.facebook.com/v22.0/${post.id}/insights?metric=reach,saved,shares&access_token=${TOKEN}`
          );
          const insData = await insRes.json();
          (insData.data || []).forEach((d: any) => {
            if (d.name === "reach") reach = d.values?.[0]?.value || 0;
            if (d.name === "saved") saved = d.values?.[0]?.value || 0;
            if (d.name === "shares") shares = d.values?.[0]?.value || 0;
          });
        } catch {}

        // Try plays separately (may fail for non-reels)
        try {
          const playsRes = await fetch(
            `https://graph.facebook.com/v22.0/${post.id}/insights?metric=plays&access_token=${TOKEN}`
          );
          const playsData = await playsRes.json();
          plays = playsData.data?.[0]?.values?.[0]?.value || 0;
        } catch {}

        const totalEng = (post.like_count || 0) + (post.comments_count || 0) + saved + shares;
        const engRate = reach > 0 ? parseFloat(((totalEng / reach) * 100).toFixed(2)) : 0;
        const caption = post.caption || "";

        // Extract hook (first line of caption)
        const hook = caption.split("\n")[0]?.replace(/[^\w\s?!¿¡áéíóúñÁÉÍÓÚÑ.,]/g, "").trim().substring(0, 120) || "";

        // Classify content theme
        let theme = "GENERAL";
        const lower = caption.toLowerCase();
        if (lower.includes("cáncer") || lower.includes("cancer")) theme = "CANCER";
        else if (lower.includes("agua de mar")) theme = "AGUA_DE_MAR";
        else if (lower.includes("inflamación") || lower.includes("inflamacion")) theme = "INFLAMACION";
        else if (lower.includes("inconsciente") || lower.includes("subconsciente")) theme = "INCONSCIENTE";
        else if (lower.includes("respirar") || lower.includes("respiración")) theme = "RESPIRACION";
        else if (lower.includes("migraña") || lower.includes("migrana")) theme = "MIGRANAS";
        else if (lower.includes("pastilla") || lower.includes("medicamento")) theme = "MEDICACION";
        else if (lower.includes("pensamient") || lower.includes("mente")) theme = "MENTE";
        else if (lower.includes("amor") || lower.includes("emocional")) theme = "EMOCIONAL";
        else if (lower.includes("meditar") || lower.includes("meditación")) theme = "MEDITACION";
        else if (lower.includes("fibromialgia")) theme = "FIBROMIALGIA";
        else if (lower.includes("enfermedad crónica") || lower.includes("enfermedad cronica")) theme = "CRONICA";
        else if (lower.includes("sanar") || lower.includes("sanación")) theme = "SANACION";

        // Classify ad potential
        let adPotential = "BAJO";
        if (engRate >= 5 && saved >= 20) adPotential = "ESTRELLA";
        else if (engRate >= 4 || saved >= 15) adPotential = "ALTO";
        else if (engRate >= 3 || saved >= 8) adPotential = "MEDIO";

        return {
          id: post.id,
          caption,
          hook,
          type: post.media_product_type || post.media_type,
          date: post.timestamp,
          permalink: post.permalink,
          thumbnail: post.thumbnail_url || post.media_url,
          likes: post.like_count || 0,
          comments: post.comments_count || 0,
          saves: saved,
          shares: shares,
          reach,
          plays,
          totalEngagement: totalEng,
          engagementRate: engRate,
          theme,
          adPotential,
        };
      })
    );

    // Sort by engagement rate
    const sorted = enriched.sort((a, b) => b.engagementRate - a.engagementRate);

    // Theme summary
    const themes: Record<string, any> = {};
    enriched.forEach((p) => {
      if (!themes[p.theme]) themes[p.theme] = { count: 0, totalEng: 0, totalSaves: 0, totalShares: 0, totalReach: 0, bestPost: null };
      themes[p.theme].count++;
      themes[p.theme].totalEng += p.totalEngagement;
      themes[p.theme].totalSaves += p.saves;
      themes[p.theme].totalShares += p.shares;
      themes[p.theme].totalReach += p.reach;
      if (!themes[p.theme].bestPost || p.engagementRate > themes[p.theme].bestPost.engagementRate) {
        themes[p.theme].bestPost = { hook: p.hook, engRate: p.engagementRate, saves: p.saves };
      }
    });

    // Calculate averages
    Object.values(themes).forEach((t: any) => {
      t.avgEng = t.count > 0 ? parseFloat((t.totalEng / t.count).toFixed(1)) : 0;
      t.avgSaves = t.count > 0 ? parseFloat((t.totalSaves / t.count).toFixed(1)) : 0;
    });

    return NextResponse.json({
      account: { username: ig.username, followers: ig.followers_count, mediaCount: ig.media_count },
      posts: sorted,
      themes,
      updatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

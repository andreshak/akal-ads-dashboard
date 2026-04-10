import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const TOKEN = process.env.META_ACCESS_TOKEN!;

function classifyTheme(caption: string): string {
  const lower = (caption || "").toLowerCase();
  if (lower.includes("cáncer") || lower.includes("cancer")) return "CANCER";
  if (lower.includes("agua de mar")) return "AGUA_DE_MAR";
  if (lower.includes("inflamación") || lower.includes("inflamacion")) return "INFLAMACION";
  if (lower.includes("inconsciente") || lower.includes("subconsciente")) return "INCONSCIENTE";
  if (lower.includes("respirar") || lower.includes("respiración") || lower.includes("respiracion")) return "RESPIRACION";
  if (lower.includes("migraña") || lower.includes("migrana")) return "MIGRANAS";
  if (lower.includes("pastilla") || lower.includes("medicamento")) return "MEDICACION";
  if (lower.includes("pensamient") || lower.includes("mente")) return "MENTE";
  if (lower.includes("amor") || lower.includes("emocional") || lower.includes("mendigar")) return "EMOCIONAL";
  if (lower.includes("meditar") || lower.includes("meditación") || lower.includes("meditacion")) return "MEDITACION";
  if (lower.includes("fibromialgia")) return "FIBROMIALGIA";
  if (lower.includes("enfermedad crónica") || lower.includes("enfermedad cronica")) return "CRONICA";
  if (lower.includes("sanar") || lower.includes("sanación") || lower.includes("sanacion")) return "SANACION";
  if (lower.includes("ego") || lower.includes("autoestima")) return "DESARROLLO_PERSONAL";
  if (lower.includes("estrés") || lower.includes("estres") || lower.includes("nervioso")) return "ESTRES";
  if (lower.includes("alimenta") || lower.includes("ayuno") || lower.includes("dieta")) return "ALIMENTACION";
  return "GENERAL";
}

function classifyCTA(caption: string): string {
  const lower = (caption || "").toLowerCase();
  // VENTA - links de compra o paginas de venta
  if (lower.includes("link en bio") && (lower.includes("compra") || lower.includes("inscrib") || lower.includes("regístr") || lower.includes("registr") || lower.includes("masterclass") || lower.includes("programa") || lower.includes("curso"))) return "VENTA";
  if (lower.includes("página de venta") || lower.includes("pagina de venta") || lower.includes("compra ahora") || lower.includes("comprar") || lower.includes("adquir")) return "VENTA";
  if (lower.includes("oferta") || lower.includes("descuento") || lower.includes("precio") || lower.includes("inversión") || lower.includes("inversion")) return "VENTA";
  // LEADS - captacion de datos o registro
  if (lower.includes("regístrate") || lower.includes("registrate") || lower.includes("inscríbete") || lower.includes("inscribete") || lower.includes("formulario")) return "LEADS";
  if (lower.includes("desafío") || lower.includes("desafio") || lower.includes("reto") || lower.includes("challenge")) return "LEADS";
  if (lower.includes("comenta") && (lower.includes("palabra") || lower.includes("sanar") || lower.includes("salud") || lower.includes("quiero") || lower.includes("info") || lower.includes("gratis"))) return "LEADS";
  if (lower.includes("link en bio") && (lower.includes("gratis") || lower.includes("free") || lower.includes("regalo"))) return "LEADS";
  // MENSAJES - DM o conversacion
  if (lower.includes("escríbeme") || lower.includes("escribeme") || lower.includes("manda mensaje") || lower.includes("envía mensaje") || lower.includes("dm") || lower.includes("mensaje directo") || lower.includes("whatsapp")) return "MENSAJES";
  // TRAFICO - links generales
  if (lower.includes("link en bio") || lower.includes("link en la bio") || lower.includes("linktree") || lower.includes("ve al link")) return "TRAFICO";
  if (lower.includes("visita") && (lower.includes("web") || lower.includes("página") || lower.includes("pagina") || lower.includes("sitio"))) return "TRAFICO";
  // ENGAGEMENT - interaccion
  if (lower.includes("comenta") || lower.includes("comparte") || lower.includes("guarda") || lower.includes("etiqueta") || lower.includes("menciona") || lower.includes("¿qué opinas") || lower.includes("que opinas") || lower.includes("dime en comentarios")) return "ENGAGEMENT";
  if (lower.includes("doble tap") || lower.includes("dale like") || lower.includes("sigue") || lower.includes("sígueme") || lower.includes("sigueme")) return "ENGAGEMENT";
  // AWARENESS - contenido educativo sin CTA claro
  if (lower.includes("live") || lower.includes("en vivo") || lower.includes("directo")) return "AWARENESS";
  return "";
}

function extractLinks(caption: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  return (caption || "").match(urlRegex) || [];
}

function classifyAdPotential(engRate: number, saves: number): string {
  if (engRate >= 5 && saves >= 20) return "ESTRELLA";
  if (engRate >= 4 || saves >= 15) return "ALTO";
  if (engRate >= 3 || saves >= 8) return "MEDIO";
  return "BAJO";
}

export async function POST(req: Request) {
  try {
    const { fullSync } = await req.json().catch(() => ({ fullSync: false }));

    // Get IG account
    const acctRes = await fetch(
      `https://graph.facebook.com/v22.0/me/accounts?fields=instagram_business_account{id}&access_token=${TOKEN}`
    );
    const acctData = await acctRes.json();
    const igId = acctData.data?.[0]?.instagram_business_account?.id;
    if (!igId) return NextResponse.json({ error: "No IG account" }, { status: 404 });

    let totalSynced = 0;
    let totalSkipped = 0;
    let cursor = "";
    let hasMore = true;
    const batchSize = 50;
    const maxPages = fullSync ? 100 : 2; // fullSync = all, otherwise just 2 pages (100 posts)
    let page = 0;

    while (hasMore && page < maxPages) {
      page++;
      const paginationParam = cursor ? `&after=${cursor}` : "";
      const mediaRes = await fetch(
        `https://graph.facebook.com/v22.0/${igId}/media?fields=id,caption,media_type,media_product_type,timestamp,like_count,comments_count,permalink,thumbnail_url&limit=${batchSize}${paginationParam}&access_token=${TOKEN}`
      );
      const mediaData = await mediaRes.json();
      const posts = mediaData.data || [];

      if (posts.length === 0) break;

      // Enrich with insights
      const enriched = await Promise.all(
        posts.map(async (post: any) => {
          let reach = 0, saved = 0, shares = 0;
          try {
            const r = await fetch(
              `https://graph.facebook.com/v22.0/${post.id}/insights?metric=reach,saved,shares&access_token=${TOKEN}`
            );
            const d = await r.json();
            (d.data || []).forEach((m: any) => {
              if (m.name === "reach") reach = m.values?.[0]?.value || 0;
              if (m.name === "saved") saved = m.values?.[0]?.value || 0;
              if (m.name === "shares") shares = m.values?.[0]?.value || 0;
            });
          } catch {}

          const totalEng = (post.like_count || 0) + (post.comments_count || 0) + saved + shares;
          const engRate = reach > 0 ? parseFloat(((totalEng / reach) * 100).toFixed(2)) : 0;
          const caption = post.caption || "";
          const hook = caption.split("\n")[0]?.replace(/[^\w\s?!¿¡áéíóúñÁÉÍÓÚÑ.,:\-()]/g, "").trim().substring(0, 120) || "";
          const theme = classifyTheme(caption);

          return {
            id: post.id,
            caption,
            hook,
            media_type: post.media_product_type || post.media_type,
            permalink: post.permalink,
            thumbnail_url: post.thumbnail_url,
            published_at: post.timestamp,
            likes: post.like_count || 0,
            comments: post.comments_count || 0,
            saves: saved,
            shares: shares,
            reach,
            total_engagement: totalEng,
            engagement_rate: engRate,
            theme,
            ad_potential: classifyAdPotential(engRate, saved),
            cta_category: classifyCTA(caption),
            synced_at: new Date().toISOString(),
          };
        })
      );

      // Upsert to Supabase
      const { error } = await supabase.from("ig_content").upsert(enriched, { onConflict: "id" });

      if (error) {
        return NextResponse.json({ error: `Supabase error: ${error.message}`, page, totalSynced }, { status: 500 });
      }

      totalSynced += enriched.length;
      cursor = mediaData.paging?.cursors?.after || "";
      hasMore = !!mediaData.paging?.next;
    }

    // Get total count
    const { count } = await supabase.from("ig_content").select("*", { count: "exact", head: true });

    return NextResponse.json({
      success: true,
      totalSynced,
      totalInDatabase: count,
      pages: page,
      hasMore,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

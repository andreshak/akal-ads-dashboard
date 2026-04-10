import { NextResponse } from "next/server";

const TOKEN = process.env.META_ACCESS_TOKEN!;

async function getIGAccountId() {
  const res = await fetch(
    `https://graph.facebook.com/v22.0/me/accounts?fields=instagram_business_account{id}&access_token=${TOKEN}`
  );
  const data = await res.json();
  return data.data?.[0]?.instagram_business_account?.id;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const after = searchParams.get("after") || "";
    const limit = parseInt(searchParams.get("limit") || "100");

    const igId = await getIGAccountId();
    if (!igId) return NextResponse.json({ error: "No IG account" }, { status: 404 });

    const paginationParam = after ? `&after=${after}` : "";
    const mediaRes = await fetch(
      `https://graph.facebook.com/v22.0/${igId}/media?fields=id,caption,media_type,media_product_type,timestamp,like_count,comments_count,permalink,thumbnail_url&limit=${limit}${paginationParam}&access_token=${TOKEN}`
    );
    const mediaData = await mediaRes.json();
    const posts = mediaData.data || [];
    const nextCursor = mediaData.paging?.cursors?.after || null;
    const hasMore = !!mediaData.paging?.next;

    // Enrich with insights (batch - skip errors for very new posts)
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
        const hook = caption.split("\n")[0]?.replace(/[^\w\s?!¿¡áéíóúñÁÉÍÓÚÑ.,]/g, "").trim().substring(0, 120) || "";

        return {
          id: post.id,
          caption,
          hook,
          type: post.media_product_type || post.media_type,
          date: post.timestamp,
          permalink: post.permalink,
          thumbnail: post.thumbnail_url,
          likes: post.like_count || 0,
          comments: post.comments_count || 0,
          saves: saved,
          shares: shares,
          reach,
          totalEngagement: totalEng,
          engagementRate: engRate,
        };
      })
    );

    return NextResponse.json({
      posts: enriched,
      nextCursor,
      hasMore,
      totalFetched: posts.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

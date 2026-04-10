import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const theme = searchParams.get("theme");
    const cta = searchParams.get("cta");
    const adOnly = searchParams.get("ad_only") === "true";
    const sortBy = searchParams.get("sort") || "saves";
    const limit = parseInt(searchParams.get("limit") || "200");
    const offset = parseInt(searchParams.get("offset") || "0");
    const search = searchParams.get("search");

    let query = supabase.from("ig_content").select("*", { count: "exact" });

    if (theme && theme !== "ALL") query = query.eq("theme", theme);
    if (cta && cta !== "ALL") query = query.eq("cta_category", cta);
    if (adOnly) query = query.eq("marked_for_ad", true);
    if (search) query = query.ilike("caption", `%${search}%`);

    if (sortBy === "saves") query = query.order("saves", { ascending: false });
    else if (sortBy === "engagement") query = query.order("engagement_rate", { ascending: false });
    else if (sortBy === "reach") query = query.order("reach", { ascending: false });
    else if (sortBy === "recent") query = query.order("published_at", { ascending: false });
    else if (sortBy === "shares") query = query.order("shares", { ascending: false });

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Get theme and CTA counts
    let themeData = null;
    try { const r = await supabase.rpc("get_theme_counts"); themeData = r.data; } catch {}

    // Manual theme counts if rpc not available
    const themeCounts: Record<string, number> = {};
    const ctaCounts: Record<string, number> = {};
    if (!themeData) {
      const { data: allPosts } = await supabase.from("ig_content").select("theme, cta_category");
      (allPosts || []).forEach((p: any) => {
        if (p.theme) themeCounts[p.theme] = (themeCounts[p.theme] || 0) + 1;
        if (p.cta_category) ctaCounts[p.cta_category] = (ctaCounts[p.cta_category] || 0) + 1;
      });
    }

    return NextResponse.json({
      posts: data || [],
      total: count || 0,
      themeCounts,
      ctaCounts,
      offset,
      limit,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Update CTA or notes for a post
export async function PATCH(req: Request) {
  try {
    const { id, cta_category, marked_for_ad, notes } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const updates: any = {};
    if (cta_category !== undefined) updates.cta_category = cta_category;
    if (marked_for_ad !== undefined) updates.marked_for_ad = marked_for_ad;
    if (notes !== undefined) updates.notes = notes;

    const { error } = await supabase.from("ig_content").update(updates).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

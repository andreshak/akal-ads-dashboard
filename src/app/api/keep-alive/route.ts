import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Pinged daily by Vercel Cron to prevent Supabase free-tier auto-pause
export async function GET() {
  try {
    const { count, error } = await supabase
      .from("ig_content")
      .select("*", { count: "exact", head: true });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: "Supabase keep-alive ping successful",
      igContentCount: count,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";

const TOKEN = process.env.META_ACCESS_TOKEN!;
const ACCOUNT = process.env.META_AD_ACCOUNT_ID!;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fresh = searchParams.get("fresh") === "true";
    const fetchOptions: any = fresh ? { cache: "no-store" } : { next: { revalidate: 300 } };
    const res = await fetch(
      `https://graph.facebook.com/v22.0/${ACCOUNT}/insights?fields=spend,impressions,clicks,actions,cost_per_action_type&time_increment=1&date_preset=last_14d&access_token=${TOKEN}`,
      fetchOptions
    );
    const data = await res.json();

    const trends = (data.data || []).map((day: any) => {
      const purchases = day.actions?.find((a: any) => a.action_type === "purchase")?.value || "0";
      const costPurchase = day.cost_per_action_type?.find((a: any) => a.action_type === "purchase")?.value || "0";
      return {
        date: day.date_start,
        spend: parseFloat(day.spend || "0"),
        impressions: parseInt(day.impressions || "0"),
        clicks: parseInt(day.clicks || "0"),
        purchases: parseInt(purchases),
        cpa: parseFloat(costPurchase),
      };
    });

    return NextResponse.json({ trends });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

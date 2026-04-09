import { NextResponse } from "next/server";

const TOKEN = process.env.META_ACCESS_TOKEN!;
const ACCOUNT = process.env.META_AD_ACCOUNT_ID!;

export async function GET() {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v22.0/${ACCOUNT}/insights?fields=spend,impressions,clicks,actions,cost_per_action_type,ctr,cpc,cpm&breakdowns=country&date_preset=last_7d&limit=50&access_token=${TOKEN}`,
      { next: { revalidate: 3600 } }
    );
    const data = await res.json();

    const countries = (data.data || []).map((row: any) => {
      const purchases = row.actions?.find((a: any) => a.action_type === "purchase")?.value || "0";
      const costPurchase = row.cost_per_action_type?.find((a: any) => a.action_type === "purchase")?.value || "0";
      return {
        country: row.country,
        spend: parseFloat(row.spend || "0"),
        impressions: parseInt(row.impressions || "0"),
        clicks: parseInt(row.clicks || "0"),
        ctr: parseFloat(row.ctr || "0"),
        cpc: parseFloat(row.cpc || "0"),
        cpm: parseFloat(row.cpm || "0"),
        purchases: parseInt(purchases),
        cpa: parseFloat(costPurchase),
      };
    }).sort((a: any, b: any) => b.spend - a.spend);

    return NextResponse.json({ countries });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

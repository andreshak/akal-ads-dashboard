import { NextResponse } from "next/server";

const TOKEN = process.env.META_ACCESS_TOKEN!;
const ACCOUNT = process.env.META_AD_ACCOUNT_ID!;
const BASE = `https://graph.facebook.com/v22.0/${ACCOUNT}`;

async function fetchMeta(endpoint: string) {
  const sep = endpoint.includes("?") ? "&" : "?";
  const res = await fetch(`${BASE}${endpoint}${sep}access_token=${TOKEN}`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(JSON.stringify(err));
  }
  return res.json();
}

export async function GET() {
  try {
    const [account, insights7d, insights30d, campaignInsights, adInsights] =
      await Promise.all([
        fetchMeta("?fields=name,account_status,currency,timezone_name,amount_spent"),
        fetchMeta(
          "/insights?fields=spend,impressions,reach,clicks,ctr,cpc,cpm,actions,cost_per_action_type,frequency&date_preset=last_7d"
        ),
        fetchMeta(
          "/insights?fields=spend,impressions,reach,clicks,ctr,cpc,cpm,actions,cost_per_action_type,frequency&date_preset=last_30d"
        ),
        fetchMeta(
          "/insights?fields=campaign_name,campaign_id,spend,impressions,clicks,ctr,cpc,cpm,actions,cost_per_action_type,frequency,reach&level=campaign&date_preset=last_7d&limit=50&filtering=[{\"field\":\"campaign.effective_status\",\"operator\":\"IN\",\"value\":[\"ACTIVE\"]}]"
        ),
        fetchMeta(
          "/insights?fields=ad_name,ad_id,campaign_name,adset_name,spend,impressions,clicks,ctr,cpc,cpm,actions,cost_per_action_type,frequency,reach&level=ad&date_preset=last_7d&limit=100&filtering=[{\"field\":\"campaign.effective_status\",\"operator\":\"IN\",\"value\":[\"ACTIVE\"]}]"
        ),
      ]);

    const extractAction = (actions: any[], type: string) =>
      actions?.find((a: any) => a.action_type === type)?.value || "0";

    const extractCost = (costs: any[], type: string) =>
      costs?.find((a: any) => a.action_type === type)?.value || "0";

    const i7 = insights7d.data?.[0] || {};
    const i30 = insights30d.data?.[0] || {};

    const summary = {
      account: {
        name: account.name,
        id: account.id,
        currency: account.currency,
        timezone: account.timezone_name,
        totalSpent: (parseInt(account.amount_spent) / 100).toFixed(2),
      },
      last7d: {
        spend: i7.spend || "0",
        impressions: i7.impressions || "0",
        reach: i7.reach || "0",
        clicks: i7.clicks || "0",
        ctr: i7.ctr || "0",
        cpc: i7.cpc || "0",
        cpm: i7.cpm || "0",
        frequency: i7.frequency || "0",
        purchases: extractAction(i7.actions, "purchase"),
        costPerPurchase: extractCost(i7.cost_per_action_type, "purchase"),
        linkClicks: extractAction(i7.actions, "link_click"),
        landingPageViews: extractAction(i7.actions, "landing_page_view"),
        checkouts: extractAction(i7.actions, "onsite_web_initiate_checkout"),
        registrations: extractAction(i7.actions, "complete_registration"),
        videoViews: extractAction(i7.actions, "video_view"),
        messages: extractAction(
          i7.actions,
          "onsite_conversion.messaging_first_reply"
        ),
      },
      last30d: {
        spend: i30.spend || "0",
        impressions: i30.impressions || "0",
        reach: i30.reach || "0",
        clicks: i30.clicks || "0",
        ctr: i30.ctr || "0",
        cpc: i30.cpc || "0",
        cpm: i30.cpm || "0",
        frequency: i30.frequency || "0",
        purchases: extractAction(i30.actions, "purchase"),
        costPerPurchase: extractCost(i30.cost_per_action_type, "purchase"),
      },
      campaigns: (campaignInsights.data || []).map((c: any) => ({
        name: c.campaign_name,
        id: c.campaign_id,
        spend: c.spend,
        impressions: c.impressions,
        reach: c.reach,
        clicks: c.clicks,
        ctr: c.ctr,
        cpc: c.cpc,
        cpm: c.cpm,
        frequency: c.frequency,
        purchases: extractAction(c.actions, "purchase"),
        costPerPurchase: extractCost(c.cost_per_action_type, "purchase"),
        linkClicks: extractAction(c.actions, "link_click"),
        videoViews: extractAction(c.actions, "video_view"),
      })),
      ads: (adInsights.data || []).map((a: any) => ({
        name: a.ad_name,
        id: a.ad_id,
        campaign: a.campaign_name,
        adset: a.adset_name,
        spend: a.spend,
        impressions: a.impressions,
        reach: a.reach,
        clicks: a.clicks,
        ctr: a.ctr,
        cpc: a.cpc,
        cpm: a.cpm,
        frequency: a.frequency,
        purchases: extractAction(a.actions, "purchase"),
        costPerPurchase: extractCost(a.cost_per_action_type, "purchase"),
        linkClicks: extractAction(a.actions, "link_click"),
        landingPageViews: extractAction(a.actions, "landing_page_view"),
        checkouts: extractAction(
          a.actions,
          "onsite_web_initiate_checkout"
        ),
        videoViews: extractAction(a.actions, "video_view"),
        saves: extractAction(a.actions, "onsite_conversion.post_save"),
        comments: extractAction(a.actions, "comment"),
        reactions: extractAction(a.actions, "post_reaction"),
      })),
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json(summary);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Error fetching Meta data" },
      { status: 500 }
    );
  }
}

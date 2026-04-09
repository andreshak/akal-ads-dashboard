import { NextResponse } from "next/server";

const TOKEN = process.env.META_ACCESS_TOKEN!;
const ACCOUNT = process.env.META_AD_ACCOUNT_ID!;
const BASE = `https://graph.facebook.com/v22.0/${ACCOUNT}`;

async function fetchMeta(endpoint: string) {
  const sep = endpoint.includes("?") ? "&" : "?";
  const res = await fetch(`${BASE}${endpoint}${sep}access_token=${TOKEN}`, {
    next: { revalidate: 1800 },
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(JSON.stringify(err));
  }
  return res.json();
}

const extractAction = (actions: any[], type: string) =>
  actions?.find((a: any) => a.action_type === type)?.value || "0";
const extractCost = (costs: any[], type: string) =>
  costs?.find((a: any) => a.action_type === type)?.value || "0";
const extractValue = (values: any[], type: string) =>
  values?.find((a: any) => a.action_type === type)?.value || "0";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const datePreset = searchParams.get("date_preset") || "last_7d";
    const since = searchParams.get("since") || "";
    const until = searchParams.get("until") || "";

    const dateParam = since && until
      ? `&time_range={"since":"${since}","until":"${until}"}`
      : `&date_preset=${datePreset}`;

    const comparisonPreset = datePreset === "last_7d" ? "last_14d" : datePreset === "last_14d" ? "last_30d" : "last_30d";

    const insightsFields = "spend,impressions,reach,clicks,ctr,cpc,cpm,actions,action_values,cost_per_action_type,purchase_roas,frequency";
    const campaignFields = "campaign_name,campaign_id,spend,impressions,clicks,ctr,cpc,cpm,actions,action_values,cost_per_action_type,purchase_roas,frequency,reach";
    const adFields = `ad_name,ad_id,campaign_name,adset_name,adset_id,spend,impressions,clicks,ctr,cpc,cpm,actions,action_values,cost_per_action_type,purchase_roas,frequency,reach`;

    const [account, campaigns, insightsCurrent, insightsComparison, campaignInsights, adInsights, adsetInsights] =
      await Promise.all([
        fetchMeta("?fields=name,account_status,currency,timezone_name,amount_spent"),
        fetchMeta("/campaigns?fields=name,status,objective,daily_budget,lifetime_budget,effective_status,bid_strategy&limit=100"),
        fetchMeta(`/insights?fields=${insightsFields}${dateParam}`),
        fetchMeta(`/insights?fields=${insightsFields}&date_preset=${comparisonPreset}`),
        fetchMeta(`/insights?fields=${campaignFields}&level=campaign${dateParam}&limit=50&filtering=[{"field":"campaign.effective_status","operator":"IN","value":["ACTIVE"]}]`),
        fetchMeta(`/insights?fields=${adFields}&level=ad${dateParam}&limit=100&filtering=[{"field":"campaign.effective_status","operator":"IN","value":["ACTIVE"]}]`),
        fetchMeta(`/insights?fields=adset_name,adset_id,campaign_name,campaign_id,spend,impressions,clicks,ctr,cpc,cpm,actions,action_values,cost_per_action_type,purchase_roas,frequency,reach&level=adset${dateParam}&limit=100&filtering=[{"field":"campaign.effective_status","operator":"IN","value":["ACTIVE"]}]`),
      ]);

    const processPeriod = (raw: any) => {
      const d = raw.data?.[0] || {};
      return {
        spend: d.spend || "0",
        impressions: d.impressions || "0",
        reach: d.reach || "0",
        clicks: d.clicks || "0",
        ctr: d.ctr || "0",
        cpc: d.cpc || "0",
        cpm: d.cpm || "0",
        frequency: d.frequency || "0",
        purchases: extractAction(d.actions, "purchase"),
        costPerPurchase: extractCost(d.cost_per_action_type, "purchase"),
        revenue: extractValue(d.action_values, "purchase"),
        roas: d.purchase_roas?.value || extractValue(d.purchase_roas, "omni_purchase") || "0",
        linkClicks: extractAction(d.actions, "link_click"),
        landingPageViews: extractAction(d.actions, "landing_page_view"),
        checkouts: extractAction(d.actions, "onsite_web_initiate_checkout"),
        registrations: extractAction(d.actions, "complete_registration"),
        videoViews: extractAction(d.actions, "video_view"),
        messages: extractAction(d.actions, "onsite_conversion.messaging_first_reply"),
        dateStart: d.date_start || "",
        dateStop: d.date_stop || "",
      };
    };

    // Campaign structure map
    const campaignMap: Record<string, any> = {};
    (campaigns.data || []).forEach((c: any) => {
      campaignMap[c.id] = {
        name: c.name,
        status: c.effective_status,
        objective: c.objective,
        dailyBudget: c.daily_budget ? (parseInt(c.daily_budget) / 100).toFixed(2) : null,
        lifetimeBudget: c.lifetime_budget ? (parseInt(c.lifetime_budget) / 100).toFixed(2) : null,
        bidStrategy: c.bid_strategy,
      };
    });

    // Parse product/tag from campaign name: [CJ][VENTA][MCE]... → product = MCE
    const parseProduct = (name: string): string => {
      const match = name.match(/\[(.*?)\]/g);
      if (!match || match.length < 3) return "Otro";
      return match[2].replace(/[\[\]]/g, "").toUpperCase();
    };
    const parseFunnelStage = (name: string): string => {
      const lower = name.toLowerCase();
      if (lower.includes("rmk") || lower.includes("retarget") || lower.includes("remarketing")) return "RETARGETING";
      if (lower.includes("venta") || lower.includes("sales") || lower.includes("conversion")) return "BOFU";
      if (lower.includes("lead") || lower.includes("registro")) return "MOFU";
      if (lower.includes("audiencia") || lower.includes("trafico") || lower.includes("interaccion") || lower.includes("awareness") || lower.includes("reconocimiento")) return "TOFU";
      return "OTROS";
    };
    const parseGeo = (name: string): string => {
      const geos = ["CHILE", "USA", "ESPAÑA", "MEXICO", "COLOMBIA", "ARGENTINA", "BRASIL"];
      for (const g of geos) {
        if (name.toUpperCase().includes(g)) return g;
      }
      return "MULTI";
    };

    const processEntity = (e: any, level: string) => ({
      name: e[`${level}_name`] || e.ad_name,
      id: e[`${level}_id`] || e.ad_id,
      ...(level === "ad" && { campaign: e.campaign_name, adset: e.adset_name, adsetId: e.adset_id }),
      ...(level === "adset" && { campaign: e.campaign_name, campaignId: e.campaign_id }),
      ...(level === "campaign" && {
        ...campaignMap[e.campaign_id],
        product: parseProduct(e.campaign_name),
        funnelStage: parseFunnelStage(e.campaign_name),
        geo: parseGeo(e.campaign_name),
      }),
      spend: e.spend || "0",
      impressions: e.impressions || "0",
      reach: e.reach || "0",
      clicks: e.clicks || "0",
      ctr: e.ctr || "0",
      cpc: e.cpc || "0",
      cpm: e.cpm || "0",
      frequency: e.frequency || "0",
      purchases: extractAction(e.actions, "purchase"),
      costPerPurchase: extractCost(e.cost_per_action_type, "purchase"),
      revenue: extractValue(e.action_values, "purchase"),
      roas: typeof e.purchase_roas === "object" && !Array.isArray(e.purchase_roas)
        ? e.purchase_roas?.value || "0"
        : extractValue(e.purchase_roas, "omni_purchase") || "0",
      linkClicks: extractAction(e.actions, "link_click"),
      landingPageViews: extractAction(e.actions, "landing_page_view"),
      checkouts: extractAction(e.actions, "onsite_web_initiate_checkout"),
      videoViews: extractAction(e.actions, "video_view"),
      saves: extractAction(e.actions, "onsite_conversion.post_save"),
      comments: extractAction(e.actions, "comment"),
      reactions: extractAction(e.actions, "post_reaction"),
    });

    const campaignsData = (campaignInsights.data || []).map((c: any) => processEntity(c, "campaign"));
    const adsData = (adInsights.data || []).map((a: any) => processEntity(a, "ad"));
    const adsetsData = (adsetInsights.data || []).map((a: any) => processEntity(a, "adset"));

    // Product grouping
    const productGroups: Record<string, any> = {};
    campaignsData.forEach((c: any) => {
      const prod = c.product || "Otro";
      if (!productGroups[prod]) productGroups[prod] = { spend: 0, revenue: 0, purchases: 0, campaigns: 0 };
      productGroups[prod].spend += parseFloat(c.spend);
      productGroups[prod].revenue += parseFloat(c.revenue);
      productGroups[prod].purchases += parseInt(c.purchases);
      productGroups[prod].campaigns += 1;
    });

    // Funnel grouping
    const funnelGroups: Record<string, any> = {};
    campaignsData.forEach((c: any) => {
      const stage = c.funnelStage || "OTROS";
      if (!funnelGroups[stage]) funnelGroups[stage] = { spend: 0, revenue: 0, purchases: 0, campaigns: 0, impressions: 0 };
      funnelGroups[stage].spend += parseFloat(c.spend);
      funnelGroups[stage].revenue += parseFloat(c.revenue);
      funnelGroups[stage].purchases += parseInt(c.purchases);
      funnelGroups[stage].campaigns += 1;
      funnelGroups[stage].impressions += parseInt(c.impressions);
    });

    // Creative health classification
    const classifiedAds = adsData.map((ad: any) => {
      const spend = parseFloat(ad.spend);
      const purchases = parseInt(ad.purchases);
      const ctr = parseFloat(ad.ctr);
      const cpa = parseFloat(ad.costPerPurchase);
      const avgCpa = parseFloat(processPeriod(insightsCurrent).costPerPurchase);

      let status = "UNKNOWN";
      let suggestion = "";
      if (purchases > 0 && cpa < avgCpa * 0.7) { status = "ESTRELLA"; suggestion = "Escalar: duplicar en mas audiencias/paises"; }
      else if (purchases > 0 && cpa <= avgCpa * 1.3) { status = "BUENO"; suggestion = "Mantener y monitorear"; }
      else if (purchases > 0 && cpa > avgCpa * 1.3) { status = "CARO"; suggestion = "Reducir budget o pausar si no mejora en 3 dias"; }
      else if (spend > 20 && purchases === 0) { status = "MUERTO"; suggestion = "Pausar inmediatamente - gasto sin retorno"; }
      else if (spend > 5 && spend <= 20 && purchases === 0) { status = "EN_PRUEBA"; suggestion = "Dar mas tiempo o pausar si CTR < 2%"; }
      else if (ctr > 5 && purchases === 0) { status = "POTENCIAL"; suggestion = "Buen CTR pero sin ventas - revisar landing page"; }
      else { status = "NUEVO"; suggestion = "Insuficiente data para clasificar"; }

      return { ...ad, status, suggestion };
    });

    return NextResponse.json({
      account: {
        name: account.name,
        id: account.id,
        currency: account.currency,
        timezone: account.timezone_name,
        totalSpent: (parseInt(account.amount_spent) / 100).toFixed(2),
      },
      current: processPeriod(insightsCurrent),
      comparison: processPeriod(insightsComparison),
      campaigns: campaignsData,
      adsets: adsetsData,
      ads: classifiedAds,
      productGroups,
      funnelGroups,
      allCampaigns: (campaigns.data || []).map((c: any) => ({
        id: c.id, name: c.name, status: c.effective_status, objective: c.objective,
        dailyBudget: c.daily_budget ? (parseInt(c.daily_budget) / 100).toFixed(2) : null,
        product: parseProduct(c.name), funnelStage: parseFunnelStage(c.name), geo: parseGeo(c.name),
      })),
      datePreset,
      updatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Error fetching Meta data" }, { status: 500 });
  }
}

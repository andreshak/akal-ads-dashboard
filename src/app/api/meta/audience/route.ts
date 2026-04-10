import { NextResponse } from "next/server";

const TOKEN = process.env.META_ACCESS_TOKEN!;
const ACCOUNT = process.env.META_AD_ACCOUNT_ID!;
const BASE = `https://graph.facebook.com/v22.0/${ACCOUNT}`;

async function fetchMeta(endpoint: string) {
  const sep = endpoint.includes("?") ? "&" : "?";
  const res = await fetch(`${BASE}${endpoint}${sep}access_token=${TOKEN}`, {
    next: { revalidate: 1800 },
  });
  if (!res.ok) throw new Error(`Meta API error: ${res.status}`);
  return res.json();
}

const extractAction = (a: any[], t: string) => parseFloat(a?.find((x: any) => x.action_type === t)?.value || "0");
const extractValue = (a: any[], t: string) => parseFloat(a?.find((x: any) => x.action_type === t)?.value || "0");

function processBreakdown(rows: any[], keys: string[]) {
  return rows.map((row: any) => {
    const spend = parseFloat(row.spend || "0");
    const purchases = extractAction(row.actions, "purchase");
    const revenue = extractValue(row.action_values, "purchase");
    const cpa = purchases > 0 ? spend / purchases : 0;
    const roas = spend > 0 ? revenue / spend : 0;
    const result: any = {
      spend,
      impressions: parseInt(row.impressions || "0"),
      clicks: parseInt(row.clicks || "0"),
      ctr: parseFloat(row.ctr || "0"),
      cpm: parseFloat(row.cpm || "0"),
      cpc: parseFloat(row.cpc || "0"),
      purchases,
      revenue,
      cpa,
      roas,
    };
    keys.forEach((k) => { result[k] = row[k]; });
    return result;
  });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const datePreset = searchParams.get("date_preset") || "last_7d";
    const dp = `&date_preset=${datePreset}`;

    const fields = "spend,impressions,clicks,actions,action_values,ctr,cpc,cpm";

    // Fetch all breakdowns in parallel
    const [demographics, regions, placement, hourly, dayOfWeek, countries] = await Promise.all([
      fetchMeta(`/insights?fields=${fields}&breakdowns=age,gender${dp}&limit=100`),
      fetchMeta(`/insights?fields=${fields}&breakdowns=region${dp}&limit=100`),
      fetchMeta(`/insights?fields=${fields}&breakdowns=publisher_platform,platform_position${dp}&limit=50`),
      fetchMeta(`/insights?fields=${fields}&breakdowns=hourly_stats_aggregated_by_advertiser_time_zone${dp}&limit=30`),
      fetchMeta(`/insights?fields=${fields}&breakdowns=dma${dp}&limit=100`).catch(() => ({ data: [] })),
      fetchMeta(`/insights?fields=${fields}&breakdowns=country${dp}&limit=100`),
    ]);

    const demo = processBreakdown(demographics.data || [], ["age", "gender"])
      .filter((r: any) => r.gender !== "unknown")
      .sort((a: any, b: any) => b.spend - a.spend);

    const regionData = processBreakdown(regions.data || [], ["region"])
      .filter((r: any) => r.spend >= 1)
      .sort((a: any, b: any) => b.spend - a.spend);

    const placementData = processBreakdown(placement.data || [], ["publisher_platform", "platform_position"])
      .filter((r: any) => r.spend >= 1)
      .sort((a: any, b: any) => b.spend - a.spend);

    const hourly_data = processBreakdown(hourly.data || [], ["hourly_stats_aggregated_by_advertiser_time_zone"])
      .map((r: any) => ({ ...r, hour: parseInt(r.hourly_stats_aggregated_by_advertiser_time_zone?.substring(0, 2) || "0") }))
      .sort((a: any, b: any) => a.hour - b.hour);

    const countriesData = processBreakdown(countries.data || [], ["country"])
      .filter((r: any) => r.spend >= 1)
      .sort((a: any, b: any) => b.spend - a.spend);

    // Compute insights
    const topDemo = demo.filter((d: any) => d.purchases > 0).sort((a: any, b: any) => b.roas - a.roas).slice(0, 3);
    const worstDemo = demo.filter((d: any) => d.spend > 10 && d.purchases === 0)
      .sort((a: any, b: any) => b.spend - a.spend).slice(0, 3);
    const lossDemo = demo.filter((d: any) => d.roas > 0 && d.roas < 0.5).sort((a: any, b: any) => b.spend - a.spend);

    const topRegions = regionData.filter((r: any) => r.purchases > 0).sort((a: any, b: any) => b.roas - a.roas).slice(0, 10);
    const wasteRegions = regionData.filter((r: any) => r.spend > 5 && r.purchases === 0)
      .sort((a: any, b: any) => b.spend - a.spend).slice(0, 10);

    const topPlacements = placementData.filter((p: any) => p.purchases > 0).sort((a: any, b: any) => b.roas - a.roas);
    const wastePlacements = placementData.filter((p: any) => p.spend > 5 && p.purchases === 0);

    const bestHours = hourly_data.filter((h: any) => h.purchases > 0).sort((a: any, b: any) => b.roas - a.roas).slice(0, 6);
    const worstHours = hourly_data.filter((h: any) => h.spend > 20 && h.purchases === 0);

    // Calculate totals
    const totals = {
      spend: demo.reduce((s: number, d: any) => s + d.spend, 0),
      revenue: demo.reduce((s: number, d: any) => s + d.revenue, 0),
      purchases: demo.reduce((s: number, d: any) => s + d.purchases, 0),
    };
    const totalRoas = totals.spend > 0 ? totals.revenue / totals.spend : 0;

    // Generate recommendations
    const recommendations: any[] = [];

    topDemo.forEach((d: any) => {
      if (d.roas >= 1) recommendations.push({
        type: "scale",
        icon: "📈",
        title: `Escalar ${d.gender === "female" ? "Mujeres" : "Hombres"} ${d.age}`,
        desc: `ROAS ${d.roas.toFixed(2)}x · ${d.purchases} compras · ${d.spend.toFixed(0)} gastado`,
        action: "Duplicar ad set con solo este grupo + aumentar budget",
      });
    });

    lossDemo.slice(0, 3).forEach((d: any) => {
      recommendations.push({
        type: "reduce",
        icon: "⚠️",
        title: `Excluir o reducir ${d.gender === "female" ? "Mujeres" : "Hombres"} ${d.age}`,
        desc: `ROAS ${d.roas.toFixed(2)}x · pierde $${(d.spend - d.revenue).toFixed(0)} en el periodo`,
        action: "Excluir de campañas o reducir budget 50%",
      });
    });

    topRegions.slice(0, 3).forEach((r: any) => {
      if (r.roas >= 1) recommendations.push({
        type: "scale",
        icon: "🌎",
        title: `Escalar en ${r.region}`,
        desc: `ROAS ${r.roas.toFixed(2)}x · ${r.purchases} compras`,
        action: "Crear campaña dedicada a esta región",
      });
    });

    wasteRegions.slice(0, 2).forEach((r: any) => {
      recommendations.push({
        type: "reduce",
        icon: "❌",
        title: `Excluir ${r.region}`,
        desc: `$${r.spend.toFixed(2)} gastado sin compras`,
        action: "Excluir geo de todas las campañas",
      });
    });

    wastePlacements.forEach((p: any) => {
      recommendations.push({
        type: "reduce",
        icon: "📱",
        title: `Desactivar ${p.publisher_platform}/${p.platform_position}`,
        desc: `$${p.spend.toFixed(2)} sin retorno`,
        action: "Excluir placement en ad sets",
      });
    });

    topPlacements.slice(0, 2).forEach((p: any) => {
      if (p.roas >= 1) recommendations.push({
        type: "scale",
        icon: "🚀",
        title: `${p.publisher_platform}/${p.platform_position} es ganador`,
        desc: `ROAS ${p.roas.toFixed(2)}x`,
        action: "Crear ad sets solo-este-placement",
      });
    });

    return NextResponse.json({
      totals: { ...totals, roas: totalRoas },
      demographics: demo,
      regions: regionData,
      placement: placementData,
      hourly: hourly_data,
      countries: countriesData,
      topDemo,
      worstDemo,
      lossDemo,
      topRegions,
      wasteRegions,
      topPlacements,
      wastePlacements,
      bestHours,
      worstHours,
      recommendations,
      datePreset,
      updatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

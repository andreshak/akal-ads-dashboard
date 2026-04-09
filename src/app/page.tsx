"use client";
import { useEffect, useState, useCallback } from "react";

// ── Country name mapping ──
const COUNTRY_NAMES: Record<string, string> = {
  CL: "Chile", MX: "Mexico", CO: "Colombia", ES: "España", US: "USA", AR: "Argentina", PE: "Peru", EC: "Ecuador", BR: "Brasil", UY: "Uruguay", PY: "Paraguay", BO: "Bolivia", VE: "Venezuela", CR: "Costa Rica", PA: "Panama", GT: "Guatemala", DO: "Rep. Dominicana",
};
const countryName = (code: string) => COUNTRY_NAMES[code] || code;
const countryFlag = (code: string) => {
  try { return String.fromCodePoint(...code.split("").map(c => 0x1F1E6 + c.charCodeAt(0) - 65)); } catch { return "🌍"; }
};

// ── Ads Manager links ──
const adsManagerLink = (type: string, id: string) => {
  const base = "https://adsmanager.facebook.com/adsmanager/manage";
  if (type === "campaign") return `${base}/campaigns?act=289250686730282&selected_campaign_ids=${id}`;
  if (type === "adset") return `${base}/adsets?act=289250686730282&selected_adset_ids=${id}`;
  if (type === "ad") return `${base}/ads?act=289250686730282&selected_ad_ids=${id}`;
  return `${base}/campaigns?act=289250686730282`;
};

// ── Components ──
function KPICard({ label, value, sub, color = "text-white", trend }: { label: string; value: string; sub?: string; color?: string; trend?: "up" | "down" | "flat" }) {
  const trendIcon = trend === "up" ? "↑" : trend === "down" ? "↓" : "";
  const trendColor = trend === "up" ? "text-green-400" : trend === "down" ? "text-red-400" : "";
  return (
    <div className="bg-gray-800/80 backdrop-blur rounded-xl p-4 border border-gray-700/50 hover:border-gray-600 transition-all">
      <p className="text-gray-400 text-xs mb-1 uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value} {trendIcon && <span className={`text-sm ${trendColor}`}>{trendIcon}</span>}</p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}

function ActionButton({ label, icon, color, onClick, loading }: { label: string; icon: string; color: string; onClick: () => void; loading?: boolean }) {
  return (
    <button onClick={onClick} disabled={loading} className={`${color} px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80 disabled:opacity-50 flex items-center gap-1`}>
      {loading ? <span className="animate-spin">⏳</span> : <span>{icon}</span>} {label}
    </button>
  );
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 hover:underline transition-colors inline-flex items-center gap-1">{children}<span className="text-xs">↗</span></a>;
}

function MiniBar({ value, max, color = "bg-blue-500" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden"><div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} /></div>;
}

function TrendChart({ data, dataKey, color = "#3b82f6", height = 60 }: { data: any[]; dataKey: string; color?: string; height?: number }) {
  if (!data.length) return null;
  const values = data.map(d => d[dataKey]);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const w = 100 / data.length;
  const points = values.map((v, i) => `${i * w + w / 2},${height - ((v - min) / range) * (height - 10) - 5}`).join(" ");
  return (
    <svg viewBox={`0 0 100 ${height}`} className="w-full" preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
      {values.map((v, i) => (
        <circle key={i} cx={i * w + w / 2} cy={height - ((v - min) / range) * (height - 10) - 5} r="1.5" fill={color} />
      ))}
    </svg>
  );
}

// ── Main Dashboard ──
export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"overview" | "campaigns" | "ads" | "countries" | "actions">("overview");
  const [actionLog, setActionLog] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [metaRes, trendsRes, countriesRes] = await Promise.all([
        fetch("/api/meta"), fetch("/api/meta/trends"), fetch("/api/meta/countries"),
      ]);
      const [metaData, trendsData, countriesData] = await Promise.all([
        metaRes.json(), trendsRes.json(), countriesRes.json(),
      ]);
      setData(metaData);
      setTrends(trendsData.trends || []);
      setCountries(countriesData.countries || []);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const executeAction = async (action: string, entityId: string, entityName: string, params?: any) => {
    setActionLoading(entityId + action);
    try {
      const res = await fetch("/api/meta/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, entityId, entityName, params }),
      });
      const result = await res.json();
      if (result.success) {
        setActionLog(prev => [{ ...result, time: new Date().toLocaleTimeString() }, ...prev]);
        setTimeout(fetchAll, 2000);
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (e: any) { alert(`Error: ${e.message}`); }
    setActionLoading(null);
  };

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 flex items-center justify-center">
      <div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" /><p className="text-gray-400">Conectando con Meta Ads...</p></div>
    </div>
  );
  if (error || !data) return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><p className="text-red-400">Error: {error}</p></div>;

  const d7 = data.last7d;
  const d30 = data.last30d;
  const dailySpend = (parseFloat(d7.spend) / 7).toFixed(2);
  const purchaseRate = parseFloat(d7.purchases) > 0 && parseFloat(d7.linkClicks) > 0 ? ((parseFloat(d7.purchases) / parseFloat(d7.linkClicks)) * 100).toFixed(1) : "0";
  const checkoutToSale = parseFloat(d7.purchases) > 0 && parseFloat(d7.checkouts) > 0 ? ((parseFloat(d7.purchases) / parseFloat(d7.checkouts)) * 100).toFixed(0) : "0";
  const sortedCampaigns = [...data.campaigns].sort((a: any, b: any) => parseFloat(b.spend) - parseFloat(a.spend));
  const sortedAds = [...data.ads].sort((a: any, b: any) => parseFloat(b.spend) - parseFloat(a.spend));
  const adsWithPurchases = sortedAds.filter((a: any) => parseInt(a.purchases) > 0).sort((a: any, b: any) => parseFloat(a.costPerPurchase) - parseFloat(b.costPerPurchase));
  const adsWasting = sortedAds.filter((a: any) => parseFloat(a.spend) > 10 && parseInt(a.purchases) === 0).sort((a: any, b: any) => parseFloat(b.spend) - parseFloat(a.spend));
  const totalWaste = adsWasting.reduce((sum: number, a: any) => sum + parseFloat(a.spend), 0);
  const maxCampaignSpend = Math.max(...sortedCampaigns.map((c: any) => parseFloat(c.spend)));

  // AI Recommendations
  const recommendations: any[] = [];
  adsWasting.slice(0, 3).forEach((ad: any) => {
    recommendations.push({ type: "danger", title: `Pausar "${ad.name}"`, desc: `$${parseFloat(ad.spend).toFixed(2)} gastados sin compras`, action: "pause", entityId: ad.id, entityName: ad.name });
  });
  adsWithPurchases.slice(0, 2).forEach((ad: any) => {
    if (parseFloat(ad.costPerPurchase) < parseFloat(d7.costPerPurchase) * 0.7) {
      recommendations.push({ type: "success", title: `Escalar "${ad.name}"`, desc: `CPA $${parseFloat(ad.costPerPurchase).toFixed(2)} — ${((1 - parseFloat(ad.costPerPurchase) / parseFloat(d7.costPerPurchase)) * 100).toFixed(0)}% mejor que promedio`, action: "scale", entityId: ad.id, entityName: ad.name });
    }
  });

  const tabs = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "campaigns", label: "Campañas", icon: "🎯" },
    { id: "ads", label: "Creativos", icon: "🎨" },
    { id: "countries", label: "Países", icon: "🌎" },
    { id: "actions", label: `Acciones ${actionLog.length > 0 ? `(${actionLog.length})` : ""}`, icon: "⚡" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 text-white">
      {/* Header */}
      <header className="bg-gray-800/50 backdrop-blur-xl border-b border-gray-700/50 px-6 py-3 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center font-bold text-sm">A</div>
            <div>
              <h1 className="text-lg font-bold">AKAL Ads Dashboard</h1>
              <p className="text-gray-400 text-xs">{data.account.name} · {data.account.currency} · Live</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ExternalLink href={adsManagerLink("account", "")}>Ads Manager</ExternalLink>
            <button onClick={fetchAll} className="bg-blue-600 hover:bg-blue-700 px-4 py-1.5 rounded-lg text-sm font-medium transition">Actualizar</button>
            <p className="text-gray-500 text-xs">{new Date(data.updatedAt).toLocaleTimeString("es-CL")}</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-4">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-800/50 p-1 rounded-xl w-fit">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? "bg-blue-600 shadow-lg shadow-blue-600/20" : "hover:bg-gray-700/50"}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ═══ OVERVIEW TAB ═══ */}
        {tab === "overview" && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
              <KPICard label="Gasto 7d" value={`$${parseFloat(d7.spend).toLocaleString("en-US", { minimumFractionDigits: 0 })}`} sub={`$${dailySpend}/día`} color="text-blue-400" />
              <KPICard label="Compras" value={d7.purchases} sub={`CPA: $${parseFloat(d7.costPerPurchase).toFixed(2)}`} color="text-green-400" trend={parseFloat(d7.costPerPurchase) < parseFloat(d30.costPerPurchase) ? "up" : "down"} />
              <KPICard label="CTR" value={`${parseFloat(d7.ctr).toFixed(2)}%`} sub={`CPC: $${parseFloat(d7.cpc).toFixed(2)}`} trend={parseFloat(d7.ctr) > parseFloat(d30.ctr) ? "up" : "down"} />
              <KPICard label="Checkouts" value={d7.checkouts} sub={`Cierre: ${checkoutToSale}%`} />
              <KPICard label="Mensajes" value={d7.messages} color="text-purple-400" />
              <KPICard label="Desperdicio" value={`$${totalWaste.toFixed(0)}`} sub={`${adsWasting.length} ads sin ventas`} color="text-red-400" />
            </div>

            {/* Trend Charts */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-800/60 rounded-xl p-4 border border-gray-700/50">
                <p className="text-xs text-gray-400 mb-2">Gasto Diario (14d)</p>
                <TrendChart data={trends} dataKey="spend" color="#3b82f6" />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>{trends[0]?.date?.slice(5)}</span><span>{trends[trends.length - 1]?.date?.slice(5)}</span>
                </div>
              </div>
              <div className="bg-gray-800/60 rounded-xl p-4 border border-gray-700/50">
                <p className="text-xs text-gray-400 mb-2">Compras Diarias (14d)</p>
                <TrendChart data={trends} dataKey="purchases" color="#22c55e" />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>{trends[0]?.date?.slice(5)}</span><span>{trends[trends.length - 1]?.date?.slice(5)}</span>
                </div>
              </div>
              <div className="bg-gray-800/60 rounded-xl p-4 border border-gray-700/50">
                <p className="text-xs text-gray-400 mb-2">CPA Diario (14d)</p>
                <TrendChart data={trends.filter(t => t.cpa > 0)} dataKey="cpa" color="#f59e0b" />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>{trends[0]?.date?.slice(5)}</span><span>{trends[trends.length - 1]?.date?.slice(5)}</span>
                </div>
              </div>
            </div>

            {/* Two columns: Recommendations + Top Countries */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              {/* AI Recommendations */}
              <div className="bg-gray-800/60 rounded-xl border border-gray-700/50 p-4">
                <h3 className="text-sm font-semibold text-yellow-400 mb-3">⚡ Recomendaciones</h3>
                {recommendations.length === 0 && <p className="text-gray-500 text-sm">Todo se ve bien por ahora</p>}
                {recommendations.map((rec, i) => (
                  <div key={i} className={`flex items-center justify-between p-3 rounded-lg mb-2 ${rec.type === "danger" ? "bg-red-500/10 border border-red-500/20" : "bg-green-500/10 border border-green-500/20"}`}>
                    <div>
                      <p className={`text-sm font-medium ${rec.type === "danger" ? "text-red-300" : "text-green-300"}`}>{rec.title}</p>
                      <p className="text-xs text-gray-400">{rec.desc}</p>
                    </div>
                    {rec.action === "pause" && (
                      <ActionButton label="Pausar" icon="⏸" color="bg-red-600" onClick={() => executeAction("pause", rec.entityId, rec.entityName)} loading={actionLoading === rec.entityId + "pause"} />
                    )}
                  </div>
                ))}
              </div>

              {/* Top Countries */}
              <div className="bg-gray-800/60 rounded-xl border border-gray-700/50 p-4">
                <h3 className="text-sm font-semibold text-blue-400 mb-3">🌎 Rendimiento por País (7d)</h3>
                <div className="space-y-2">
                  {countries.slice(0, 6).map((c: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-700/30">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{countryFlag(c.country)}</span>
                        <div>
                          <p className="text-sm font-medium">{countryName(c.country)}</p>
                          <p className="text-xs text-gray-400">${c.spend.toFixed(2)} · {c.purchases} compras</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${c.purchases > 0 ? "text-green-400" : "text-gray-500"}`}>
                          {c.purchases > 0 ? `$${c.cpa.toFixed(2)} CPA` : "Sin ventas"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Top Creatives */}
            {adsWithPurchases.length > 0 && (
              <div className="bg-gray-800/60 rounded-xl border border-gray-700/50 overflow-hidden mb-6">
                <div className="p-4 border-b border-gray-700/50"><h3 className="text-sm font-semibold text-green-400">🏆 Top Creativos por Ventas</h3></div>
                <table className="w-full text-sm">
                  <thead><tr className="text-gray-400 text-xs">
                    <th className="text-left p-3">Creativo</th><th className="text-right p-3">Compras</th><th className="text-right p-3">CPA</th><th className="text-right p-3">Spend</th><th className="text-right p-3">CTR</th><th className="text-right p-3">Link</th>
                  </tr></thead>
                  <tbody>
                    {adsWithPurchases.slice(0, 8).map((ad: any, i: number) => (
                      <tr key={i} className="border-t border-gray-700/30 hover:bg-gray-700/20">
                        <td className="p-3"><span className="font-medium">{ad.name}</span><br /><span className="text-gray-500 text-xs">{ad.adset}</span></td>
                        <td className="p-3 text-right text-green-400 font-bold">{ad.purchases}</td>
                        <td className="p-3 text-right">${parseFloat(ad.costPerPurchase).toFixed(2)}</td>
                        <td className="p-3 text-right">${parseFloat(ad.spend).toFixed(2)}</td>
                        <td className="p-3 text-right">{parseFloat(ad.ctr).toFixed(1)}%</td>
                        <td className="p-3 text-right"><a href={adsManagerLink("ad", ad.id)} target="_blank" className="text-blue-400 hover:text-blue-300">↗</a></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Waste */}
            {adsWasting.length > 0 && (
              <div className="bg-gray-800/60 rounded-xl border border-red-500/20 overflow-hidden">
                <div className="p-4 border-b border-gray-700/50 flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-red-400">🔥 Desperdicio: ${totalWaste.toFixed(2)} en ads sin ventas</h3>
                  <button onClick={() => { if (confirm(`¿Pausar los ${adsWasting.length} ads sin ventas?`)) { adsWasting.forEach(ad => executeAction("pause", ad.id, ad.name)); } }} className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-xs font-medium">Pausar todos</button>
                </div>
                <table className="w-full text-sm">
                  <thead><tr className="text-gray-400 text-xs">
                    <th className="text-left p-3">Ad</th><th className="text-right p-3">Spend</th><th className="text-right p-3">CTR</th><th className="text-right p-3">CPM</th><th className="p-3">Accion</th>
                  </tr></thead>
                  <tbody>
                    {adsWasting.slice(0, 8).map((ad: any, i: number) => (
                      <tr key={i} className="border-t border-gray-700/30 hover:bg-gray-700/20">
                        <td className="p-3"><span className="font-medium text-red-300">{ad.name}</span><br /><span className="text-gray-500 text-xs">{ad.campaign}</span></td>
                        <td className="p-3 text-right text-red-400 font-bold">${parseFloat(ad.spend).toFixed(2)}</td>
                        <td className="p-3 text-right">{parseFloat(ad.ctr).toFixed(1)}%</td>
                        <td className="p-3 text-right">${parseFloat(ad.cpm).toFixed(2)}</td>
                        <td className="p-3 text-right">
                          <ActionButton label="Pausar" icon="⏸" color="bg-red-600/80" onClick={() => executeAction("pause", ad.id, ad.name)} loading={actionLoading === ad.id + "pause"} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ═══ CAMPAIGNS TAB ═══ */}
        {tab === "campaigns" && (
          <div className="bg-gray-800/60 rounded-xl border border-gray-700/50 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-gray-400 text-xs border-b border-gray-700/50">
                <th className="text-left p-3">Campaña</th><th className="p-3">Spend</th><th className="text-right p-3">Compras</th><th className="text-right p-3">CPA</th><th className="text-right p-3">CTR</th><th className="text-right p-3">CPM</th><th className="p-3">Barra</th><th className="p-3">Acciones</th>
              </tr></thead>
              <tbody>
                {sortedCampaigns.map((c: any, i: number) => (
                  <tr key={i} className="border-t border-gray-700/30 hover:bg-gray-700/20">
                    <td className="p-3"><ExternalLink href={adsManagerLink("campaign", c.id)}>{c.name}</ExternalLink></td>
                    <td className="p-3 text-right font-medium">${parseFloat(c.spend).toFixed(2)}</td>
                    <td className="p-3 text-right">{parseInt(c.purchases) > 0 ? <span className="text-green-400 font-bold">{c.purchases}</span> : <span className="text-gray-600">0</span>}</td>
                    <td className="p-3 text-right">{parseFloat(c.costPerPurchase) > 0 ? `$${parseFloat(c.costPerPurchase).toFixed(2)}` : "-"}</td>
                    <td className="p-3 text-right">{parseFloat(c.ctr).toFixed(2)}%</td>
                    <td className="p-3 text-right">${parseFloat(c.cpm).toFixed(2)}</td>
                    <td className="p-3"><MiniBar value={parseFloat(c.spend)} max={maxCampaignSpend} color={parseInt(c.purchases) > 0 ? "bg-green-500" : "bg-red-500"} /></td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <ActionButton label="Pausar" icon="⏸" color="bg-yellow-600/80" onClick={() => executeAction("pause", c.id, c.name)} loading={actionLoading === c.id + "pause"} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ═══ ADS TAB ═══ */}
        {tab === "ads" && (
          <div className="bg-gray-800/60 rounded-xl border border-gray-700/50 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-gray-400 text-xs border-b border-gray-700/50">
                <th className="text-left p-3">Anuncio</th><th className="text-left p-3">Ad Set</th><th className="text-right p-3">Spend</th><th className="text-right p-3">Compras</th><th className="text-right p-3">CPA</th><th className="text-right p-3">CTR</th><th className="text-right p-3">Saves</th><th className="p-3">Accion</th>
              </tr></thead>
              <tbody>
                {sortedAds.map((a: any, i: number) => (
                  <tr key={i} className="border-t border-gray-700/30 hover:bg-gray-700/20">
                    <td className="p-3 max-w-xs"><ExternalLink href={adsManagerLink("ad", a.id)}>{a.name}</ExternalLink></td>
                    <td className="p-3 text-gray-400 text-xs max-w-[180px] truncate">{a.adset}</td>
                    <td className="p-3 text-right">${parseFloat(a.spend).toFixed(2)}</td>
                    <td className="p-3 text-right">{parseInt(a.purchases) > 0 ? <span className="text-green-400 font-bold">{a.purchases}</span> : <span className="text-gray-600">0</span>}</td>
                    <td className="p-3 text-right">{parseFloat(a.costPerPurchase) > 0 ? `$${parseFloat(a.costPerPurchase).toFixed(2)}` : "-"}</td>
                    <td className="p-3 text-right">{parseFloat(a.ctr).toFixed(1)}%</td>
                    <td className="p-3 text-right">{parseInt(a.saves) > 0 ? a.saves : "-"}</td>
                    <td className="p-3">
                      <ActionButton label="Pausar" icon="⏸" color="bg-yellow-600/80" onClick={() => executeAction("pause", a.id, a.name)} loading={actionLoading === a.id + "pause"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ═══ COUNTRIES TAB ═══ */}
        {tab === "countries" && (
          <div className="bg-gray-800/60 rounded-xl border border-gray-700/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="text-gray-400 text-xs border-b border-gray-700/50">
                <th className="text-left p-3">País</th><th className="text-right p-3">Spend</th><th className="text-right p-3">Compras</th><th className="text-right p-3">CPA</th><th className="text-right p-3">CTR</th><th className="text-right p-3">CPC</th><th className="text-right p-3">CPM</th><th className="text-right p-3">Clicks</th>
              </tr></thead>
              <tbody>
                {countries.map((c: any, i: number) => (
                  <tr key={i} className="border-t border-gray-700/30 hover:bg-gray-700/20">
                    <td className="p-3 font-medium">{countryFlag(c.country)} {countryName(c.country)}</td>
                    <td className="p-3 text-right font-medium">${c.spend.toFixed(2)}</td>
                    <td className="p-3 text-right">{c.purchases > 0 ? <span className="text-green-400 font-bold">{c.purchases}</span> : <span className="text-gray-600">0</span>}</td>
                    <td className="p-3 text-right">{c.cpa > 0 ? `$${c.cpa.toFixed(2)}` : "-"}</td>
                    <td className="p-3 text-right">{c.ctr.toFixed(2)}%</td>
                    <td className="p-3 text-right">${c.cpc.toFixed(2)}</td>
                    <td className="p-3 text-right">${c.cpm.toFixed(2)}</td>
                    <td className="p-3 text-right">{c.clicks.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ═══ ACTIONS LOG TAB ═══ */}
        {tab === "actions" && (
          <div className="bg-gray-800/60 rounded-xl border border-gray-700/50 p-4">
            <h3 className="text-sm font-semibold text-purple-400 mb-4">⚡ Historial de Acciones</h3>
            {actionLog.length === 0 && <p className="text-gray-500 text-sm">No se han ejecutado acciones aun. Pausa o activa entidades desde las otras pestañas.</p>}
            {actionLog.map((log, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg mb-2">
                <div>
                  <p className="text-sm font-medium">{log.action === "pause" ? "⏸ Pausado" : log.action === "activate" ? "▶ Activado" : "📝 " + log.action}: <span className="text-blue-300">{log.entityName}</span></p>
                  <p className="text-xs text-gray-400">{log.time} · ID: {log.entityId}</p>
                </div>
                {log.action === "pause" && (
                  <ActionButton label="Reactivar" icon="▶" color="bg-green-600" onClick={() => executeAction("activate", log.entityId, log.entityName)} loading={actionLoading === log.entityId + "activate"} />
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="text-center text-gray-600 text-xs py-4 border-t border-gray-800">
        AKAL Ads Dashboard · Datos en vivo de Meta Marketing API · Actualizado cada hora
      </footer>
    </div>
  );
}

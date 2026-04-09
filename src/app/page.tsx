"use client";
import { useEffect, useState } from "react";

interface MetaData {
  account: { name: string; id: string; currency: string; timezone: string; totalSpent: string };
  last7d: Record<string, string>;
  last30d: Record<string, string>;
  campaigns: any[];
  ads: any[];
  updatedAt: string;
}

function KPICard({ label, value, sub, color = "text-white" }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <p className="text-gray-400 text-sm mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<MetaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"kpis" | "campaigns" | "ads">("kpis");

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/meta");
      if (!res.ok) throw new Error("Error fetching data");
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-400">Cargando datos de Meta Ads...</p>
      </div>
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <p className="text-red-400">Error: {error}</p>
    </div>
  );

  const d7 = data.last7d;
  const d30 = data.last30d;
  const dailySpend = (parseFloat(d7.spend) / 7).toFixed(2);
  const purchaseRate = parseFloat(d7.purchases) > 0 && parseFloat(d7.linkClicks) > 0 ? ((parseFloat(d7.purchases) / parseFloat(d7.linkClicks)) * 100).toFixed(1) : "0";
  const checkoutToSale = parseFloat(d7.purchases) > 0 && parseFloat(d7.checkouts) > 0 ? ((parseFloat(d7.purchases) / parseFloat(d7.checkouts)) * 100).toFixed(0) : "0";

  const sortedCampaigns = [...data.campaigns].sort((a, b) => parseFloat(b.spend) - parseFloat(a.spend));
  const sortedAds = [...data.ads].sort((a, b) => parseFloat(b.spend) - parseFloat(a.spend));
  const adsWithPurchases = sortedAds.filter(a => parseInt(a.purchases) > 0).sort((a, b) => parseFloat(a.costPerPurchase) - parseFloat(b.costPerPurchase));
  const adsWasting = sortedAds.filter(a => parseFloat(a.spend) > 10 && parseInt(a.purchases) === 0).sort((a, b) => parseFloat(b.spend) - parseFloat(a.spend));

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">AKAL Ads Dashboard</h1>
            <p className="text-gray-400 text-sm">{data.account.name} &middot; {data.account.currency} &middot; {data.account.timezone}</p>
          </div>
          <div className="text-right">
            <button onClick={fetchData} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-medium transition">
              Actualizar
            </button>
            <p className="text-gray-500 text-xs mt-1">
              {new Date(data.updatedAt).toLocaleString("es-CL")}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex gap-2 mb-6">
          {(["kpis", "campaigns", "ads"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === t ? "bg-blue-600" : "bg-gray-800 hover:bg-gray-700"}`}>
              {t === "kpis" ? "KPIs Generales" : t === "campaigns" ? "Campanas" : "Creativos / Ads"}
            </button>
          ))}
        </div>

        {tab === "kpis" && (
          <>
            <h2 className="text-lg font-semibold mb-4 text-gray-300">Ultimos 7 Dias</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
              <KPICard label="Gasto Total" value={`$${parseFloat(d7.spend).toLocaleString("en-US", {minimumFractionDigits: 2})}`} sub={`$${dailySpend}/dia`} color="text-blue-400" />
              <KPICard label="Compras" value={d7.purchases} sub={`CPA: $${parseFloat(d7.costPerPurchase).toFixed(2)}`} color="text-green-400" />
              <KPICard label="Impresiones" value={parseInt(d7.impressions).toLocaleString()} sub={`CPM: $${parseFloat(d7.cpm).toFixed(2)}`} />
              <KPICard label="Alcance" value={parseInt(d7.reach).toLocaleString()} sub={`Freq: ${parseFloat(d7.frequency).toFixed(2)}`} />
              <KPICard label="CTR" value={`${parseFloat(d7.ctr).toFixed(2)}%`} sub={`CPC: $${parseFloat(d7.cpc).toFixed(2)}`} />
              <KPICard label="Link Clicks" value={parseInt(d7.linkClicks).toLocaleString()} sub={`Conv: ${purchaseRate}%`} />
              <KPICard label="Landing Views" value={parseInt(d7.landingPageViews).toLocaleString()} />
              <KPICard label="Checkouts" value={d7.checkouts} sub={`Cierre: ${checkoutToSale}%`} />
              <KPICard label="Registros" value={d7.registrations} />
              <KPICard label="Mensajes" value={d7.messages} />
              <KPICard label="Video Views" value={parseInt(d7.videoViews).toLocaleString()} />
              <KPICard label="Gasto 30d" value={`$${parseFloat(d30.spend).toLocaleString("en-US", {minimumFractionDigits: 2})}`} sub={`${d30.purchases} compras`} color="text-gray-300" />
            </div>

            <h2 className="text-lg font-semibold mb-4 text-gray-300">7d vs 30d</h2>
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden mb-8">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-700 text-gray-400">
                  <th className="text-left p-3">Metrica</th><th className="text-right p-3">7 Dias</th><th className="text-right p-3">30 Dias</th><th className="text-right p-3">Promedio/dia</th>
                </tr></thead>
                <tbody>
                  {[
                    ["Gasto", `$${parseFloat(d7.spend).toFixed(2)}`, `$${parseFloat(d30.spend).toFixed(2)}`, `$${dailySpend}`],
                    ["Compras", d7.purchases, d30.purchases, (parseFloat(d7.purchases)/7).toFixed(1)],
                    ["CPA", `$${parseFloat(d7.costPerPurchase).toFixed(2)}`, `$${parseFloat(d30.costPerPurchase).toFixed(2)}`, ""],
                    ["CTR", `${parseFloat(d7.ctr).toFixed(2)}%`, `${parseFloat(d30.ctr).toFixed(2)}%`, ""],
                    ["CPC", `$${parseFloat(d7.cpc).toFixed(2)}`, `$${parseFloat(d30.cpc).toFixed(2)}`, ""],
                    ["CPM", `$${parseFloat(d7.cpm).toFixed(2)}`, `$${parseFloat(d30.cpm).toFixed(2)}`, ""],
                  ].map(([label, v7, v30, daily], i) => (
                    <tr key={i} className="border-b border-gray-700/50">
                      <td className="p-3 font-medium">{label}</td>
                      <td className="p-3 text-right">{v7}</td>
                      <td className="p-3 text-right text-gray-400">{v30}</td>
                      <td className="p-3 text-right text-gray-500">{daily}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {adsWithPurchases.length > 0 && (
              <>
                <h2 className="text-lg font-semibold mb-4 text-green-400">Top Creativos por Ventas</h2>
                <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden mb-8">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-gray-700 text-gray-400">
                      <th className="text-left p-3">Creativo</th><th className="text-right p-3">Compras</th><th className="text-right p-3">CPA</th><th className="text-right p-3">Spend</th><th className="text-right p-3">CTR</th>
                    </tr></thead>
                    <tbody>
                      {adsWithPurchases.slice(0, 10).map((ad, i) => (
                        <tr key={i} className="border-b border-gray-700/50">
                          <td className="p-3"><span className="font-medium">{ad.name}</span><br/><span className="text-gray-500 text-xs">{ad.adset}</span></td>
                          <td className="p-3 text-right text-green-400 font-bold">{ad.purchases}</td>
                          <td className="p-3 text-right">${parseFloat(ad.costPerPurchase).toFixed(2)}</td>
                          <td className="p-3 text-right">${parseFloat(ad.spend).toFixed(2)}</td>
                          <td className="p-3 text-right">{parseFloat(ad.ctr).toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {adsWasting.length > 0 && (
              <>
                <h2 className="text-lg font-semibold mb-4 text-red-400">Desperdicio: Gasto sin compras (&gt;$10)</h2>
                <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-gray-700 text-gray-400">
                      <th className="text-left p-3">Creativo</th><th className="text-right p-3">Spend</th><th className="text-right p-3">Clicks</th><th className="text-right p-3">CTR</th><th className="text-right p-3">CPM</th>
                    </tr></thead>
                    <tbody>
                      {adsWasting.slice(0, 10).map((ad, i) => (
                        <tr key={i} className="border-b border-gray-700/50">
                          <td className="p-3"><span className="font-medium text-red-300">{ad.name}</span><br/><span className="text-gray-500 text-xs">{ad.campaign}</span></td>
                          <td className="p-3 text-right text-red-400 font-bold">${parseFloat(ad.spend).toFixed(2)}</td>
                          <td className="p-3 text-right">{ad.clicks}</td>
                          <td className="p-3 text-right">{parseFloat(ad.ctr).toFixed(1)}%</td>
                          <td className="p-3 text-right">${parseFloat(ad.cpm).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}

        {tab === "campaigns" && (
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-700 text-gray-400">
                <th className="text-left p-3">Campana</th><th className="text-right p-3">Spend</th><th className="text-right p-3">Compras</th><th className="text-right p-3">CPA</th><th className="text-right p-3">CTR</th><th className="text-right p-3">CPC</th><th className="text-right p-3">CPM</th><th className="text-right p-3">Reach</th>
              </tr></thead>
              <tbody>
                {sortedCampaigns.map((c, i) => (
                  <tr key={i} className="border-b border-gray-700/50">
                    <td className="p-3 font-medium max-w-xs truncate">{c.name}</td>
                    <td className="p-3 text-right">${parseFloat(c.spend).toFixed(2)}</td>
                    <td className="p-3 text-right">{parseInt(c.purchases) > 0 ? <span className="text-green-400 font-bold">{c.purchases}</span> : <span className="text-gray-500">0</span>}</td>
                    <td className="p-3 text-right">{parseFloat(c.costPerPurchase) > 0 ? `$${parseFloat(c.costPerPurchase).toFixed(2)}` : "-"}</td>
                    <td className="p-3 text-right">{parseFloat(c.ctr).toFixed(2)}%</td>
                    <td className="p-3 text-right">${parseFloat(c.cpc).toFixed(2)}</td>
                    <td className="p-3 text-right">${parseFloat(c.cpm).toFixed(2)}</td>
                    <td className="p-3 text-right">{parseInt(c.reach).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "ads" && (
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-700 text-gray-400">
                <th className="text-left p-3">Anuncio</th><th className="text-left p-3">Ad Set</th><th className="text-right p-3">Spend</th><th className="text-right p-3">Compras</th><th className="text-right p-3">CPA</th><th className="text-right p-3">CTR</th><th className="text-right p-3">Saves</th><th className="text-right p-3">Reactions</th>
              </tr></thead>
              <tbody>
                {sortedAds.map((a, i) => (
                  <tr key={i} className="border-b border-gray-700/50">
                    <td className="p-3 font-medium max-w-xs truncate">{a.name}</td>
                    <td className="p-3 text-gray-400 max-w-[200px] truncate text-xs">{a.adset}</td>
                    <td className="p-3 text-right">${parseFloat(a.spend).toFixed(2)}</td>
                    <td className="p-3 text-right">{parseInt(a.purchases) > 0 ? <span className="text-green-400 font-bold">{a.purchases}</span> : <span className="text-gray-500">0</span>}</td>
                    <td className="p-3 text-right">{parseFloat(a.costPerPurchase) > 0 ? `$${parseFloat(a.costPerPurchase).toFixed(2)}` : "-"}</td>
                    <td className="p-3 text-right">{parseFloat(a.ctr).toFixed(1)}%</td>
                    <td className="p-3 text-right">{parseInt(a.saves) > 0 ? a.saves : "-"}</td>
                    <td className="p-3 text-right">{parseInt(a.reactions) > 0 ? a.reactions : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      <footer className="text-center text-gray-600 text-xs py-6">
        AKAL Ads Dashboard &middot; Datos en vivo de Meta Marketing API
      </footer>
    </div>
  );
}

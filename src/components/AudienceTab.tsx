"use client";
import { useEffect, useState } from "react";

const fmtMoney = (v: number) => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (v: number) => `${v.toFixed(2)}%`;

function Badge({ text, color }: { text: string; color: string }) {
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>{text}</span>;
}

function Bar({ value, max, color = "bg-blue-500" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden"><div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} /></div>;
}

export default function AudienceTab() {
  const [data, setData] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<"demographics" | "geo" | "placement" | "time" | "suggestions">("demographics");
  const [datePreset, setDatePreset] = useState("last_7d");
  const [creatingAudience, setCreatingAudience] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [r1, r2] = await Promise.all([
          fetch(`/api/meta/audience?date_preset=${datePreset}`),
          fetch(`/api/meta/audience/suggestions`),
        ]);
        setData(await r1.json());
        setSuggestions(await r2.json());
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [datePreset]);

  const createAudience = async (action: string, params: any) => {
    setCreatingAudience(action);
    try {
      const r = await fetch("/api/meta/audience/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...params }),
      });
      const result = await r.json();
      if (result.success) alert(`✓ Audiencia creada: ${result.audienceId}`);
      else alert(`Error: ${result.error}`);
    } catch (e: any) { alert(e.message); }
    setCreatingAudience(null);
  };

  if (loading) return <div className="text-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4" /><p className="text-gray-400">Analizando audiencias...</p></div>;
  if (!data || data.error) return <div className="text-red-400 p-4">Error: {data?.error || "No data"}</div>;

  const d = data;
  const maxDemoSpend = Math.max(...(d.demographics || []).map((x: any) => x.spend), 1);
  const maxRegionSpend = Math.max(...(d.regions || []).map((x: any) => x.spend), 1);
  const maxHourSpend = Math.max(...(d.hourly || []).map((x: any) => x.spend), 1);

  const subTabs = [
    { id: "demographics", label: "Edad/Género", icon: "👥" },
    { id: "geo", label: "Regiones", icon: "🏙" },
    { id: "placement", label: "Placement", icon: "📱" },
    { id: "time", label: "Horarios", icon: "🕐" },
    { id: "suggestions", label: "Sugerencias", icon: "✨" },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-bold">🎯 Análisis de Audiencia</h3>
          <p className="text-gray-400 text-sm">ROAS {d.totals?.roas?.toFixed(2)}x · {fmtMoney(d.totals?.spend || 0)} → {fmtMoney(d.totals?.revenue || 0)}</p>
        </div>
        <div className="flex bg-gray-700/50 rounded-lg p-0.5 gap-0.5">
          {[{ id: "last_7d", l: "7d" }, { id: "last_14d", l: "14d" }, { id: "last_30d", l: "30d" }].map(x => (
            <button key={x.id} onClick={() => setDatePreset(x.id)} className={`px-3 py-1 rounded text-xs ${datePreset === x.id ? "bg-blue-600" : "hover:bg-gray-600"}`}>{x.l}</button>
          ))}
        </div>
      </div>

      {/* Recommendations Banner */}
      {d.recommendations?.length > 0 && (
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4 mb-4">
          <h4 className="text-sm font-semibold text-yellow-400 mb-2">⚡ Top Recomendaciones ({d.recommendations.length})</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {d.recommendations.slice(0, 6).map((r: any, i: number) => (
              <div key={i} className={`p-3 rounded-lg border text-xs ${r.type === "scale" ? "bg-green-500/10 border-green-500/20" : "bg-red-500/10 border-red-500/20"}`}>
                <p className={`font-medium ${r.type === "scale" ? "text-green-300" : "text-red-300"}`}>{r.icon} {r.title}</p>
                <p className="text-gray-400 mt-0.5">{r.desc}</p>
                <p className="text-gray-500 italic mt-1">→ {r.action}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-1 mb-4 bg-gray-800/50 p-1 rounded-xl w-fit">
        {subTabs.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id as any)} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${subTab === t.id ? "bg-blue-600" : "hover:bg-gray-700/50"}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── DEMOGRAPHICS ── */}
      {subTab === "demographics" && (
        <div className="space-y-4">
          <div className="bg-gray-800/60 rounded-xl border border-gray-700/50 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-gray-400 text-xs border-b border-gray-700/50">
                <th className="text-left p-3">Segmento</th><th className="text-right p-2">Spend</th><th className="text-right p-2">Compras</th><th className="text-right p-2">Revenue</th><th className="text-right p-2">CPA</th><th className="text-right p-2">ROAS</th><th className="text-right p-2">CTR</th><th className="p-2">Gasto relativo</th>
              </tr></thead>
              <tbody>
                {d.demographics.map((row: any, i: number) => {
                  const genderIcon = row.gender === "female" ? "👩" : row.gender === "male" ? "👨" : "•";
                  const roasColor = row.roas >= 1.5 ? "text-green-400" : row.roas >= 1 ? "text-yellow-400" : row.roas > 0 ? "text-red-400" : "text-gray-500";
                  return (
                    <tr key={i} className="border-t border-gray-700/30 hover:bg-gray-700/20">
                      <td className="p-3 font-medium">{genderIcon} {row.gender === "female" ? "Mujeres" : "Hombres"} {row.age}</td>
                      <td className="p-2 text-right">{fmtMoney(row.spend)}</td>
                      <td className="p-2 text-right">{row.purchases > 0 ? <span className="text-green-400 font-bold">{row.purchases}</span> : <span className="text-gray-600">0</span>}</td>
                      <td className="p-2 text-right">{fmtMoney(row.revenue)}</td>
                      <td className="p-2 text-right">{row.cpa > 0 ? fmtMoney(row.cpa) : "-"}</td>
                      <td className={`p-2 text-right font-bold ${roasColor}`}>{row.roas > 0 ? `${row.roas.toFixed(2)}x` : "-"}</td>
                      <td className="p-2 text-right">{fmtPct(row.ctr)}</td>
                      <td className="p-2 w-32"><Bar value={row.spend} max={maxDemoSpend} color={row.roas >= 1 ? "bg-green-500" : row.purchases === 0 && row.spend > 10 ? "bg-red-500" : "bg-blue-500"} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── GEO/REGIONS ── */}
      {subTab === "geo" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-gray-800/60 rounded-xl border border-gray-700/50 overflow-hidden">
            <div className="p-3 border-b border-gray-700/50"><h4 className="text-sm font-semibold text-green-400">🌟 Top Regiones (ROAS)</h4></div>
            <table className="w-full text-xs">
              <tbody>
                {d.topRegions?.map((r: any, i: number) => (
                  <tr key={i} className="border-t border-gray-700/30">
                    <td className="p-2.5 font-medium">{r.region}</td>
                    <td className="p-2.5 text-right">{fmtMoney(r.spend)}</td>
                    <td className="p-2.5 text-right text-green-400 font-bold">{r.purchases}</td>
                    <td className="p-2.5 text-right font-bold text-green-400">{r.roas.toFixed(2)}x</td>
                  </tr>
                ))}
                {(!d.topRegions || d.topRegions.length === 0) && <tr><td colSpan={4} className="p-4 text-center text-gray-500">Sin datos</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="bg-gray-800/60 rounded-xl border border-gray-700/50 overflow-hidden">
            <div className="p-3 border-b border-gray-700/50"><h4 className="text-sm font-semibold text-red-400">💀 Regiones sin compras</h4></div>
            <table className="w-full text-xs">
              <tbody>
                {d.wasteRegions?.map((r: any, i: number) => (
                  <tr key={i} className="border-t border-gray-700/30">
                    <td className="p-2.5 font-medium">{r.region}</td>
                    <td className="p-2.5 text-right text-red-400 font-bold">{fmtMoney(r.spend)}</td>
                    <td className="p-2.5 text-right">{fmtPct(r.ctr)}</td>
                    <td className="p-2.5 text-right">0 compras</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lg:col-span-2 bg-gray-800/60 rounded-xl border border-gray-700/50 overflow-x-auto">
            <div className="p-3 border-b border-gray-700/50"><h4 className="text-sm font-semibold">📋 Todas las regiones ({d.regions?.length || 0})</h4></div>
            <table className="w-full text-sm">
              <thead><tr className="text-gray-400 text-xs border-b border-gray-700/30">
                <th className="text-left p-2">Región</th><th className="text-right p-2">Spend</th><th className="text-right p-2">Impressions</th><th className="text-right p-2">Clicks</th><th className="text-right p-2">CTR</th><th className="text-right p-2">CPM</th><th className="text-right p-2">Compras</th><th className="text-right p-2">Revenue</th><th className="text-right p-2">ROAS</th><th className="p-2">Bar</th>
              </tr></thead>
              <tbody>
                {d.regions?.slice(0, 30).map((r: any, i: number) => (
                  <tr key={i} className="border-t border-gray-700/30 hover:bg-gray-700/20">
                    <td className="p-2 font-medium">{r.region}</td>
                    <td className="p-2 text-right">{fmtMoney(r.spend)}</td>
                    <td className="p-2 text-right">{r.impressions.toLocaleString()}</td>
                    <td className="p-2 text-right">{r.clicks}</td>
                    <td className="p-2 text-right">{fmtPct(r.ctr)}</td>
                    <td className="p-2 text-right">{fmtMoney(r.cpm)}</td>
                    <td className="p-2 text-right">{r.purchases > 0 ? <span className="text-green-400 font-bold">{r.purchases}</span> : <span className="text-gray-600">0</span>}</td>
                    <td className="p-2 text-right">{fmtMoney(r.revenue)}</td>
                    <td className={`p-2 text-right font-bold ${r.roas >= 1 ? "text-green-400" : r.roas > 0 ? "text-yellow-400" : "text-gray-500"}`}>{r.roas > 0 ? `${r.roas.toFixed(2)}x` : "-"}</td>
                    <td className="p-2 w-20"><Bar value={r.spend} max={maxRegionSpend} color={r.roas >= 1 ? "bg-green-500" : r.purchases === 0 && r.spend > 5 ? "bg-red-500" : "bg-blue-500"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── PLACEMENT ── */}
      {subTab === "placement" && (
        <div className="bg-gray-800/60 rounded-xl border border-gray-700/50 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-gray-400 text-xs border-b border-gray-700/50">
              <th className="text-left p-3">Placement</th><th className="text-right p-2">Spend</th><th className="text-right p-2">Impr</th><th className="text-right p-2">CTR</th><th className="text-right p-2">CPM</th><th className="text-right p-2">Compras</th><th className="text-right p-2">Revenue</th><th className="text-right p-2">ROAS</th><th className="p-2">Veredicto</th>
            </tr></thead>
            <tbody>
              {d.placement.map((p: any, i: number) => {
                const verdict = p.roas >= 1.5 ? { t: "ESCALAR", c: "bg-green-500/20 text-green-300" } : p.roas >= 1 ? { t: "MANTENER", c: "bg-blue-500/20 text-blue-300" } : p.purchases === 0 && p.spend > 10 ? { t: "EXCLUIR", c: "bg-red-500/20 text-red-300" } : { t: "MONITOREAR", c: "bg-gray-500/20 text-gray-300" };
                return (
                  <tr key={i} className="border-t border-gray-700/30 hover:bg-gray-700/20">
                    <td className="p-3 font-medium">{p.publisher_platform} · <span className="text-gray-400">{p.platform_position}</span></td>
                    <td className="p-2 text-right">{fmtMoney(p.spend)}</td>
                    <td className="p-2 text-right">{p.impressions.toLocaleString()}</td>
                    <td className="p-2 text-right">{fmtPct(p.ctr)}</td>
                    <td className="p-2 text-right">{fmtMoney(p.cpm)}</td>
                    <td className="p-2 text-right">{p.purchases > 0 ? <span className="text-green-400 font-bold">{p.purchases}</span> : "0"}</td>
                    <td className="p-2 text-right">{fmtMoney(p.revenue)}</td>
                    <td className={`p-2 text-right font-bold ${p.roas >= 1 ? "text-green-400" : p.roas > 0 ? "text-yellow-400" : "text-gray-500"}`}>{p.roas > 0 ? `${p.roas.toFixed(2)}x` : "-"}</td>
                    <td className="p-2"><Badge text={verdict.t} color={verdict.c} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── TIME ── */}
      {subTab === "time" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-gray-800/60 rounded-xl border border-gray-700/50 overflow-hidden">
            <div className="p-3 border-b border-gray-700/50"><h4 className="text-sm font-semibold">🕐 Gasto por hora</h4></div>
            <div className="p-4 space-y-1">
              {d.hourly?.map((h: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="w-12 text-gray-400 font-mono">{String(h.hour).padStart(2, "0")}h</span>
                  <div className="flex-1"><Bar value={h.spend} max={maxHourSpend} color={h.roas >= 1 ? "bg-green-500" : h.purchases === 0 && h.spend > 30 ? "bg-red-500" : "bg-blue-500"} /></div>
                  <span className="w-16 text-right">{fmtMoney(h.spend)}</span>
                  <span className="w-12 text-right font-bold">{h.purchases > 0 ? <span className="text-green-400">{h.purchases}✓</span> : <span className="text-gray-600">0</span>}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {d.bestHours?.length > 0 && (
              <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-green-400 mb-2">⭐ Mejores horas</h4>
                {d.bestHours.map((h: any, i: number) => (
                  <div key={i} className="flex justify-between text-xs py-1">
                    <span>{String(h.hour).padStart(2, "0")}:00 - {String(h.hour).padStart(2, "0")}:59</span>
                    <span className="text-green-400 font-bold">{h.roas.toFixed(2)}x · {h.purchases} compras</span>
                  </div>
                ))}
              </div>
            )}
            {d.worstHours?.length > 0 && (
              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-red-400 mb-2">💀 Horas sin compras (candidatas a cortar)</h4>
                {d.worstHours.map((h: any, i: number) => (
                  <div key={i} className="flex justify-between text-xs py-1">
                    <span>{String(h.hour).padStart(2, "0")}:00 - {String(h.hour).padStart(2, "0")}:59</span>
                    <span className="text-red-400 font-bold">{fmtMoney(h.spend)} desperdicio</span>
                  </div>
                ))}
              </div>
            )}
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-blue-400 mb-2">💡 Dayparting sugerido</h4>
              <p className="text-xs text-gray-400 mb-2">Crear ad schedule que solo corra estas horas:</p>
              {d.bestHours?.length > 0 ? (
                <p className="text-xs font-mono bg-gray-800 p-2 rounded">
                  {d.bestHours.map((h: any) => `${String(h.hour).padStart(2, "0")}h`).join(", ")}
                </p>
              ) : <p className="text-xs text-gray-500">Sin data suficiente</p>}
            </div>
          </div>
        </div>
      )}

      {/* ── SUGGESTIONS ── */}
      {subTab === "suggestions" && suggestions && (
        <div className="space-y-4">
          {/* Top Themes */}
          {suggestions.topThemes?.length > 0 && (
            <div className="bg-gray-800/60 rounded-xl border border-gray-700/50 p-4">
              <h4 className="text-sm font-semibold text-cyan-400 mb-3">🎯 Tus temas más fuertes en Instagram</h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {suggestions.topThemes.map((t: any, i: number) => (
                  <div key={i} className="bg-gray-700/30 rounded-lg p-3 text-center">
                    <p className="font-bold text-sm">{t.theme}</p>
                    <p className="text-yellow-400 text-xs mt-1">{t.score} saves totales</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Interest Stacks */}
          {suggestions.interestStacks?.length > 0 && (
            <div className="bg-gray-800/60 rounded-xl border border-gray-700/50 p-4">
              <h4 className="text-sm font-semibold text-purple-400 mb-3">🎨 Intereses recomendados por tema</h4>
              <div className="space-y-3">
                {suggestions.interestStacks.map((stack: any, i: number) => stack.interests?.length > 0 && (
                  <div key={i} className="border-l-2 border-purple-500/30 pl-3">
                    <p className="text-xs font-bold text-purple-300 mb-1">{stack.theme}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {stack.interests.map((int: any, j: number) => (
                        <span key={j} className="bg-gray-700/50 rounded px-2 py-0.5 text-xs">
                          {int.name} <span className="text-gray-500">({int.audience})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lookalike Suggestions */}
          {suggestions.lalSuggestions?.length > 0 && (
            <div className="bg-gray-800/60 rounded-xl border border-gray-700/50 p-4">
              <h4 className="text-sm font-semibold text-green-400 mb-3">💎 Lookalike Audiences recomendadas</h4>
              <div className="space-y-2">
                {suggestions.lalSuggestions.map((lal: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">{lal.source} → {lal.tier}</p>
                      <p className="text-xs text-gray-400">{lal.recommendation}</p>
                      <p className="text-xs text-gray-500">Tamaño: {lal.estimatedSize}</p>
                    </div>
                    <Badge text={lal.priority} color={lal.priority === "ALTA" ? "bg-red-500/20 text-red-300" : "bg-yellow-500/20 text-yellow-300"} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Custom Audience Recipes */}
          {suggestions.customAudienceRecipes?.length > 0 && (
            <div className="bg-gray-800/60 rounded-xl border border-gray-700/50 p-4">
              <h4 className="text-sm font-semibold text-yellow-400 mb-3">🛠 Audiencias Custom para crear</h4>
              <div className="space-y-2">
                {suggestions.customAudienceRecipes.map((rec: any, i: number) => {
                  const existing = suggestions.customAudiences?.find((a: any) => a.name.toLowerCase().includes(rec.name.toLowerCase().substring(0, 15)));
                  return (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{rec.name}</p>
                        <p className="text-xs text-gray-400">{rec.source} · {rec.days} días</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge text={rec.priority} color={rec.priority === "CRÍTICO" ? "bg-red-500/20 text-red-300" : rec.priority === "ALTA" ? "bg-orange-500/20 text-orange-300" : "bg-yellow-500/20 text-yellow-300"} />
                        {existing ? (
                          <span className="text-xs text-green-400">✓ Existe</span>
                        ) : rec.type === "IG_BUSINESS_PROFILE" ? (
                          <button onClick={() => createAudience("create_ig_engagers", { name: rec.name, retentionDays: rec.days })}
                            disabled={creatingAudience === "create_ig_engagers"}
                            className="bg-purple-600 hover:bg-purple-700 px-3 py-1 rounded text-xs disabled:opacity-50">
                            {creatingAudience === "create_ig_engagers" ? "..." : "+ Crear"}
                          </button>
                        ) : (
                          <a href="https://adsmanager.facebook.com/adsmanager/audiences?act=289250686730282" target="_blank" className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-xs">Crear en AM ↗</a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Existing Custom Audiences */}
          {suggestions.customAudiences?.length > 0 && (
            <div className="bg-gray-800/60 rounded-xl border border-gray-700/50 p-4">
              <h4 className="text-sm font-semibold text-gray-300 mb-3">📋 Tus audiencias actuales ({suggestions.customAudiences.length})</h4>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {suggestions.customAudiences.slice(0, 20).map((a: any, i: number) => (
                  <div key={i} className="flex justify-between text-xs p-2 bg-gray-700/20 rounded">
                    <span className="truncate flex-1">{a.name}</span>
                    <span className="text-gray-500 ml-2">{a.size}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

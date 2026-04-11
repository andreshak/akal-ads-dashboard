"use client";
import { useEffect, useState } from "react";

function Badge({ text, color }: { text: string; color: string }) {
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>{text}</span>;
}

function Bar({ value, max, color = "bg-blue-500" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden"><div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} /></div>;
}

export default function TrendsTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<"insights" | "top" | "ideas" | "adlibrary">("insights");
  const [ideas, setIdeas] = useState<any>(null);
  const [generatingIdeas, setGeneratingIdeas] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState("ALL");
  const [adLibraryQuery, setAdLibraryQuery] = useState("sanacion");
  const [adLibraryCountry, setAdLibraryCountry] = useState("CL");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await fetch("/api/meta/trends-analysis");
        setData(await r.json());
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  const generateIdeas = async () => {
    setGeneratingIdeas(true);
    try {
      const r = await fetch("/api/meta/generate-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: selectedTheme === "ALL" ? null : selectedTheme, count: 5 }),
      });
      setIdeas(await r.json());
    } catch (e: any) { alert(e.message); }
    setGeneratingIdeas(false);
  };

  if (loading) return <div className="text-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4" /><p className="text-gray-400">Analizando tendencias de tu biblioteca...</p></div>;
  if (!data || data.error) return <div className="text-red-400 p-4">Error: {data?.error || "No data"}</div>;

  const maxThemeSaves = Math.max(...data.themes.map((t: any) => t.avgSaves), 1);
  const maxHookSaves = Math.max(...data.hookPatterns.map((h: any) => h.avgSaves), 1);
  const maxDaySaves = Math.max(...data.dayOfWeek.map((d: any) => d.avgSaves), 1);

  const subTabs = [
    { id: "insights", label: "Insights", icon: "🔬" },
    { id: "top", label: "Top Virales", icon: "🔥" },
    { id: "ideas", label: "Generador Ideas", icon: "💡" },
    { id: "adlibrary", label: "Ad Library", icon: "🕵" },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-bold">📈 Tendencias y Analisis Viral</h3>
          <p className="text-gray-400 text-sm">{data.totalAnalyzed} posts analizados de tu biblioteca</p>
        </div>
      </div>

      <div className="flex gap-1 mb-5 bg-gray-800/50 p-1 rounded-xl w-fit">
        {subTabs.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id as any)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${subTab === t.id ? "bg-blue-600" : "hover:bg-gray-700/50"}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── INSIGHTS ── */}
      {subTab === "insights" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Themes Performance */}
          <div className="bg-gray-800/60 rounded-xl border border-gray-700/50 p-4">
            <h4 className="text-sm font-semibold text-cyan-400 mb-3">🏷 Tematicas Mas Fuertes</h4>
            <div className="space-y-2">
              {data.themes.slice(0, 10).map((t: any, i: number) => (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium">{t.theme}</span>
                    <span className="text-gray-400">{t.count} posts · <span className="text-yellow-400 font-bold">{t.avgSaves} saves avg</span></span>
                  </div>
                  <Bar value={t.avgSaves} max={maxThemeSaves} color={i === 0 ? "bg-green-500" : "bg-blue-500"} />
                  {t.topPost && <p className="text-[10px] text-gray-500 mt-1 truncate">Top: "{t.topPost.hook?.substring(0, 60)}"</p>}
                </div>
              ))}
            </div>
          </div>

          {/* Hook Patterns */}
          <div className="bg-gray-800/60 rounded-xl border border-gray-700/50 p-4">
            <h4 className="text-sm font-semibold text-purple-400 mb-3">🎣 Tipos de Hook (Top 100)</h4>
            <div className="space-y-2">
              {data.hookPatterns.map((h: any, i: number) => (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium">{h.type}</span>
                    <span className="text-gray-400">{h.count} posts · <span className="text-yellow-400 font-bold">{h.avgSaves} saves avg</span></span>
                  </div>
                  <Bar value={h.avgSaves} max={maxHookSaves} color={i === 0 ? "bg-green-500" : "bg-purple-500"} />
                  {h.examples?.[0] && <p className="text-[10px] text-gray-500 mt-1 truncate italic">"{h.examples[0].hook?.substring(0, 70)}"</p>}
                </div>
              ))}
            </div>
          </div>

          {/* Day of Week */}
          <div className="bg-gray-800/60 rounded-xl border border-gray-700/50 p-4">
            <h4 className="text-sm font-semibold text-green-400 mb-3">📅 Mejor dia para publicar</h4>
            <div className="space-y-2">
              {data.dayOfWeek.map((d: any, i: number) => (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium">{d.day}</span>
                    <span className="text-gray-400">{d.count} posts · <span className="text-yellow-400 font-bold">{d.avgSaves} saves</span></span>
                  </div>
                  <Bar value={d.avgSaves} max={maxDaySaves} color="bg-green-500" />
                </div>
              ))}
            </div>
          </div>

          {/* Top Words */}
          <div className="bg-gray-800/60 rounded-xl border border-gray-700/50 p-4">
            <h4 className="text-sm font-semibold text-yellow-400 mb-3">🔤 Palabras Virales en Top 100</h4>
            <div className="flex flex-wrap gap-2">
              {data.topWords.map((w: any, i: number) => (
                <span key={i} className="bg-yellow-500/10 border border-yellow-500/30 rounded-full px-3 py-1 text-xs" style={{ fontSize: `${Math.min(16, 10 + w.count / 2)}px` }}>
                  {w.word} <span className="text-gray-500">({w.count})</span>
                </span>
              ))}
            </div>
          </div>

          {/* Underexploited */}
          {data.underexploited?.length > 0 && (
            <div className="lg:col-span-2 bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-yellow-400 mb-3">💎 Oportunidades Subexplotadas</h4>
              <p className="text-xs text-gray-400 mb-3">Temas con alto engagement historico pero poca actividad reciente (ultimos 30 dias):</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {data.underexploited.map((u: any, i: number) => (
                  <div key={i} className="bg-gray-800/50 rounded-lg p-3">
                    <p className="font-bold text-sm">{u.theme}</p>
                    <p className="text-xs text-gray-400">{u.avgSaves} saves avg · Solo {data.recentThemes[u.theme] || 0} posts recientes</p>
                    <p className="text-xs text-gray-500 mt-1 italic">"{u.topPost?.hook?.substring(0, 60)}"</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TOP VIRALES ── */}
      {subTab === "top" && (
        <div className="space-y-4">
          {[
            { title: "💾 Top por Saves", data: data.topBySaves, key: "saves" },
            { title: "🔄 Top por Shares (virales)", data: data.topByShares, key: "shares" },
            { title: "👁 Top por Reach (mass reach)", data: data.topByReach, key: "reach" },
          ].map((section, si) => (
            <div key={si} className="bg-gray-800/60 rounded-xl border border-gray-700/50 overflow-hidden">
              <div className="p-3 border-b border-gray-700/50"><h4 className="text-sm font-semibold">{section.title}</h4></div>
              <table className="w-full text-xs">
                <thead><tr className="text-gray-500 text-[10px] border-b border-gray-700/30">
                  <th className="text-left p-2">Hook</th><th className="p-2">Tema</th><th className="text-right p-2">Saves</th><th className="text-right p-2">Shares</th><th className="text-right p-2">Reach</th><th className="text-right p-2">Eng%</th><th className="p-2">Link</th>
                </tr></thead>
                <tbody>
                  {section.data.slice(0, 10).map((p: any, i: number) => (
                    <tr key={i} className="border-t border-gray-700/20 hover:bg-gray-700/20">
                      <td className="p-2 max-w-xs truncate">{p.hook}</td>
                      <td className="p-2"><Badge text={p.theme || "?"} color="bg-gray-600/50 text-gray-300" /></td>
                      <td className="p-2 text-right text-yellow-400 font-bold">{p.saves}</td>
                      <td className="p-2 text-right text-cyan-400">{p.shares}</td>
                      <td className="p-2 text-right">{p.reach?.toLocaleString()}</td>
                      <td className="p-2 text-right">{p.engagement_rate}%</td>
                      <td className="p-2"><a href={p.permalink} target="_blank" className="text-blue-400">↗</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* ── GENERADOR DE IDEAS ── */}
      {subTab === "ideas" && (
        <div>
          <div className="bg-gray-800/60 rounded-xl border border-gray-700/50 p-4 mb-4">
            <h4 className="text-sm font-semibold mb-3">💡 Generador de Ideas Virales</h4>
            <p className="text-xs text-gray-400 mb-3">Basado en tus patrones probados + formulas virales del nicho salud/sanacion</p>
            <div className="flex gap-2 flex-wrap">
              <select value={selectedTheme} onChange={e => setSelectedTheme(e.target.value)} className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm">
                <option value="ALL">Todas las tematicas</option>
                {data.themes.slice(0, 15).map((t: any) => <option key={t.theme} value={t.theme}>{t.theme} ({t.avgSaves} saves avg)</option>)}
              </select>
              <button onClick={generateIdeas} disabled={generatingIdeas} className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                {generatingIdeas ? "Generando..." : "⚡ Generar 8 Ideas"}
              </button>
            </div>
          </div>

          {ideas && (
            <>
              {/* Pattern Analysis */}
              <div className="bg-gray-800/60 rounded-xl border border-gray-700/50 p-4 mb-4">
                <h4 className="text-sm font-semibold text-cyan-400 mb-2">🔬 Patrones detectados</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-gray-400 mb-1">Palabras ganadoras (de tus top posts):</p>
                    <div className="flex flex-wrap gap-1">
                      {ideas.winningWords?.slice(0, 10).map((w: string, i: number) => (
                        <span key={i} className="bg-yellow-500/10 border border-yellow-500/30 rounded px-2 py-0.5">{w}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-gray-400 mb-1">Hooks de referencia:</p>
                    {ideas.sampleTopHooks?.slice(0, 3).map((h: string, i: number) => (
                      <p key={i} className="italic text-gray-500 text-[11px] border-l-2 border-cyan-500/30 pl-2 mb-1">"{h}"</p>
                    ))}
                  </div>
                </div>
              </div>

              {/* Generated Ideas */}
              <div className="space-y-3">
                {ideas.ideas?.map((idea: any, i: number) => (
                  <div key={i} className="bg-gray-800/60 rounded-xl border border-gray-700/50 p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-purple-300">#{i + 1} {idea.formulaName}</span>
                          <Badge text="FORMULA" color="bg-purple-500/20 text-purple-300" />
                        </div>
                        <p className="text-xs text-gray-400 italic">Estructura: {idea.structure}</p>
                      </div>
                    </div>

                    <div className="mb-3">
                      <p className="text-xs text-green-400 font-semibold mb-1">🎣 Hook sugeridos:</p>
                      {idea.hookIdeas?.map((h: string, j: number) => (
                        <p key={j} className="text-sm pl-3 border-l-2 border-green-500/30 mb-1">"{h}"</p>
                      ))}
                    </div>

                    <div className="bg-gray-900/40 rounded-lg p-3">
                      <p className="text-xs text-blue-400 font-semibold mb-2">📝 Outline del guion:</p>
                      {idea.scriptOutline?.map((line: string, j: number) => (
                        <p key={j} className="text-xs text-gray-300 mb-1">{line}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {ideas.guidelines && (
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 mt-4">
                  <h4 className="text-sm font-semibold text-blue-400 mb-2">💡 Tips de produccion</h4>
                  {ideas.guidelines.map((g: string, i: number) => <p key={i} className="text-xs text-gray-400 mb-1">• {g}</p>)}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── AD LIBRARY ── */}
      {subTab === "adlibrary" && (
        <div>
          <div className="bg-gray-800/60 rounded-xl border border-gray-700/50 p-4 mb-4">
            <h4 className="text-sm font-semibold mb-2">🕵 Meta Ad Library</h4>
            <p className="text-xs text-gray-400 mb-3">La Ad Library API requiere autorizacion especial (proceso de 2-5 dias en Meta). Mientras tanto, puedes consultar la Ad Library publica aqui mismo.</p>
            <div className="flex gap-2 flex-wrap">
              <input value={adLibraryQuery} onChange={e => setAdLibraryQuery(e.target.value)} placeholder="Buscar: sanacion, cancer, masterclass..." className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm" />
              <select value={adLibraryCountry} onChange={e => setAdLibraryCountry(e.target.value)} className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm">
                <option value="CL">Chile</option>
                <option value="MX">Mexico</option>
                <option value="CO">Colombia</option>
                <option value="ES">España</option>
                <option value="US">USA</option>
                <option value="AR">Argentina</option>
                <option value="PE">Peru</option>
              </select>
              <a href={`https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${adLibraryCountry}&q=${encodeURIComponent(adLibraryQuery)}&sort_data[direction]=desc&sort_data[mode]=relevancy_monthly_grouped`} target="_blank" className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg text-sm font-medium">🔍 Buscar ↗</a>
            </div>
          </div>

          <div className="bg-gray-800/60 rounded-xl border border-gray-700/50 overflow-hidden">
            <div className="p-3 border-b border-gray-700/50 flex justify-between items-center">
              <h4 className="text-sm font-semibold">📊 Enlaces Rapidos a Ad Library</h4>
              <a href="https://www.facebook.com/ads/library" target="_blank" className="text-xs text-blue-400 hover:text-blue-300">Ir a Ad Library ↗</a>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { title: "Competidores Salud/Sanacion", queries: ["sanacion", "medicina natural", "salud holistica", "coach de salud"] },
                { title: "Masterclasses / Cursos", queries: ["masterclass salud", "curso sanacion", "programa bienestar", "webinar gratis"] },
                { title: "Nicho Cancer / Inflamacion", queries: ["cancer natural", "antiinflamatorio", "enfermedad cronica", "dolor cronico"] },
                { title: "Desarrollo Personal / Mente", queries: ["inconsciente", "psicosomatica", "biodescodificacion", "PNL"] },
              ].map((cat, ci) => (
                <div key={ci} className="bg-gray-700/30 rounded-lg p-3">
                  <p className="text-sm font-bold mb-2">{cat.title}</p>
                  <div className="flex flex-wrap gap-1">
                    {cat.queries.map((q, qi) => (
                      <a key={qi} href={`https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${adLibraryCountry}&q=${encodeURIComponent(q)}`} target="_blank" className="bg-blue-500/10 border border-blue-500/30 rounded px-2 py-1 text-xs hover:bg-blue-500/20">
                        {q} ↗
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 mt-4">
            <h4 className="text-sm font-semibold text-blue-400 mb-2">💡 Como usar esto</h4>
            <ol className="text-xs text-gray-400 space-y-1 list-decimal ml-4">
              <li>Click en cualquier query para abrir Ad Library con ese filtro</li>
              <li>Anota las paginas/creadores que mas aparecen (esos son tus competidores reales)</li>
              <li>Filtra por "Active" para ver solo ads corriendo ahora</li>
              <li>Mira que copy usan, que CTAs, que formatos (video vs imagen)</li>
              <li>Fijate en los ads que llevan corriendo meses - esos son ganadores probados</li>
              <li>Replica los patrones exitosos adaptados a tu voz de marca</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

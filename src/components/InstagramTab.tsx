"use client";
import { useEffect, useState, useCallback } from "react";

const SORT_OPTIONS = [
  { id: "saves", label: "Saves", icon: "💾" },
  { id: "engagement", label: "Engagement %", icon: "📊" },
  { id: "reach", label: "Alcance", icon: "👁" },
  { id: "shares", label: "Shares", icon: "🔄" },
  { id: "recent", label: "Más reciente", icon: "🕐" },
];

const AD_POTENTIAL_OPTIONS = [
  { id: "ALL", label: "Todos" },
  { id: "ESTRELLA", label: "⭐ Estrella", color: "text-green-400" },
  { id: "ALTO", label: "🔥 Alto", color: "text-blue-400" },
  { id: "MEDIO", label: "👍 Medio", color: "text-yellow-400" },
  { id: "BAJO", label: "📉 Bajo", color: "text-gray-400" },
];

function Badge({ text, color }: { text: string; color: string }) {
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>{text}</span>;
}

export default function InstagramTab({ adModal, setAdModal, CTA_OPTIONS, actionLoading }: any) {
  const [posts, setPosts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [themeCounts, setThemeCounts] = useState<Record<string, number>>({});
  const [ctaCounts, setCtaCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  // Filters
  const [sortBy, setSortBy] = useState("saves");
  const [themeFilter, setThemeFilter] = useState("ALL");
  const [ctaFilter, setCtaFilter] = useState("ALL");
  const [adFilter, setAdFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(0);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const PAGE_SIZE = 50;

  const fetchLibrary = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        sort: sortBy,
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });
      if (themeFilter !== "ALL") params.set("theme", themeFilter);
      if (ctaFilter !== "ALL") params.set("cta", ctaFilter);
      if (adFilter === "AD_READY") params.set("ad_only", "true");
      if (search) params.set("search", search);

      const res = await fetch(`/api/meta/instagram/library?${params}`);
      const data = await res.json();
      setPosts(data.posts || []);
      setTotal(data.total || 0);
      if (data.themeCounts) setThemeCounts(data.themeCounts);
      if (data.ctaCounts) setCtaCounts(data.ctaCounts);
    } catch (e: any) {
      console.error(e);
    }
    setLoading(false);
  }, [sortBy, themeFilter, ctaFilter, adFilter, search, page]);

  useEffect(() => { fetchLibrary(); }, [fetchLibrary]);

  const syncIG = async (full: boolean) => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/meta/instagram/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullSync: full }),
      });
      const data = await res.json();
      setSyncResult(data);
      fetchLibrary();
    } catch (e: any) {
      setSyncResult({ error: e.message });
    }
    setSyncing(false);
  };

  const updatePost = async (id: string, updates: any) => {
    try {
      await fetch("/api/meta/instagram/library", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      setPosts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    } catch (e: any) {
      console.error(e);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const themes = Object.entries(themeCounts).sort((a, b) => b[1] - a[1]);
  const ctas = Object.entries(ctaCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div>
      {/* Ad Modal */}
      {adModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setAdModal(null)}>
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold mb-1">🚀 Crear Publicidad</h3>
            <p className="text-gray-400 text-xs mb-3 truncate">{adModal.hook}</p>
            <div className="bg-gray-700/30 rounded-lg p-3 mb-4 text-xs">
              <p>Reach: {adModal.reach?.toLocaleString()} · Saves: {adModal.saves} · Eng: {adModal.engagement_rate || adModal.engagementRate}%</p>
            </div>
            <div className="space-y-2 mb-4">
              <a href={adModal.permalink} target="_blank" className="block w-full bg-blue-600 hover:bg-blue-700 px-4 py-3 rounded-lg text-sm font-medium text-center">📸 Boost desde Instagram ↗</a>
              <a href="https://adsmanager.facebook.com/adsmanager/manage/ads?act=289250686730282" target="_blank" className="block w-full bg-purple-600 hover:bg-purple-700 px-4 py-3 rounded-lg text-sm font-medium text-center">🎯 Crear en Ads Manager ↗</a>
            </div>
            <div className="text-xs text-gray-400 mb-3">
              <p className="font-medium text-gray-300 mb-1">📋 En Ads Manager:</p>
              <p>1. Selecciona campaña → 2. En "Ad": "Usar publicacion existente" → 3. Busca por fecha: {(adModal.published_at || adModal.date)?.substring(0, 10)}</p>
            </div>
            <button onClick={() => setAdModal(null)} className="w-full py-2 bg-gray-700 rounded-lg text-sm">Cerrar</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl">📸</span>
          <div>
            <p className="font-bold text-lg">Biblioteca de Contenido</p>
            <p className="text-gray-400 text-sm">{total.toLocaleString()} posts indexados · Supabase</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => syncIG(false)} disabled={syncing} className="bg-purple-600 hover:bg-purple-700 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50">
            {syncing ? "⏳ Sincronizando..." : "🔄 Sync recientes"}
          </button>
          <button onClick={() => syncIG(true)} disabled={syncing} className="bg-gray-600 hover:bg-gray-700 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50">
            📜 Sync completo
          </button>
          <button onClick={() => { setSearch(""); setSearchInput(""); setThemeFilter("ALL"); setCtaFilter("ALL"); setAdFilter("ALL"); setSortBy("saves"); setPage(0); }} className="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-xs">✕ Reset</button>
        </div>
      </div>

      {/* Sync result */}
      {syncResult && (
        <div className={`rounded-lg p-3 mb-4 text-sm ${syncResult.error ? "bg-red-500/10 border border-red-500/20" : "bg-green-500/10 border border-green-500/20"}`}>
          {syncResult.error ? <p className="text-red-300">Error: {syncResult.error}</p> : <p className="text-green-300">✅ Sincronizados: {syncResult.totalSynced} posts · Total en base: {syncResult.totalInDatabase} · {syncResult.hasMore ? "Hay más por cargar" : "Completo"}</p>}
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-gray-800/60 rounded-xl border border-gray-700/50 p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {/* Search */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">🔍 Buscar en caption</label>
            <div className="flex gap-1">
              <input value={searchInput} onChange={e => setSearchInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { setSearch(searchInput); setPage(0); } }}
                className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm" placeholder="cancer, agua, sanar..." />
              <button onClick={() => { setSearch(searchInput); setPage(0); }} className="bg-blue-600 px-3 rounded-lg text-xs">Ir</button>
            </div>
          </div>

          {/* Sort */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">📊 Ordenar por</label>
            <select value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(0); }} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm">
              {SORT_OPTIONS.map(s => <option key={s.id} value={s.id}>{s.icon} {s.label}</option>)}
            </select>
          </div>

          {/* Theme Filter */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">🏷 Temática</label>
            <select value={themeFilter} onChange={e => { setThemeFilter(e.target.value); setPage(0); }} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm">
              <option value="ALL">Todas ({total})</option>
              {themes.map(([t, c]) => <option key={t} value={t}>{t} ({c})</option>)}
            </select>
          </div>

          {/* CTA Filter */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">🎯 CTA</label>
            <select value={ctaFilter} onChange={e => { setCtaFilter(e.target.value); setPage(0); }} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm">
              <option value="ALL">Todos los CTA</option>
              {CTA_OPTIONS.map((c: any) => <option key={c.id} value={c.id}>{c.label} ({ctaCounts[c.id] || 0})</option>)}
              <option value="">Sin CTA</option>
            </select>
          </div>

          {/* Ad Potential */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">⭐ Potencial Ad</label>
            <select value={adFilter} onChange={e => { setAdFilter(e.target.value); setPage(0); }} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm">
              {AD_POTENTIAL_OPTIONS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
              <option value="AD_READY">🚀 Marcados para Ad</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results info + pagination top */}
      <div className="flex justify-between items-center mb-3">
        <p className="text-gray-400 text-sm">
          {loading ? "Cargando..." : `${total} resultados · Página ${page + 1} de ${totalPages || 1}`}
        </p>
        {totalPages > 1 && (
          <div className="flex gap-1">
            <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="bg-gray-700 px-3 py-1 rounded text-xs disabled:opacity-30">← Anterior</button>
            <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="bg-gray-700 px-3 py-1 rounded text-xs disabled:opacity-30">Siguiente →</button>
          </div>
        )}
      </div>

      {/* Posts Table */}
      <div className="bg-gray-800/60 rounded-xl border border-gray-700/50 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-xs border-b border-gray-700/50">
              <th className="text-left p-3 min-w-[300px]">Contenido</th>
              <th className="p-2 cursor-pointer hover:text-white" onClick={() => { setSortBy("saves"); setPage(0); }}>💾 Saves {sortBy === "saves" && "▼"}</th>
              <th className="p-2 cursor-pointer hover:text-white" onClick={() => { setSortBy("shares"); setPage(0); }}>🔄 Shares {sortBy === "shares" && "▼"}</th>
              <th className="p-2 cursor-pointer hover:text-white" onClick={() => { setSortBy("reach"); setPage(0); }}>👁 Reach {sortBy === "reach" && "▼"}</th>
              <th className="p-2 cursor-pointer hover:text-white" onClick={() => { setSortBy("engagement"); setPage(0); }}>📊 Eng% {sortBy === "engagement" && "▼"}</th>
              <th className="p-2">❤ Likes</th>
              <th className="p-2">💬 Comm</th>
              <th className="p-2">🏷 Tema</th>
              <th className="p-2">🎯 CTA</th>
              <th className="p-2">⭐</th>
              <th className="p-2">🚀 Ad</th>
              <th className="p-2">Link</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((p: any, i: number) => {
              const potColor = p.ad_potential === "ESTRELLA" ? "text-green-400" : p.ad_potential === "ALTO" ? "text-blue-400" : p.ad_potential === "MEDIO" ? "text-yellow-400" : "text-gray-500";
              const isExpanded = expandedPost === p.id;
              return (
                <tr key={p.id} className={`border-t border-gray-700/30 hover:bg-gray-700/20 ${p.marked_for_ad ? "bg-green-500/5" : ""}`}>
                  <td className="p-3 max-w-xs">
                    <p className={`font-medium text-sm ${isExpanded ? "" : "truncate"} cursor-pointer`} onClick={() => setExpandedPost(isExpanded ? null : p.id)}>
                      {p.hook || p.caption?.substring(0, 100)}
                    </p>
                    {isExpanded && <p className="text-gray-400 text-xs mt-2 whitespace-pre-wrap max-h-40 overflow-y-auto">{p.caption}</p>}
                    <p className="text-gray-500 text-xs mt-0.5">{p.published_at?.substring(0, 10)} · {p.media_type}</p>
                    {p.notes && <p className="text-yellow-400/70 text-xs mt-0.5">📝 {p.notes}</p>}
                  </td>
                  <td className="p-2 text-center font-bold text-yellow-400">{p.saves || 0}</td>
                  <td className="p-2 text-center text-cyan-400">{p.shares || 0}</td>
                  <td className="p-2 text-center">{(p.reach || 0).toLocaleString()}</td>
                  <td className="p-2 text-center font-bold">{p.engagement_rate || 0}%</td>
                  <td className="p-2 text-center">{p.likes || 0}</td>
                  <td className="p-2 text-center">{p.comments || 0}</td>
                  <td className="p-2"><Badge text={p.theme || "?"} color="bg-gray-600/50 text-gray-300" /></td>
                  <td className="p-2">
                    <select value={p.cta_category || ""} onChange={e => updatePost(p.id, { cta_category: e.target.value || null })}
                      className="bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-[10px] w-[75px]">
                      <option value="">-</option>
                      {CTA_OPTIONS.map((c: any) => <option key={c.id} value={c.id}>{c.id}</option>)}
                    </select>
                  </td>
                  <td className="p-2 text-center"><span className={`text-xs font-bold ${potColor}`}>{p.ad_potential === "ESTRELLA" ? "⭐" : p.ad_potential === "ALTO" ? "🔥" : p.ad_potential === "MEDIO" ? "👍" : "·"}</span></td>
                  <td className="p-2 text-center">
                    <input type="checkbox" checked={p.marked_for_ad || false} onChange={e => updatePost(p.id, { marked_for_ad: e.target.checked })} className="rounded" />
                  </td>
                  <td className="p-2">
                    <div className="flex gap-1">
                      <button onClick={() => setAdModal(p)} className="text-blue-400 hover:text-blue-300 text-xs">🚀</button>
                      <a href={p.permalink} target="_blank" className="text-blue-400 hover:text-blue-300 text-xs">↗</a>
                    </div>
                  </td>
                </tr>
              );
            })}
            {posts.length === 0 && !loading && (
              <tr><td colSpan={12} className="p-8 text-center text-gray-500">
                {total === 0 ? "No hay posts. Haz click en 'Sync completo' para cargar tu contenido." : "No hay resultados con estos filtros."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination bottom */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-4">
          <button onClick={() => setPage(0)} disabled={page === 0} className="bg-gray-700 px-3 py-1.5 rounded text-xs disabled:opacity-30">Primera</button>
          <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="bg-gray-700 px-3 py-1.5 rounded text-xs disabled:opacity-30">← Anterior</button>
          <span className="text-gray-400 text-sm">Pág {page + 1} de {totalPages}</span>
          <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="bg-gray-700 px-3 py-1.5 rounded text-xs disabled:opacity-30">Siguiente →</button>
          <button onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1} className="bg-gray-700 px-3 py-1.5 rounded text-xs disabled:opacity-30">Última</button>
        </div>
      )}
    </div>
  );
}

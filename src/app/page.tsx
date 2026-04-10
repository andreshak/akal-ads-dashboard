"use client";
import { useEffect, useState, useCallback } from "react";
import InstagramTab from "@/components/InstagramTab";
import AudienceTab from "@/components/AudienceTab";

// ── Constants ──
const COUNTRY_NAMES: Record<string, string> = { CL:"Chile",MX:"Mexico",CO:"Colombia",ES:"España",US:"USA",AR:"Argentina",PE:"Peru",EC:"Ecuador",BR:"Brasil",UY:"Uruguay",PY:"Paraguay",DO:"Rep.Dom",CR:"Costa Rica",PA:"Panama",GT:"Guatemala" };
const cn = (code: string) => COUNTRY_NAMES[code] || code;
const cf = (code: string) => { try { return String.fromCodePoint(...code.split("").map(c => 0x1F1E6 + c.charCodeAt(0) - 65)); } catch { return "🌍"; } };
const adsMgr = (type: string, id: string) => `https://adsmanager.facebook.com/adsmanager/manage/${type}s?act=289250686730282&selected_${type}_ids=${id}`;
const fmtMoney = (v: string | number) => `$${parseFloat(String(v)).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const fmtPct = (v: string | number) => `${parseFloat(String(v)).toFixed(2)}%`;
const fmtInt = (v: string | number) => parseInt(String(v)).toLocaleString();
const STAGE_COLORS: Record<string, string> = { TOFU:"bg-blue-500/20 text-blue-300",MOFU:"bg-yellow-500/20 text-yellow-300",BOFU:"bg-green-500/20 text-green-300",RETARGETING:"bg-purple-500/20 text-purple-300",OTROS:"bg-gray-500/20 text-gray-300" };
const STATUS_COLORS: Record<string, string> = { ESTRELLA:"bg-green-500/20 text-green-300 border-green-500/30",BUENO:"bg-blue-500/20 text-blue-300 border-blue-500/30",CARO:"bg-orange-500/20 text-orange-300 border-orange-500/30",MUERTO:"bg-red-500/20 text-red-300 border-red-500/30",POTENCIAL:"bg-cyan-500/20 text-cyan-300 border-cyan-500/30",EN_PRUEBA:"bg-yellow-500/20 text-yellow-300 border-yellow-500/30",NUEVO:"bg-gray-500/20 text-gray-300 border-gray-500/30",UNKNOWN:"bg-gray-500/20 text-gray-300 border-gray-500/30" };
const STATUS_ICONS: Record<string, string> = { ESTRELLA:"⭐",BUENO:"✅",CARO:"💸",MUERTO:"💀",POTENCIAL:"🔍",EN_PRUEBA:"🧪",NUEVO:"🆕",UNKNOWN:"❓" };
const DATE_PRESETS = [{id:"today",label:"Hoy"},{id:"yesterday",label:"Ayer"},{id:"last_7d",label:"7 días"},{id:"last_14d",label:"14 días"},{id:"last_30d",label:"30 días"},{id:"this_month",label:"Este mes"},{id:"last_month",label:"Mes anterior"}];

// ── Components ──
function KPI({label,value,sub,color="text-white",trend}:{label:string;value:string;sub?:string;color?:string;trend?:"up"|"down"|null}) {
  return (<div className="bg-gray-800/80 rounded-xl p-4 border border-gray-700/50 hover:border-gray-600/50 transition"><p className="text-gray-400 text-xs uppercase tracking-wider mb-1">{label}</p><p className={`text-xl font-bold ${color}`}>{value}{trend && <span className={`text-sm ml-1 ${trend==="up"?"text-green-400":"text-red-400"}`}>{trend==="up"?"↑":"↓"}</span>}</p>{sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}</div>);
}
function Badge({text,color}:{text:string;color:string}) { return <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>{text}</span>; }
function Btn({label,icon,color,onClick,loading,small}:{label:string;icon:string;color:string;onClick:()=>void;loading?:boolean;small?:boolean}) {
  return <button onClick={onClick} disabled={loading} className={`${color} ${small?"px-2 py-1 text-xs":"px-3 py-1.5 text-xs"} rounded-lg font-medium transition hover:opacity-80 disabled:opacity-50 flex items-center gap-1`}>{loading?<span className="animate-spin">⏳</span>:<span>{icon}</span>}{label}</button>;
}
function ExtLink({href,children}:{href:string;children:React.ReactNode}) { return <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 hover:underline transition inline-flex items-center gap-1">{children}<span className="text-[10px]">↗</span></a>; }
function MiniChart({data,dataKey,color="#3b82f6",h=50}:{data:any[];dataKey:string;color?:string;h?:number}) {
  if(!data.length)return null;const vals=data.map(d=>d[dataKey]);const max=Math.max(...vals);const min=Math.min(...vals);const r=max-min||1;const w=100/data.length;
  const pts=vals.map((v,i)=>`${i*w+w/2},${h-((v-min)/r)*(h-10)-5}`).join(" ");
  return <svg viewBox={`0 0 100 ${h}`} className="w-full" preserveAspectRatio="none"><polyline fill="none" stroke={color} strokeWidth="1.5" points={pts}/>{vals.map((v,i)=><circle key={i} cx={i*w+w/2} cy={h-((v-min)/r)*(h-10)-5} r="1.5" fill={color}/>)}</svg>;
}
function ProgressBar({value,max,color="bg-blue-500",w="w-20"}:{value:number;max:number;color?:string;w?:string}) {
  const pct=max>0?Math.min((value/max)*100,100):0;return <div className={`${w} h-2 bg-gray-700 rounded-full overflow-hidden`}><div className={`h-full ${color} rounded-full transition-all`} style={{width:`${pct}%`}}/></div>;
}

// ── Main ──
export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview");
  const [datePreset, setDatePreset] = useState("last_7d");
  const [productFilter, setProductFilter] = useState("ALL");
  const [actionLog, setActionLog] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState<string|null>(null);
  const [budgetModal, setBudgetModal] = useState<any>(null);
  const [notes, setNotes] = useState<Record<string,string>>({});
  const [noteInput, setNoteInput] = useState("");
  const [noteTarget, setNoteTarget] = useState<string|null>(null);
  const [igData, setIgData] = useState<any>(null);
  const [igLoading, setIgLoading] = useState(false);
  const [igFilter, setIgFilter] = useState("ALL");
  const [scripts, setScripts] = useState<any>(null);
  const [scriptTemplate, setScriptTemplate] = useState("HOOK_PREGUNTA");
  const [scriptTheme, setScriptTheme] = useState("");
  const [scriptLoading, setScriptLoading] = useState(false);
  const [library, setLibrary] = useState<any[]>([]);
  const [igSubTab, setIgSubTab] = useState<"live"|"library">("live");
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const [adModal, setAdModal] = useState<any>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyCursor, setHistoryCursor] = useState<string|null>(null);
  const CTA_OPTIONS = [{id:"VENTA",label:"🛒 Venta",color:"bg-green-500/20 text-green-300"},{id:"LEADS",label:"📋 Leads/Registro",color:"bg-blue-500/20 text-blue-300"},{id:"TRAFICO",label:"🔗 Trafico Web",color:"bg-cyan-500/20 text-cyan-300"},{id:"ENGAGEMENT",label:"💬 Engagement",color:"bg-purple-500/20 text-purple-300"},{id:"AWARENESS",label:"📢 Awareness",color:"bg-yellow-500/20 text-yellow-300"},{id:"MENSAJES",label:"💌 Mensajes",color:"bg-pink-500/20 text-pink-300"}];

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [r1,r2,r3] = await Promise.all([fetch(`/api/meta?date_preset=${datePreset}`),fetch("/api/meta/trends"),fetch("/api/meta/countries")]);
      const [d1,d2,d3] = await Promise.all([r1.json(),r2.json(),r3.json()]);
      setData(d1);setTrends(d2.trends||[]);setCountries(d3.countries||[]);
    } catch(e:any){setError(e.message);}
    setLoading(false);
  },[datePreset]);

  useEffect(()=>{fetchAll();},[fetchAll]);
  useEffect(()=>{const saved=localStorage.getItem("akal-notes");if(saved)setNotes(JSON.parse(saved));const lib=localStorage.getItem("akal-library");if(lib)setLibrary(JSON.parse(lib));},[]);
  const saveNote=(id:string,text:string)=>{const n={...notes,[id]:text};setNotes(n);localStorage.setItem("akal-notes",JSON.stringify(n));setNoteTarget(null);setNoteInput("");};
  const addToLibrary=(post:any,cta?:string)=>{const exists=library.find((p:any)=>p.id===post.id);if(exists)return;const entry={...post,addedAt:new Date().toISOString(),cta:cta||"",markedForAd:false,notes:""};const newLib=[entry,...library];setLibrary(newLib);localStorage.setItem("akal-library",JSON.stringify(newLib));};
  const updateLibraryItem=(id:string,updates:any)=>{const newLib=library.map((p:any)=>p.id===id?{...p,...updates}:p);setLibrary(newLib);localStorage.setItem("akal-library",JSON.stringify(newLib));};
  const removeFromLibrary=(id:string)=>{const newLib=library.filter((p:any)=>p.id!==id);setLibrary(newLib);localStorage.setItem("akal-library",JSON.stringify(newLib));};
  const toggleSelect=(id:string)=>{const s=new Set(selectedPosts);if(s.has(id))s.delete(id);else s.add(id);setSelectedPosts(s);};
  const addSelectedToLibrary=(cta:string)=>{if(!igData?.posts)return;igData.posts.filter((p:any)=>selectedPosts.has(p.id)).forEach((p:any)=>addToLibrary(p,cta));setSelectedPosts(new Set());};
  const loadHistory=async()=>{setHistoryLoading(true);try{const url=`/api/meta/instagram/history?limit=100${historyCursor?`&after=${historyCursor}`:""}`;const r=await fetch(url);const d=await r.json();if(d.posts){const current=igData||{posts:[],themes:{},account:{}};const merged={...current,posts:[...current.posts,...d.posts.filter((p:any)=>!current.posts.some((e:any)=>e.id===p.id))]};setIgData(merged);setHistoryCursor(d.nextCursor);}}catch(e:any){alert(e.message);}setHistoryLoading(false);};

  const execAction = async(action:string,entityId:string,entityName:string,params?:any)=>{
    setActionLoading(entityId+action);
    try{const r=await fetch("/api/meta/actions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,entityId,entityName,params})});const res=await r.json();
    if(res.success){setActionLog(prev=>[{...res,time:new Date().toLocaleTimeString()},...prev]);setTimeout(fetchAll,2000);}else{alert(`Error: ${res.error}`);}
    }catch(e:any){alert(e.message);}setActionLoading(null);
  };

  const changeBudget=(entityId:string,entityName:string,currentBudget:number,pct:number)=>{
    const newBudget=Math.round(currentBudget*(1+pct/100)*100)/100;
    execAction("update_budget",entityId,entityName,{daily_budget:String(newBudget)});
    setBudgetModal(null);
  };

  if(loading)return <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 flex items-center justify-center"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"/><p className="text-gray-400">Conectando con Meta Ads...</p></div></div>;
  if(error||!data)return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><p className="text-red-400">Error: {error}</p></div>;

  const cur = data.current;
  const comp = data.comparison;
  const roas = parseFloat(cur.roas);
  const revenue = parseFloat(cur.revenue);
  const spend = parseFloat(cur.spend);
  const roasColor = roas >= 2 ? "text-green-400" : roas >= 1 ? "text-yellow-400" : "text-red-400";
  const campaigns = data.campaigns || [];
  const ads = data.ads || [];
  const adsets = data.adsets || [];
  const products = Object.keys(data.productGroups || {});
  const funnel = data.funnelGroups || {};
  const funnelOrder = ["TOFU","MOFU","BOFU","RETARGETING","OTROS"];

  const filteredCampaigns = productFilter === "ALL" ? campaigns : campaigns.filter((c:any)=>c.product===productFilter);
  const filteredAds = productFilter === "ALL" ? ads : ads.filter((a:any)=>filteredCampaigns.some((c:any)=>c.name===a.campaign));

  const adsStars = ads.filter((a:any)=>a.status==="ESTRELLA");
  const adsDead = ads.filter((a:any)=>a.status==="MUERTO");
  const adsCaro = ads.filter((a:any)=>a.status==="CARO");
  const totalWaste = adsDead.reduce((s:number,a:any)=>s+parseFloat(a.spend),0);
  const maxSpend = Math.max(...campaigns.map((c:any)=>parseFloat(c.spend)),1);

  const trendDir = (curV:string,compV:string,invert=false)=>{const c=parseFloat(curV),p=parseFloat(compV);if(!p)return null;return invert?(c<p?"up":"down"):(c>p?"up":"down");};

  const tabs=[{id:"overview",label:"Overview",icon:"📊"},{id:"campaigns",label:"Campañas",icon:"🎯"},{id:"creatives",label:"Creativos",icon:"🎨"},{id:"audience",label:"Audiencia",icon:"👥"},{id:"funnel",label:"Funnel",icon:"🔻"},{id:"countries",label:"Países",icon:"🌎"},{id:"instagram",label:"Instagram",icon:"📸"},{id:"scripts",label:"Guiones",icon:"📝"},{id:"actions",label:`Log (${actionLog.length})`,icon:"⚡"}];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 text-white">
      {/* Budget Modal */}
      {budgetModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={()=>setBudgetModal(null)}>
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 max-w-sm w-full mx-4" onClick={e=>e.stopPropagation()}>
            <h3 className="font-bold mb-2">Ajustar Presupuesto</h3>
            <p className="text-gray-400 text-sm mb-1">{budgetModal.name}</p>
            <p className="text-lg mb-4">Actual: <span className="text-blue-400 font-bold">${budgetModal.budget}/día</span></p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {[-20,-10,10,20].map(pct=>(
                <button key={pct} onClick={()=>changeBudget(budgetModal.id,budgetModal.name,budgetModal.budget,pct)} className={`py-2 rounded-lg font-medium text-sm ${pct<0?"bg-red-600/80 hover:bg-red-600":"bg-green-600/80 hover:bg-green-600"}`}>
                  {pct>0?"+":""}{pct}% → ${(budgetModal.budget*(1+pct/100)).toFixed(2)}
                </button>
              ))}
            </div>
            <button onClick={()=>setBudgetModal(null)} className="w-full py-2 bg-gray-700 rounded-lg text-sm">Cancelar</button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-gray-800/50 backdrop-blur-xl border-b border-gray-700/50 px-6 py-3 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center font-bold text-sm">A</div>
            <div><h1 className="text-lg font-bold">AKAL Ads</h1><p className="text-gray-400 text-xs">{data.account.name} · {cur.dateStart} → {cur.dateStop}</p></div>
            {roas > 0 && <Badge text={`ROAS ${roas.toFixed(2)}x`} color={`${roas>=1?"bg-green-500/20 text-green-300":"bg-red-500/20 text-red-300"} text-sm px-3 py-1`}/>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Date Selector */}
            <div className="flex bg-gray-700/50 rounded-lg p-0.5 gap-0.5">
              {DATE_PRESETS.map(d=>(
                <button key={d.id} onClick={()=>setDatePreset(d.id)} className={`px-2 py-1 rounded text-xs transition ${datePreset===d.id?"bg-blue-600 font-medium":"hover:bg-gray-600/50"}`}>{d.label}</button>
              ))}
            </div>
            {/* Product Filter */}
            {products.length > 1 && (
              <select value={productFilter} onChange={e=>setProductFilter(e.target.value)} className="bg-gray-700/50 border border-gray-600 rounded-lg px-2 py-1 text-xs">
                <option value="ALL">Todos</option>
                {products.map(p=><option key={p} value={p}>{p}</option>)}
              </select>
            )}
            <ExtLink href={adsMgr("campaign","")}>Ads Mgr</ExtLink>
            <button onClick={fetchAll} className="bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg text-xs font-medium">⟳ Actualizar</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4">
        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-gray-800/50 p-1 rounded-xl w-fit overflow-x-auto">
          {tabs.map(t=><button key={t.id} onClick={()=>setTab(t.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${tab===t.id?"bg-blue-600 shadow-lg shadow-blue-600/20":"hover:bg-gray-700/50"}`}>{t.icon} {t.label}</button>)}
        </div>

        {/* ═══ OVERVIEW ═══ */}
        {tab==="overview"&&(<>
          {/* ROAS Alert */}
          {roas > 0 && roas < 1 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-5 flex items-center gap-3">
              <span className="text-2xl">🚨</span>
              <div><p className="font-bold text-red-300">ROAS {roas.toFixed(2)}x — Estás perdiendo dinero</p><p className="text-sm text-gray-400">Gastaste {fmtMoney(spend)} y generaste {fmtMoney(revenue)} en ingresos. Pierdes {fmtMoney(spend - revenue)} por periodo.</p></div>
            </div>
          )}

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-5">
            <KPI label="Gasto" value={fmtMoney(cur.spend)} sub={`${fmtMoney(parseFloat(cur.spend)/7)}/día`} color="text-blue-400"/>
            <KPI label="Revenue" value={fmtMoney(cur.revenue)} sub={`${fmtMoney(revenue/7)}/día`} color={roasColor}/>
            <KPI label="ROAS" value={`${roas.toFixed(2)}x`} sub={roas>=1?`+${fmtMoney(revenue-spend)}`:`${fmtMoney(revenue-spend)}`} color={roasColor}/>
            <KPI label="Compras" value={cur.purchases} sub={`CPA: ${fmtMoney(cur.costPerPurchase)}`} color="text-green-400" trend={trendDir(cur.costPerPurchase,comp.costPerPurchase,true)}/>
            <KPI label="CTR" value={fmtPct(cur.ctr)} sub={`CPC: ${fmtMoney(cur.cpc)}`} trend={trendDir(cur.ctr,comp.ctr)}/>
            <KPI label="Checkouts" value={cur.checkouts} sub={`Conv: ${parseInt(cur.purchases)>0?((parseInt(cur.purchases)/parseInt(cur.checkouts))*100).toFixed(0):0}%`}/>
            <KPI label="Desperdicio" value={fmtMoney(totalWaste)} sub={`${adsDead.length} ads muertos`} color="text-red-400"/>
          </div>

          {/* Trend Charts */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
            {[{label:"Gasto/día",key:"spend",color:"#3b82f6"},{label:"Compras/día",key:"purchases",color:"#22c55e"},{label:"CPA/día",key:"cpa",color:"#f59e0b",filter:true},{label:"Clicks/día",key:"clicks",color:"#8b5cf6"}].map(ch=>(
              <div key={ch.key} className="bg-gray-800/60 rounded-xl p-3 border border-gray-700/50">
                <p className="text-xs text-gray-400 mb-2">{ch.label} (14d)</p>
                <MiniChart data={ch.filter?trends.filter(t=>t[ch.key]>0):trends} dataKey={ch.key} color={ch.color}/>
              </div>
            ))}
          </div>

          {/* Two columns: Recommendations + Funnel */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
            {/* Recommendations */}
            <div className="bg-gray-800/60 rounded-xl border border-gray-700/50 p-4">
              <h3 className="text-sm font-semibold text-yellow-400 mb-3">⚡ Recomendaciones Inteligentes</h3>
              {roas>0&&roas<1&&<div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg mb-2"><p className="text-sm font-medium text-red-300">🚨 ROAS {roas.toFixed(2)}x: Reducir gasto en paises/creativos sin retorno</p><p className="text-xs text-gray-400">Pausar ads MUERTOS ahorraria ${totalWaste.toFixed(2)}/periodo</p></div>}
              {adsStars.slice(0,3).map((ad:any,i:number)=>(
                <div key={i} className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg mb-2 flex justify-between items-center">
                  <div><p className="text-sm font-medium text-green-300">⭐ Escalar: {ad.name}</p><p className="text-xs text-gray-400">CPA {fmtMoney(ad.costPerPurchase)} · {ad.purchases} compras · Replicar en más audiencias</p></div>
                </div>
              ))}
              {adsDead.slice(0,3).map((ad:any,i:number)=>(
                <div key={i} className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg mb-2 flex justify-between items-center">
                  <div><p className="text-sm font-medium text-red-300">💀 Pausar: {ad.name}</p><p className="text-xs text-gray-400">{fmtMoney(ad.spend)} gastado sin compras</p></div>
                  <Btn label="Pausar" icon="⏸" color="bg-red-600" onClick={()=>execAction("pause",ad.id,ad.name)} loading={actionLoading===ad.id+"pause"} small/>
                </div>
              ))}
              {adsCaro.slice(0,2).map((ad:any,i:number)=>(
                <div key={i} className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg mb-2">
                  <p className="text-sm font-medium text-orange-300">💸 Caro: {ad.name}</p><p className="text-xs text-gray-400">CPA {fmtMoney(ad.costPerPurchase)} vs promedio {fmtMoney(cur.costPerPurchase)} — Monitorear 3 días</p>
                </div>
              ))}
            </div>

            {/* Funnel Mini */}
            <div className="bg-gray-800/60 rounded-xl border border-gray-700/50 p-4">
              <h3 className="text-sm font-semibold text-purple-400 mb-3">🔻 Funnel de Conversión</h3>
              {funnelOrder.filter(s=>funnel[s]).map((stage,i)=>{
                const f=funnel[stage];const roas=f.revenue>0&&f.spend>0?(f.revenue/f.spend).toFixed(2):"0";
                return(
                  <div key={stage} className="mb-3">
                    <div className="flex justify-between items-center mb-1">
                      <Badge text={stage} color={STAGE_COLORS[stage]||STAGE_COLORS.OTROS}/>
                      <span className="text-xs text-gray-400">{f.campaigns} campañas</span>
                    </div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>Gasto: {fmtMoney(f.spend)}</span>
                      <span>Revenue: {fmtMoney(f.revenue)}</span>
                      <span>ROAS: {roas}x</span>
                      <span>{f.purchases} compras</span>
                    </div>
                    <ProgressBar value={f.spend} max={Math.max(...funnelOrder.filter(s=>funnel[s]).map(s=>funnel[s].spend))} color={parseFloat(roas)>=1?"bg-green-500":"bg-red-500"} w="w-full"/>
                  </div>
                );
              })}
              {/* Countries Mini */}
              <h3 className="text-sm font-semibold text-blue-400 mt-4 mb-3">🌎 Top Países</h3>
              {countries.slice(0,5).map((c:any,i:number)=>(
                <div key={i} className="flex justify-between items-center py-1.5 text-xs">
                  <span>{cf(c.country)} {cn(c.country)}</span>
                  <span>{fmtMoney(c.spend)} · {c.purchases>0?<span className="text-green-400">{c.purchases} compras ({fmtMoney(c.cpa)} CPA)</span>:<span className="text-gray-500">0 compras</span>}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Products Summary */}
          {products.length>1&&(
            <div className="bg-gray-800/60 rounded-xl border border-gray-700/50 p-4 mb-5">
              <h3 className="text-sm font-semibold text-cyan-400 mb-3">📦 Por Producto</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(data.productGroups).sort((a:any,b:any)=>b[1].spend-a[1].spend).map(([prod,info]:any)=>{
                  const r=info.revenue>0&&info.spend>0?(info.revenue/info.spend).toFixed(2):"0";
                  return(
                    <div key={prod} className="bg-gray-700/30 rounded-lg p-3 cursor-pointer hover:bg-gray-700/50 transition" onClick={()=>setProductFilter(prod)}>
                      <p className="font-medium text-sm">{prod}</p>
                      <p className="text-xs text-gray-400">{info.campaigns} campañas · {info.purchases} compras</p>
                      <p className="text-xs mt-1">Gasto: {fmtMoney(info.spend)} · ROAS: <span className={parseFloat(r)>=1?"text-green-400":"text-red-400"}>{r}x</span></p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>)}

        {/* ═══ CAMPAIGNS ═══ */}
        {tab==="campaigns"&&(
          <div className="bg-gray-800/60 rounded-xl border border-gray-700/50 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-gray-400 text-xs border-b border-gray-700/50">
                <th className="text-left p-3">Campaña</th><th className="p-2">Etapa</th><th className="p-2">Geo</th><th className="text-right p-2">Budget</th><th className="text-right p-2">Spend</th><th className="text-right p-2">Revenue</th><th className="text-right p-2">ROAS</th><th className="text-right p-2">Compras</th><th className="text-right p-2">CPA</th><th className="text-right p-2">CTR</th><th className="p-2">Barra</th><th className="p-2">Acciones</th>
              </tr></thead>
              <tbody>
                {filteredCampaigns.sort((a:any,b:any)=>parseFloat(b.spend)-parseFloat(a.spend)).map((c:any,i:number)=>{
                  const r=parseFloat(c.revenue)>0&&parseFloat(c.spend)>0?(parseFloat(c.revenue)/parseFloat(c.spend)).toFixed(2):"0";
                  return(
                    <tr key={i} className="border-t border-gray-700/30 hover:bg-gray-700/20">
                      <td className="p-3"><ExtLink href={adsMgr("campaign",c.id)}>{c.name}</ExtLink>{notes[c.id]&&<p className="text-xs text-yellow-400/70 mt-0.5">📝 {notes[c.id]}</p>}
                        {noteTarget===c.id&&<div className="flex gap-1 mt-1"><input value={noteInput} onChange={e=>setNoteInput(e.target.value)} className="bg-gray-700 rounded px-2 py-0.5 text-xs flex-1" placeholder="Nota..."/><button onClick={()=>saveNote(c.id,noteInput)} className="bg-blue-600 px-2 rounded text-xs">💾</button></div>}
                      </td>
                      <td className="p-2"><Badge text={c.funnelStage} color={STAGE_COLORS[c.funnelStage]||STAGE_COLORS.OTROS}/></td>
                      <td className="p-2 text-xs">{c.geo}</td>
                      <td className="p-2 text-right text-xs">{c.dailyBudget?`$${c.dailyBudget}/d`:"CBO"}</td>
                      <td className="p-2 text-right font-medium">{fmtMoney(c.spend)}</td>
                      <td className="p-2 text-right">{fmtMoney(c.revenue)}</td>
                      <td className={`p-2 text-right font-bold ${parseFloat(r)>=1?"text-green-400":"text-red-400"}`}>{r}x</td>
                      <td className="p-2 text-right">{parseInt(c.purchases)>0?<span className="text-green-400 font-bold">{c.purchases}</span>:<span className="text-gray-600">0</span>}</td>
                      <td className="p-2 text-right">{parseFloat(c.costPerPurchase)>0?fmtMoney(c.costPerPurchase):"-"}</td>
                      <td className="p-2 text-right">{fmtPct(c.ctr)}</td>
                      <td className="p-2"><ProgressBar value={parseFloat(c.spend)} max={maxSpend} color={parseInt(c.purchases)>0?"bg-green-500":"bg-red-500"}/></td>
                      <td className="p-2"><div className="flex gap-1 flex-wrap">
                        <Btn label="⏸" icon="" color="bg-yellow-600/80" onClick={()=>execAction("pause",c.id,c.name)} loading={actionLoading===c.id+"pause"} small/>
                        {c.dailyBudget&&<Btn label="💰" icon="" color="bg-blue-600/80" onClick={()=>setBudgetModal({id:c.id,name:c.name,budget:parseFloat(c.dailyBudget)})} small/>}
                        <Btn label="📝" icon="" color="bg-gray-600/80" onClick={()=>{setNoteTarget(noteTarget===c.id?null:c.id);setNoteInput(notes[c.id]||"");}} small/>
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ═══ CREATIVES ═══ */}
        {tab==="creatives"&&(<>
          {/* Status Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 mb-5">
            {Object.entries(STATUS_ICONS).filter(([s])=>ads.some((a:any)=>a.status===s)).map(([status,icon])=>{
              const count=ads.filter((a:any)=>a.status===status).length;
              return <div key={status} className={`p-3 rounded-xl border ${STATUS_COLORS[status]} text-center`}><p className="text-lg">{icon}</p><p className="text-xs font-medium">{status}</p><p className="text-lg font-bold">{count}</p></div>;
            })}
          </div>

          <div className="bg-gray-800/60 rounded-xl border border-gray-700/50 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-gray-400 text-xs border-b border-gray-700/50">
                <th className="text-left p-3">Creativo</th><th className="p-2">Status</th><th className="text-right p-2">Spend</th><th className="text-right p-2">Revenue</th><th className="text-right p-2">ROAS</th><th className="text-right p-2">Compras</th><th className="text-right p-2">CPA</th><th className="text-right p-2">CTR</th><th className="text-left p-2">Sugerencia</th><th className="p-2">Acción</th>
              </tr></thead>
              <tbody>
                {filteredAds.sort((a:any,b:any)=>{const order=["ESTRELLA","BUENO","POTENCIAL","EN_PRUEBA","CARO","MUERTO","NUEVO","UNKNOWN"];return order.indexOf(a.status)-order.indexOf(b.status);}).map((a:any,i:number)=>{
                  const r=parseFloat(a.revenue)>0&&parseFloat(a.spend)>0?(parseFloat(a.revenue)/parseFloat(a.spend)).toFixed(2):"0";
                  return(
                    <tr key={i} className="border-t border-gray-700/30 hover:bg-gray-700/20">
                      <td className="p-3"><ExtLink href={adsMgr("ad",a.id)}>{a.name}</ExtLink><br/><span className="text-gray-500 text-xs">{a.adset}</span></td>
                      <td className="p-2"><Badge text={`${STATUS_ICONS[a.status]} ${a.status}`} color={STATUS_COLORS[a.status]}/></td>
                      <td className="p-2 text-right">{fmtMoney(a.spend)}</td>
                      <td className="p-2 text-right">{fmtMoney(a.revenue)}</td>
                      <td className={`p-2 text-right font-bold ${parseFloat(r)>=1?"text-green-400":"text-red-400"}`}>{r}x</td>
                      <td className="p-2 text-right">{parseInt(a.purchases)>0?<span className="text-green-400 font-bold">{a.purchases}</span>:"0"}</td>
                      <td className="p-2 text-right">{parseFloat(a.costPerPurchase)>0?fmtMoney(a.costPerPurchase):"-"}</td>
                      <td className="p-2 text-right">{fmtPct(a.ctr)}</td>
                      <td className="p-2 text-xs text-gray-400 max-w-[200px]">{a.suggestion}</td>
                      <td className="p-2"><div className="flex gap-1">
                        {(a.status==="MUERTO"||a.status==="CARO")&&<Btn label="⏸" icon="" color="bg-red-600/80" onClick={()=>execAction("pause",a.id,a.name)} loading={actionLoading===a.id+"pause"} small/>}
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>)}

        {/* ═══ FUNNEL ═══ */}
        {tab==="funnel"&&(
          <div className="space-y-4">
            {funnelOrder.filter(s=>funnel[s]).map(stage=>{
              const f=funnel[stage];const r=f.revenue>0&&f.spend>0?(f.revenue/f.spend).toFixed(2):"0";
              const stageCampaigns=campaigns.filter((c:any)=>c.funnelStage===stage);
              return(
                <div key={stage} className="bg-gray-800/60 rounded-xl border border-gray-700/50 overflow-hidden">
                  <div className="p-4 flex justify-between items-center border-b border-gray-700/50">
                    <div className="flex items-center gap-3"><Badge text={stage} color={STAGE_COLORS[stage]||STAGE_COLORS.OTROS}/><span className="text-sm">{f.campaigns} campañas</span></div>
                    <div className="flex gap-4 text-sm">
                      <span>Gasto: <b className="text-blue-400">{fmtMoney(f.spend)}</b></span>
                      <span>Revenue: <b>{fmtMoney(f.revenue)}</b></span>
                      <span>ROAS: <b className={parseFloat(r)>=1?"text-green-400":"text-red-400"}>{r}x</b></span>
                      <span>Compras: <b className="text-green-400">{f.purchases}</b></span>
                    </div>
                  </div>
                  <table className="w-full text-xs">
                    <tbody>
                      {stageCampaigns.map((c:any,i:number)=>{
                        const cr=parseFloat(c.revenue)>0&&parseFloat(c.spend)>0?(parseFloat(c.revenue)/parseFloat(c.spend)).toFixed(2):"0";
                        return(
                          <tr key={i} className="border-t border-gray-700/20 hover:bg-gray-700/20">
                            <td className="p-2 pl-4"><ExtLink href={adsMgr("campaign",c.id)}>{c.name}</ExtLink></td>
                            <td className="p-2 text-right">{fmtMoney(c.spend)}</td>
                            <td className="p-2 text-right">{fmtMoney(c.revenue)}</td>
                            <td className={`p-2 text-right font-bold ${parseFloat(cr)>=1?"text-green-400":"text-red-400"}`}>{cr}x</td>
                            <td className="p-2 text-right">{c.purchases} comp</td>
                            <td className="p-2"><Btn label="⏸" icon="" color="bg-yellow-600/60" onClick={()=>execAction("pause",c.id,c.name)} loading={actionLoading===c.id+"pause"} small/></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}

        {/* ═══ COUNTRIES ═══ */}
        {tab==="countries"&&(
          <div className="bg-gray-800/60 rounded-xl border border-gray-700/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="text-gray-400 text-xs border-b border-gray-700/50">
                <th className="text-left p-3">País</th><th className="text-right p-3">Spend</th><th className="text-right p-3">Compras</th><th className="text-right p-3">CPA</th><th className="text-right p-3">ROAS</th><th className="text-right p-3">CTR</th><th className="text-right p-3">CPC</th><th className="text-right p-3">CPM</th><th className="text-right p-3">Clicks</th>
              </tr></thead>
              <tbody>
                {countries.map((c:any,i:number)=>(
                  <tr key={i} className="border-t border-gray-700/30 hover:bg-gray-700/20">
                    <td className="p-3 font-medium">{cf(c.country)} {cn(c.country)}</td>
                    <td className="p-3 text-right font-medium">{fmtMoney(c.spend)}</td>
                    <td className="p-3 text-right">{c.purchases>0?<span className="text-green-400 font-bold">{c.purchases}</span>:<span className="text-gray-600">0</span>}</td>
                    <td className="p-3 text-right">{c.cpa>0?fmtMoney(c.cpa):"-"}</td>
                    <td className="p-3 text-right">{c.spend>0&&c.purchases>0?<span className={c.cpa*parseInt(String(c.purchases))>0?"text-green-400":"text-red-400"}>{((c.purchases*(parseFloat(cur.revenue)/parseInt(cur.purchases)))/c.spend).toFixed(2)}x</span>:"-"}</td>
                    <td className="p-3 text-right">{fmtPct(c.ctr)}</td>
                    <td className="p-3 text-right">{fmtMoney(c.cpc)}</td>
                    <td className="p-3 text-right">{fmtMoney(c.cpm)}</td>
                    <td className="p-3 text-right">{fmtInt(c.clicks)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ═══ AUDIENCE ═══ */}
        {tab==="audience"&&(<AudienceTab />)}

        {/* ═══ INSTAGRAM ═══ */}
        {tab==="instagram"&&(
          <InstagramTab
            adModal={adModal} setAdModal={setAdModal}
            CTA_OPTIONS={CTA_OPTIONS}
            actionLoading={actionLoading}
          />
        )}

        {/* ═══ SCRIPT GENERATOR ═══ */}
        {tab==="scripts"&&(
          <div>
            <div className="bg-gray-800/60 rounded-xl border border-gray-700/50 p-6 mb-5">
              <h3 className="text-lg font-bold mb-4">📝 Generador de Guiones para Reels</h3>
              <p className="text-gray-400 text-sm mb-4">Genera guiones basados en tu contenido con mejor rendimiento. Elige una estructura y tematica.</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {/* Template Selection */}
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Estructura del guion</label>
                  <select value={scriptTemplate} onChange={e=>setScriptTemplate(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm">
                    <option value="HOOK_PREGUNTA">🔍 Hook con Pregunta</option>
                    <option value="HOOK_AFIRMACION">💪 Hook con Afirmacion Fuerte</option>
                    <option value="HOOK_HISTORIA">📖 Hook con Historia/Caso</option>
                    <option value="HOOK_LISTA">📋 Hook con Lista/Pasos</option>
                  </select>
                </div>

                {/* Theme Selection */}
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Tematica</label>
                  <select value={scriptTheme} onChange={e=>setScriptTheme(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm">
                    <option value="">Basado en Top Posts</option>
                    <option value="CANCER">Cancer / Sanacion</option>
                    <option value="INFLAMACION">Inflamacion / Cuerpo</option>
                    <option value="AGUA_DE_MAR">Agua de Mar</option>
                    <option value="INCONSCIENTE">Inconsciente / Mente</option>
                    <option value="EMOCIONAL">Emocional / Amor</option>
                    <option value="RESPIRACION">Respiracion / Meditacion</option>
                    <option value="MIGRANAS">Migranas / Dolor</option>
                    <option value="CRONICA">Enfermedad Cronica</option>
                  </select>
                </div>

                {/* Generate Button */}
                <div className="flex items-end">
                  <button onClick={async()=>{
                    setScriptLoading(true);
                    const topPosts=igData?.posts?.filter((p:any)=>!scriptTheme||p.theme===scriptTheme).slice(0,10)||[];
                    try{const r=await fetch("/api/meta/generate-script",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({topPosts,theme:scriptTheme,templateType:scriptTemplate})});const d=await r.json();setScripts(d);}catch(e:any){alert(e.message);}
                    setScriptLoading(false);
                  }} disabled={scriptLoading} className="w-full bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-medium transition disabled:opacity-50">
                    {scriptLoading?"Generando...":"Generar Guiones"}
                  </button>
                </div>
              </div>

              {!igData&&<p className="text-yellow-400 text-sm">💡 Primero carga los datos de Instagram (tab Instagram) para generar guiones basados en tu contenido real.</p>}
            </div>

            {/* Generated Scripts */}
            {scripts&&(
              <>
                {/* Pattern Analysis */}
                {scripts.patternAnalysis&&(
                  <div className="bg-gray-800/60 rounded-xl border border-gray-700/50 p-4 mb-5">
                    <h4 className="text-sm font-semibold text-cyan-400 mb-3">🔬 Patrones de tu Top Content</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-400 mb-2">Hooks que funcionan:</p>
                        {scripts.patternAnalysis.topHooks?.slice(0,5).map((h:string,i:number)=>(
                          <p key={i} className="text-sm mb-1 pl-2 border-l-2 border-green-500/50">"{h}"</p>
                        ))}
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-2">Mejores tematicas:</p>
                        <div className="flex flex-wrap gap-2">
                          {scripts.patternAnalysis.bestThemes?.map((t:string,i:number)=><Badge key={i} text={t} color="bg-purple-500/20 text-purple-300"/>)}
                        </div>
                        <p className="text-sm mt-3 text-gray-300">Promedio saves top posts: <span className="text-yellow-400 font-bold">{scripts.patternAnalysis.avgSavesTopPosts}</span></p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Script Cards */}
                {scripts.scripts?.map((script:any,si:number)=>(
                  <div key={si} className="bg-gray-800/60 rounded-xl border border-gray-700/50 p-5 mb-4">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-bold">Guion {script.variation}: {script.templateName}</h4>
                      <div className="flex items-center gap-2">
                        <Badge text={script.theme||"GENERAL"} color="bg-purple-500/20 text-purple-300"/>
                        <span className="text-xs text-gray-400">⏱ {script.totalDuration}</span>
                      </div>
                    </div>

                    {/* Script Sections */}
                    <div className="space-y-3 mb-4">
                      {script.sections.map((section:any,i:number)=>(
                        <div key={i} className="bg-gray-700/30 rounded-lg p-3 border-l-4 border-blue-500/50">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-bold text-blue-400">{section.part}</span>
                            <span className="text-xs text-gray-500">{section.duration}</span>
                          </div>
                          <p className="text-sm text-gray-300 italic">{section.instruction}</p>
                          <textarea className="w-full mt-2 bg-gray-800/80 border border-gray-600/50 rounded px-3 py-2 text-sm text-white placeholder-gray-500 resize-none" rows={2} placeholder={`Escribe tu ${section.part.toLowerCase()} aqui...`}/>
                        </div>
                      ))}
                    </div>

                    {/* Tips */}
                    <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3">
                      <p className="text-xs font-semibold text-yellow-400 mb-1">💡 Tips basados en tu data:</p>
                      {script.tips?.map((tip:string,i:number)=><p key={i} className="text-xs text-gray-400">• {tip}</p>)}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* ═══ ACTIONS LOG ═══ */}
        {tab==="actions"&&(
          <div className="bg-gray-800/60 rounded-xl border border-gray-700/50 p-4">
            <h3 className="text-sm font-semibold text-purple-400 mb-4">⚡ Historial de Acciones</h3>
            {actionLog.length===0&&<p className="text-gray-500 text-sm">No hay acciones ejecutadas aún.</p>}
            {actionLog.map((log,i)=>(
              <div key={i} className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg mb-2">
                <div><p className="text-sm font-medium">{log.action==="pause"?"⏸ Pausado":log.action==="activate"?"▶ Activado":log.action==="update_budget"?"💰 Budget":"📝 "+log.action}: <span className="text-blue-300">{log.entityName}</span></p><p className="text-xs text-gray-400">{log.time} · {log.entityId}</p></div>
                {log.action==="pause"&&<Btn label="Reactivar" icon="▶" color="bg-green-600" onClick={()=>execAction("activate",log.entityId,log.entityName)} loading={actionLoading===log.entityId+"activate"}/>}
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="text-center text-gray-600 text-xs py-4 border-t border-gray-800">AKAL Ads Dashboard v4 · Meta Marketing API + Instagram Insights · Auto-refresh 30min</footer>
    </div>
  );
}

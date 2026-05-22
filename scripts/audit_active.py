"""Auditoria rapida de campanas activas - separa DCE/Masterclass vs Peso."""
import json, urllib.request, subprocess, re

TOKEN = subprocess.run(["powershell","-NoProfile","-Command",
    "[Environment]::GetEnvironmentVariable('META_ACCESS_TOKEN','User')"],
    capture_output=True, text=True).stdout.strip()
ACT = "act_289250686730282"

def meta(path):
    req = urllib.request.Request(f"https://graph.facebook.com/v22.0/{path}&access_token={TOKEN}")
    return json.loads(urllib.request.urlopen(req, timeout=40).read())

def get_act(actions, t):
    for a in (actions or []):
        if a.get("action_type") == t: return float(a.get("value", 0))
    return 0

def get_cost(costs, t):
    for a in (costs or []):
        if a.get("action_type") == t: return float(a.get("value", 0))
    return 0

# Insights por campana 7d y 14d
def fetch(preset):
    url = (f"{ACT}/insights?fields=campaign_name,campaign_id,spend,impressions,clicks,ctr,cpc,cpm,"
           f"actions,action_values,cost_per_action_type,purchase_roas,frequency"
           f"&level=campaign&date_preset={preset}&limit=100"
           f"&filtering=%5B%7B%22field%22%3A%22campaign.effective_status%22%2C%22operator%22%3A%22IN%22%2C%22value%22%3A%5B%22ACTIVE%22%5D%7D%5D")
    return meta(url).get("data", [])

d7 = fetch("last_7d")
d14 = fetch("last_14d")

def classify(name):
    n = name.upper()
    if "PESO" in n or "ADELGAZAR" in n or "PESO IDEAL" in n: return "PESO"
    if "MCE" in n or "MASTERCLASS" in n or "DCE" in n or "CAUSA" in n or "ENFERMEDAD" in n: return "DCE/MCE"
    if "CANCER" in n: return "CANCER"
    return "OTRO"

def proc(rows):
    out = []
    for r in rows:
        p = get_act(r.get("actions"), "purchase")
        rev = get_act(r.get("action_values"), "purchase")
        cpa = get_cost(r.get("cost_per_action_type"), "purchase")
        leads = get_act(r.get("actions"), "complete_registration") + get_act(r.get("actions"), "lead")
        msgs = get_act(r.get("actions"), "onsite_conversion.messaging_first_reply")
        spend = float(r.get("spend", 0))
        pr = r.get("purchase_roas")
        if isinstance(pr, list): roas = float(pr[0].get("value", 0)) if pr else 0
        elif isinstance(pr, dict): roas = float(pr.get("value", 0))
        else: roas = 0
        out.append({
            "id": r["campaign_id"], "name": r["campaign_name"],
            "cat": classify(r["campaign_name"]),
            "spend": spend, "imp": int(r.get("impressions", 0)),
            "clicks": int(r.get("clicks", 0)),
            "ctr": float(r.get("ctr", 0)), "cpc": float(r.get("cpc", 0)),
            "cpm": float(r.get("cpm", 0)), "freq": float(r.get("frequency", 0)),
            "purchases": int(p), "revenue": rev, "cpa": cpa, "roas": roas,
            "leads": int(leads), "messages": int(msgs),
        })
    return out

c7 = proc(d7); c14 = proc(d14)
c7_map = {x["id"]: x for x in c7}
c14_map = {x["id"]: x for x in c14}

# Totales por categoria 7d
print("="*90)
print("TOTALES POR PRODUCTO — Ultimos 7 dias")
print("="*90)
for cat in ["DCE/MCE", "PESO", "CANCER", "OTRO"]:
    items = [x for x in c7 if x["cat"] == cat]
    if not items: continue
    sp = sum(x["spend"] for x in items)
    pu = sum(x["purchases"] for x in items)
    rv = sum(x["revenue"] for x in items)
    le = sum(x["leads"] for x in items)
    msgs = sum(x["messages"] for x in items)
    cpa = sp/pu if pu else 0
    roas = rv/sp if sp else 0
    print(f"\n[{cat}] {len(items)} campanas")
    print(f"  Spend: ${sp:.2f} | Compras: {pu} | Revenue: ${rv:.2f}")
    print(f"  CPA: ${cpa:.2f} | ROAS: {roas:.2f}x | Leads: {le} | Messages: {msgs}")

# Tendencia 7d vs prev (14d - 7d)
print("\n" + "="*90)
print("DETALLE POR CAMPANA — 7d (y comparado vs 7d anteriores)")
print("="*90)

for cat in ["DCE/MCE", "PESO", "CANCER", "OTRO"]:
    items = sorted([x for x in c7 if x["cat"] == cat], key=lambda x: -x["spend"])
    if not items: continue
    print(f"\n>>> {cat} <<<")
    for x in items:
        # Calcular periodo anterior: 14d - 7d
        x14 = c14_map.get(x["id"])
        prev_sp = (x14["spend"] - x["spend"]) if x14 else 0
        prev_pu = (x14["purchases"] - x["purchases"]) if x14 else 0
        prev_rev = (x14["revenue"] - x["revenue"]) if x14 else 0
        prev_cpa = prev_sp/prev_pu if prev_pu else 0
        prev_roas = prev_rev/prev_sp if prev_sp else 0
        dCPA = ((x["cpa"]-prev_cpa)/prev_cpa*100) if prev_cpa else 0
        dROAS = ((x["roas"]-prev_roas)/prev_roas*100) if prev_roas else 0
        name = x["name"][:75]
        verdict = "OK"
        if x["spend"] > 50 and x["purchases"] == 0: verdict = "MUERTA"
        elif x["roas"] >= 1.5: verdict = "ESCALAR"
        elif x["roas"] < 0.7 and x["spend"] > 30: verdict = "CARA"
        print(f"  {name}")
        print(f"    spend=${x['spend']:.2f}  comp={x['purchases']}  rev=${x['revenue']:.2f}  CPA=${x['cpa']:.2f}  ROAS={x['roas']:.2f}x")
        print(f"    ctr={x['ctr']:.2f}%  cpc=${x['cpc']:.2f}  cpm=${x['cpm']:.2f}  freq={x['freq']:.2f}  leads={x['leads']}  msgs={x['messages']}")
        if x14:
            print(f"    vs 7d previos: CPA prev=${prev_cpa:.2f} ({dCPA:+.0f}%) | ROAS prev={prev_roas:.2f}x ({dROAS:+.0f}%) | spend prev=${prev_sp:.2f}")
        print(f"    >> {verdict}")

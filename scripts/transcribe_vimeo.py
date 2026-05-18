"""
Transcribe testimonios de una carpeta Vimeo -> Supabase tabla `testimonios`.
Usa Vimeo API (lista + download links) + faster-whisper GPU. Resumible.
Uso: python transcribe_vimeo.py <PROJECT_ID>
"""
import os, sys, json, tempfile, urllib.request, time, subprocess

VIMEO_TOK = os.environ.get("VIMEO_TOKEN", "5cde1c170b388ff0fc1c43b06b88f2bf")
USER_ID = "167454748"
PROJECT = sys.argv[1] if len(sys.argv) > 1 else "15956676"
SUPABASE_URL = "https://pnivbhpqacugqtjfgmki.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuaXZiaHBxYWN1Z3F0amZnbWtpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3Nzc2MTIsImV4cCI6MjA5MTM1MzYxMn0.QYB-CmJ_0xE-b1opZens15Jz3xCg6voILRPHwhrzC5E"
TMP = tempfile.mkdtemp()

def vimeo(path):
    req = urllib.request.Request("https://api.vimeo.com" + path,
        headers={"Authorization": "Bearer " + VIMEO_TOK})
    return json.loads(urllib.request.urlopen(req, timeout=40).read())

def sb_exists(tid):
    try:
        req = urllib.request.Request(
            f"{SUPABASE_URL}/rest/v1/testimonios?id=eq.{tid}&select=id",
            headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"})
        return len(json.loads(urllib.request.urlopen(req, timeout=20).read())) > 0
    except Exception:
        return False

def sb_insert(row):
    body = json.dumps(row).encode()
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/testimonios",
        data=body, method="POST",
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}",
                 "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates"})
    urllib.request.urlopen(req, timeout=30).read()

# Listar todos los videos de la carpeta (paginado)
videos = []
page = 1
while True:
    r = vimeo(f"/users/{USER_ID}/projects/{PROJECT}/videos?fields=uri,name,duration,download,files&per_page=50&page={page}")
    videos += r.get("data", [])
    if not r.get("paging", {}).get("next"):
        break
    page += 1
print(f"Total testimonios en carpeta: {len(videos)}\n", flush=True)

print("Cargando faster-whisper GPU...", flush=True)
from faster_whisper import WhisperModel
t0 = time.time()
try:
    model = WhisperModel("medium", device="cuda", compute_type="float16")
    print(f"Modelo GPU cargado en {time.time()-t0:.1f}s\n", flush=True)
except Exception as e:
    print(f"GPU fallo ({e}), CPU small\n", flush=True)
    model = WhisperModel("small", device="cpu", compute_type="int8")

def best_url(v):
    # download[] (Pro) o files[] progressive — el de menor tamano sirve para audio
    cands = []
    for d in (v.get("download") or []):
        if d.get("link"):
            cands.append((d.get("size", 1e12), d["link"]))
    for f in (v.get("files") or []):
        if f.get("link") and f.get("quality") != "hls":
            cands.append((f.get("size", 1e12), f["link"]))
    if not cands:
        return None
    cands.sort()  # menor tamano primero (mas rapido descargar para audio)
    return cands[0][1]

ok = fail = 0
for i, v in enumerate(videos, 1):
    vid = v["uri"].split("/")[-1]
    tid = f"vimeo_{vid}"
    title = (v.get("name") or tid)[:120]
    if sb_exists(tid):
        print(f"[{i}/{len(videos)}] {tid} ya existe, skip", flush=True)
        continue
    # Descarga via player embebido (privacy.embed=public) con yt-dlp
    path = os.path.join(TMP, vid + ".mp3")
    try:
        subprocess.run(["yt-dlp", "-x", "--audio-format", "mp3", "--audio-quality", "5",
            "-o", os.path.join(TMP, vid + ".%(ext)s"), "--no-warnings", "--quiet",
            "--retries", "3", f"https://player.vimeo.com/video/{vid}"],
            capture_output=True, text=True, timeout=180)
        if not os.path.exists(path) or os.path.getsize(path) < 1000:
            print(f"[{i}/{len(videos)}] {tid} SKIP descarga", flush=True)
            fail += 1
            continue
        t = time.time()
        segs, info = model.transcribe(path, language="es", vad_filter=True,
                                      vad_parameters=dict(min_silence_duration_ms=500))
        text = " ".join(s.text.strip() for s in segs).strip()
        if len(text.split()) < 6:
            segs, info = model.transcribe(path, language="es", vad_filter=False)
            text = " ".join(s.text.strip() for s in segs).strip()
        if text and len(text.split()) >= 4:
            sb_insert({
                "id": tid, "source": "vimeo",
                "source_url": f"https://vimeo.com/{vid}",
                "title": title, "transcription": text,
                "duration_sec": int(v.get("duration") or 0),
                "transcribed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            })
            print(f"[{i}/{len(videos)}] {tid} OK {len(text.split())}w {time.time()-t:.0f}s: {title[:40]} :: {text[:60]}...", flush=True)
            ok += 1
        else:
            print(f"[{i}/{len(videos)}] {tid} vacio", flush=True)
            fail += 1
        os.remove(path)
    except Exception as e:
        print(f"[{i}/{len(videos)}] {tid} ERR: {str(e)[:90]}", flush=True)
        fail += 1

print(f"\n=== DONE: {ok} testimonios OK, {fail} fallidos de {len(videos)} ===", flush=True)

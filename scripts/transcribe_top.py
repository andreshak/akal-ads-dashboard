"""
Transcripcion RAPIDA top reels -> Supabase.
Descarga via Graph API media_url (CDN directo, SIN rate-limit) + faster-whisper GPU.
Hilo descargador paralelo (queue=4) solapado con inferencia GPU.
Resumible. Uso: python transcribe_top.py [limite]
"""
import os, sys, json, tempfile, threading, queue, time, urllib.request, subprocess

SUPABASE_URL = "https://pnivbhpqacugqtjfgmki.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuaXZiaHBxYWN1Z3F0amZnbWtpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3Nzc2MTIsImV4cCI6MjA5MTM1MzYxMn0.QYB-CmJ_0xE-b1opZens15Jz3xCg6voILRPHwhrzC5E"
LIMIT = int(sys.argv[1]) if len(sys.argv) > 1 else 500
TMP = tempfile.mkdtemp()

TOKEN = subprocess.run(["powershell", "-NoProfile", "-Command",
    "[Environment]::GetEnvironmentVariable('META_ACCESS_TOKEN','User')"],
    capture_output=True, text=True).stdout.strip()

def sb_get(path):
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/{path}",
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"})
    return json.loads(urllib.request.urlopen(req, timeout=30).read())

def sb_patch(post_id, data):
    body = json.dumps(data).encode()
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/ig_content?id=eq.{post_id}",
        data=body, method="PATCH",
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}",
                 "Content-Type": "application/json", "Prefer": "return=minimal"})
    urllib.request.urlopen(req, timeout=30).read()

def get_media_url(mid):
    try:
        u = f"https://graph.facebook.com/v22.0/{mid}?fields=media_url,media_type&access_token={TOKEN}"
        d = json.loads(urllib.request.urlopen(u, timeout=20).read())
        return d.get("media_url")
    except Exception:
        return None

def download(pid, mid):
    mu = get_media_url(mid)
    if not mu:
        return None
    path = os.path.join(TMP, f"{pid}.mp4")
    try:
        req = urllib.request.Request(mu, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=90) as r, open(path, "wb") as f:
            while True:
                chunk = r.read(262144)
                if not chunk:
                    break
                f.write(chunk)
        return path if os.path.getsize(path) > 1000 else None
    except Exception:
        return None

print(f"Token len: {len(TOKEN)} | Cargando faster-whisper GPU...", flush=True)
from faster_whisper import WhisperModel
t0 = time.time()
try:
    model = WhisperModel("medium", device="cuda", compute_type="float16")
    print(f"Modelo GPU medium cargado en {time.time()-t0:.1f}s\n", flush=True)
except Exception as e:
    print(f"GPU fallo ({e}), CPU small int8...", flush=True)
    model = WhisperModel("small", device="cpu", compute_type="int8")

posts = sb_get("ig_content?select=id,saves,shares,transcription&media_type=eq.REELS&order=saves.desc&limit=900")
scored = sorted(posts, key=lambda p: (p.get("saves") or 0) + (p.get("shares") or 0)*3, reverse=True)
pending = [p for p in scored if not p.get("transcription")][:LIMIT]
print(f"Total a procesar: {len(pending)} videos\n", flush=True)

q = queue.Queue(maxsize=4)
def downloader():
    for p in pending:
        q.put((p, download(p["id"], p["id"])))
    q.put(None)
threading.Thread(target=downloader, daemon=True).start()

ok = fail = i = 0
start = time.time()
while True:
    item = q.get()
    if item is None:
        break
    p, audio = item
    i += 1
    pid = p["id"]
    if not audio:
        print(f"[{i}/{len(pending)}] {pid} - SKIP descarga", flush=True)
        fail += 1
        continue
    try:
        t = time.time()
        segs, _ = model.transcribe(audio, language="es", vad_filter=True,
                                   vad_parameters=dict(min_silence_duration_ms=500))
        text = " ".join(s.text.strip() for s in segs).strip()
        if len(text.split()) < 8:
            segs, _ = model.transcribe(audio, language="es", vad_filter=False)
            text = " ".join(s.text.strip() for s in segs).strip()
        if text and len(text.split()) >= 5:
            sb_patch(pid, {"transcription": text, "transcribed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ")})
            print(f"[{i}/{len(pending)}] {pid} ({p.get('saves')}s) OK {len(text.split())}w {time.time()-t:.0f}s: {text[:60]}...", flush=True)
            ok += 1
        else:
            print(f"[{i}/{len(pending)}] {pid} - vacio", flush=True)
            fail += 1
        os.remove(audio)
    except Exception as e:
        print(f"[{i}/{len(pending)}] {pid} ERR: {str(e)[:90]}", flush=True)
        fail += 1
    if i % 25 == 0:
        el = time.time()-start
        print(f"  >>> {i}/{len(pending)} | OK {ok} | {el/60:.1f}min | ETA {(el/i)*(len(pending)-i)/60:.0f}min", flush=True)

print(f"\n=== DONE: {ok} OK, {fail} fallidos de {len(pending)} en {(time.time()-start)/60:.0f}min ===", flush=True)

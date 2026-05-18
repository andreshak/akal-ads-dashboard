"""
Descarga + transcribe los top 100 reels virales y guarda la transcripcion en Supabase.
Resumible: salta los que ya tienen transcripcion.
Uso: python transcribe_top.py [limite]
"""
import os, sys, json, subprocess, tempfile, urllib.request, urllib.parse, time

SUPABASE_URL = "https://pnivbhpqacugqtjfgmki.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuaXZiaHBxYWN1Z3F0amZnbWtpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3Nzc2MTIsImV4cCI6MjA5MTM1MzYxMn0.QYB-CmJ_0xE-b1opZens15Jz3xCg6voILRPHwhrzC5E"
LIMIT = int(sys.argv[1]) if len(sys.argv) > 1 else 100

def sb_get(path):
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/{path}",
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"})
    return json.loads(urllib.request.urlopen(req, timeout=30).read())

def sb_patch(post_id, data):
    body = json.dumps(data).encode()
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/ig_content?id=eq.{post_id}",
        data=body, method="PATCH",
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}",
                 "Content-Type": "application/json", "Prefer": "return=minimal"})
    urllib.request.urlopen(req, timeout=30).read()

print("Cargando whisper (modelo base)...")
import whisper
model = whisper.load_model("base")
print("Modelo cargado.\n")

# Top posts by viral score, only those without transcription yet
posts = sb_get(f"ig_content?select=id,permalink,saves,shares,transcription&media_type=eq.REELS&order=saves.desc&limit=400")
# Sort by viral score (saves + shares*3), filter pending
scored = sorted(posts, key=lambda p: (p.get("saves") or 0) + (p.get("shares") or 0)*3, reverse=True)
pending = [p for p in scored if not p.get("transcription") and p.get("permalink")][:LIMIT]

print(f"Total a procesar: {len(pending)} videos\n")
ok, fail = 0, 0
tmpdir = tempfile.mkdtemp()

for i, p in enumerate(pending, 1):
    pid, url = p["id"], p["permalink"]
    audio = os.path.join(tmpdir, f"{pid}.mp3")
    print(f"[{i}/{len(pending)}] {pid} ({p.get('saves')} saves) ...", flush=True)
    try:
        # Download audio only - use Chrome cookies (logged-in IG session) to avoid rate-limit
        base_args = ["yt-dlp", "-x", "--audio-format", "mp3", "--audio-quality", "5",
             "-o", os.path.join(tmpdir, f"{pid}.%(ext)s"), "--no-playlist",
             "--quiet", "--no-warnings", "--sleep-requests", "2",
             "--retries", "3", "--socket-timeout", "30"]
        # Try with Chrome cookies first, then Firefox, then anonymous
        for variant in (["--cookies-from-browser", "chrome"],
                        ["--cookies-from-browser", "firefox"], []):
            r = subprocess.run(base_args + variant + [url],
                               capture_output=True, text=True, timeout=120)
            if os.path.exists(audio):
                break
        if not os.path.exists(audio):
            print(f"  SKIP descarga fallo: {r.stderr[:110]}", flush=True)
            fail += 1
            time.sleep(8)  # back off on rate-limit
            continue
        # Transcribe (Spanish)
        result = model.transcribe(audio, language="es", fp16=False)
        text = result["text"].strip()
        if text:
            sb_patch(pid, {"transcription": text, "transcribed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ")})
            print(f"  OK ({len(text)} chars): {text[:80]}...", flush=True)
            ok += 1
        else:
            print("  SKIP: transcripcion vacia", flush=True)
            fail += 1
        os.remove(audio)
        time.sleep(3)  # avoid IG rate-limit
    except subprocess.TimeoutExpired:
        print("  SKIP: timeout descarga", flush=True)
        fail += 1
    except Exception as e:
        print(f"  ERROR: {str(e)[:120]}", flush=True)
        fail += 1

print(f"\n=== DONE: {ok} transcritos, {fail} fallidos de {len(pending)} ===")

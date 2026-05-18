"""
Transcribe testimonios locales (carpeta en disco) -> Supabase tabla `testimonios`.
Tema = subcarpeta. faster-whisper GPU. Resumible (id deterministico por ruta).
Uso: python transcribe_local.py "D:\\ruta\\Testimonios"
"""
import os, sys, json, glob, hashlib, subprocess, tempfile, urllib.request, time, re

ROOT = sys.argv[1] if len(sys.argv) > 1 else r"D:\Dropbox\Personal\Empresas\Academia Akal\Testimonios"
SUPABASE_URL = "https://pnivbhpqacugqtjfgmki.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuaXZiaHBxYWN1Z3F0amZnbWtpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3Nzc2MTIsImV4cCI6MjA5MTM1MzYxMn0.QYB-CmJ_0xE-b1opZens15Jz3xCg6voILRPHwhrzC5E"
TMP = tempfile.mkdtemp()
EXTS = (".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v", ".mp3", ".wav", ".m4a")

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

def theme_from_path(rel):
    parts = rel.replace("\\", "/").split("/")
    # primera subcarpeta significativa
    cat = parts[0] if len(parts) > 1 else "GENERAL"
    cat = cat.upper()
    if "PESO" in cat: return "PESO_IDEAL"
    if "SALUD" in cat: return "SALUD"
    if "PAREJA" in cat: return "PAREJA"
    if "EMOCIONAL" in cat: return "EMOCIONAL"
    if "CAMBIO RADICAL" in cat or "REDIT CAMBIO" in cat: return "CAMBIO_RADICAL"
    if "RETIRO" in cat: return "RETIRO"
    if "VIP" in cat: return "VIP_DESAFIO"
    return "GENERAL"

files = []
for f in glob.glob(os.path.join(ROOT, "**", "*"), recursive=True):
    if f.lower().endswith(EXTS):
        files.append(f)
files.sort()
print(f"Total archivos: {len(files)}\n", flush=True)

print("Cargando faster-whisper GPU...", flush=True)
from faster_whisper import WhisperModel
t0 = time.time()
try:
    model = WhisperModel("medium", device="cuda", compute_type="float16")
    print(f"Modelo GPU cargado en {time.time()-t0:.1f}s\n", flush=True)
except Exception as e:
    print(f"GPU fallo ({e}), CPU small\n", flush=True)
    model = WhisperModel("small", device="cpu", compute_type="int8")

ok = fail = 0
for i, src in enumerate(files, 1):
    rel = os.path.relpath(src, ROOT)
    tid = "local_" + hashlib.md5(rel.encode("utf-8")).hexdigest()[:24]
    title = os.path.splitext(os.path.basename(src))[0][:120]
    theme = theme_from_path(rel)
    if sb_exists(tid):
        print(f"[{i}/{len(files)}] {title[:40]} - ya existe, skip", flush=True)
        continue
    audio = os.path.join(TMP, tid + ".mp3")
    try:
        # Extraer audio (si ya es audio igual lo normaliza a mp3)
        subprocess.run(["ffmpeg", "-y", "-i", src, "-vn", "-ac", "1", "-ar", "16000",
                        "-acodec", "libmp3lame", "-q:a", "5", audio],
                       capture_output=True, timeout=300)
        if not os.path.exists(audio) or os.path.getsize(audio) < 800:
            print(f"[{i}/{len(files)}] {title[:40]} - SKIP audio", flush=True)
            fail += 1
            continue
        t = time.time()
        segs, info = model.transcribe(audio, language="es", vad_filter=True,
                                      vad_parameters=dict(min_silence_duration_ms=500))
        text = " ".join(s.text.strip() for s in segs).strip()
        if len(text.split()) < 6:
            segs, info = model.transcribe(audio, language="es", vad_filter=False)
            text = " ".join(s.text.strip() for s in segs).strip()
        if text and len(text.split()) >= 4:
            sb_insert({
                "id": tid, "source": "drive_local", "source_url": rel.replace("\\", "/"),
                "title": title, "transcription": text, "theme": theme,
                "duration_sec": int(getattr(info, "duration", 0) or 0),
                "transcribed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            })
            print(f"[{i}/{len(files)}] [{theme}] {title[:35]} OK {len(text.split())}w {time.time()-t:.0f}s: {text[:55]}...", flush=True)
            ok += 1
        else:
            print(f"[{i}/{len(files)}] {title[:40]} - vacio", flush=True)
            fail += 1
        os.remove(audio)
    except Exception as e:
        print(f"[{i}/{len(files)}] {title[:40]} ERR: {str(e)[:80]}", flush=True)
        fail += 1
    if i % 25 == 0:
        el = time.time()-t0
        print(f"  >>> {i}/{len(files)} | OK {ok} | {el/60:.1f}min | ETA {(el/i)*(len(files)-i)/60:.0f}min", flush=True)

print(f"\n=== DONE: {ok} testimonios locales OK, {fail} fallidos de {len(files)} ===", flush=True)

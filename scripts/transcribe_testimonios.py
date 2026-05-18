"""
Descarga + transcribe testimonios de alumnos -> Supabase tabla `testimonios`.
Fuentes: Vimeo (folder/showcase/links via yt-dlp) + Google Drive (folder via gdown).
Resumible. Uso:
  python transcribe_testimonios.py vimeo "URL_FOLDER_O_SHOWCASE"
  python transcribe_testimonios.py drive "URL_CARPETA_DRIVE"
"""
import os, sys, json, glob, subprocess, tempfile, urllib.request, time

SUPABASE_URL = "https://pnivbhpqacugqtjfgmki.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuaXZiaHBxYWN1Z3F0amZnbWtpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3Nzc2MTIsImV4cCI6MjA5MTM1MzYxMn0.QYB-CmJ_0xE-b1opZens15Jz3xCg6voILRPHwhrzC5E"
MODE = sys.argv[1] if len(sys.argv) > 1 else ""
SRC = sys.argv[2] if len(sys.argv) > 2 else ""
TMP = tempfile.mkdtemp()

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

print("Cargando faster-whisper GPU...", flush=True)
from faster_whisper import WhisperModel
t0 = time.time()
try:
    model = WhisperModel("medium", device="cuda", compute_type="float16")
    print(f"Modelo GPU cargado en {time.time()-t0:.1f}s", flush=True)
except Exception as e:
    print(f"GPU fallo ({e}), CPU small", flush=True)
    model = WhisperModel("small", device="cpu", compute_type="int8")

# 1) Descargar audios al TMP segun fuente
print(f"\nDescargando desde {MODE}: {SRC}", flush=True)
if MODE == "vimeo":
    subprocess.run(["yt-dlp", "-x", "--audio-format", "mp3", "--audio-quality", "5",
        "-o", os.path.join(TMP, "%(id)s__%(title).80s.%(ext)s"),
        "--ignore-errors", "--no-warnings", "-N", "4", SRC],
        timeout=3600)
elif MODE == "drive":
    subprocess.run(["python", "-m", "gdown", "--folder", "--remaining-ok",
        "-O", TMP, SRC], timeout=3600)
    # Extraer audio de cualquier video descargado
    for v in glob.glob(os.path.join(TMP, "**", "*"), recursive=True):
        if v.lower().endswith((".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v")):
            base = os.path.splitext(os.path.basename(v))[0]
            mp3 = os.path.join(TMP, base + ".mp3")
            subprocess.run(["ffmpeg", "-y", "-i", v, "-vn", "-acodec", "libmp3lame",
                            "-q:a", "5", mp3], capture_output=True, timeout=300)
else:
    print("Modo invalido. Usa: vimeo|drive  URL", flush=True)
    sys.exit(1)

audios = sorted(glob.glob(os.path.join(TMP, "*.mp3")))
print(f"\n{len(audios)} audios descargados. Transcribiendo...\n", flush=True)

ok = fail = 0
for i, a in enumerate(audios, 1):
    fn = os.path.basename(a)
    tid = f"{MODE}_{fn.split('__')[0][:40]}" if "__" in fn else f"{MODE}_{os.path.splitext(fn)[0][:40]}"
    title = (fn.split('__', 1)[1].rsplit('.', 1)[0] if "__" in fn else os.path.splitext(fn)[0])[:120]
    if sb_exists(tid):
        print(f"[{i}/{len(audios)}] {tid} - ya existe, skip", flush=True)
        continue
    try:
        t = time.time()
        segs, info = model.transcribe(a, language="es", vad_filter=True,
                                      vad_parameters=dict(min_silence_duration_ms=500))
        text = " ".join(s.text.strip() for s in segs).strip()
        if len(text.split()) < 8:
            segs, info = model.transcribe(a, language="es", vad_filter=False)
            text = " ".join(s.text.strip() for s in segs).strip()
        if text and len(text.split()) >= 5:
            sb_insert({
                "id": tid, "source": MODE, "source_url": SRC, "title": title,
                "transcription": text, "duration_sec": int(getattr(info, "duration", 0) or 0),
                "transcribed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            })
            print(f"[{i}/{len(audios)}] {tid} OK {len(text.split())}w {time.time()-t:.0f}s: {text[:70]}...", flush=True)
            ok += 1
        else:
            print(f"[{i}/{len(audios)}] {tid} - vacio", flush=True)
            fail += 1
    except Exception as e:
        print(f"[{i}/{len(audios)}] {tid} ERR: {str(e)[:90]}", flush=True)
        fail += 1

print(f"\n=== DONE: {ok} testimonios transcritos, {fail} fallidos ===", flush=True)

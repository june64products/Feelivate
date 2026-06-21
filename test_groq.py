"""
test_groq.py — Full fallback chain + Groq Whisper test (verified model IDs)
Run: python3 test_groq.py
"""

import os, sys, time, io

try:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))
    load_dotenv()
    print("✅ .env loaded")
except ImportError:
    print("⚠️  python-dotenv missing")

from openai import OpenAI

api_key = os.getenv("GROQ_API_KEY")
print("\n" + "="*60)
print("  GROQ FALLBACK CHAIN + WHISPER DIAGNOSTIC")
print("="*60)

if not api_key:
    print("❌ GROQ_API_KEY set nahi hai!"); sys.exit(1)

masked = api_key[:8] + "..." + api_key[-4:]
print(f"✅ GROQ_API_KEY: {masked}\n")

client = OpenAI(api_key=api_key, base_url="https://api.groq.com/openai/v1")

# ── LLM Fallback Chain Test ──────────────────────────────────────────────────
CHAIN = [
    ("openai/gpt-oss-120b",    "groq",   "1st — Groq OSS 120B (primary)"),
    ("openai/gpt-oss-20b",     "groq",   "2nd — Groq OSS 20B"),
    ("llama-3.3-70b-versatile","groq",   "3rd — Llama 70B"),
    ("gpt-4o",                 "openai", "4th — OpenAI GPT-4o (last resort)"),
]

print("── LLM Fallback Chain ───────────────────────────────────")
results = {}
for model, provider, label in CHAIN:
    print(f"\n🔍 {label}")
    print(f"   Model: {model} (via {provider})")
    start = time.time()
    try:
        if provider == "groq":
            test_client = client
        else:
            if not openai_key:
                print(f"   ⚠️  OPENAI_API_KEY not set — skipping")
                results[model] = "skip"
                continue
            test_client = OpenAI(api_key=openai_key)
        resp = test_client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "Reply with exactly: OK"}],
            temperature=0.1, max_tokens=10,
        )
        elapsed = time.time() - start
        reply = resp.choices[0].message.content.strip()
        print(f"   ✅ SUCCESS ({elapsed:.2f}s) → '{reply}'")
        results[model] = "ok"
    except Exception as e:
        elapsed = time.time() - start
        err = str(e)
        print(f"   ❌ FAILED  ({elapsed:.2f}s)")
        print(f"   Error: {err[:120]}")
        if "429" in err or "rate_limit" in err.lower():
            print("   ⚡ RATE LIMIT — app will auto-jump to next model")
        elif "decommissioned" in err.lower():
            print("   🗑️  DECOMMISSIONED — model hata diya gaya")
        results[model] = "fail"

# ── Groq Whisper Test ────────────────────────────────────────────────────────
print("\n── Groq Whisper Large v3 Turbo ──────────────────────────")
print("🔍 Testing whisper-large-v3-turbo...")
try:
    silent_wav = (
        b'RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00'
        b'\x01\x00D\xac\x00\x00\x88X\x01\x00\x02\x00\x10\x00'
        b'data\x00\x00\x00\x00'
    )
    buf = io.BytesIO(silent_wav)
    start = time.time()
    transcript = client.audio.transcriptions.create(
        model="whisper-large-v3-turbo",
        file=("test.wav", buf, "audio/wav"),
        response_format="text",
    )
    elapsed = time.time() - start
    print(f"   ✅ Whisper OK ({elapsed:.2f}s) → '{str(transcript).strip()}'")
    whisper_ok = True
except Exception as e:
    elapsed = time.time() - start
    err = str(e)
    if any(kw in err.lower() for kw in ["too short", "duration", "audio_too_short", "minimum"]):
        print(f"   ✅ Whisper REACHABLE ({elapsed:.2f}s) — silent clip rejected (expected)")
        whisper_ok = True
    elif "rate_limit" in err.lower() or "429" in err:
        print(f"   ⚠️  Whisper rate limited (endpoint exists, just busy)")
        whisper_ok = True
    else:
        print(f"   ❌ Whisper error: {err[:150]}")
        whisper_ok = False

# ── Summary ───────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("  FINAL SUMMARY")
print("="*60)
ok_models  = [f"  ✅ {label} ({m})" for m, provider, label in CHAIN if results.get(m) == "ok"]
fail_models = [f"  ❌ {label} ({m})" for m, provider, label in CHAIN if results.get(m) == "fail"]
skip_models = [f"  ⚠️  {label} ({m}) — skipped" for m, provider, label in CHAIN if results.get(m) == "skip"]

print("\n[LLM Fallback Chain]")
for x in ok_models:   print(x)
for x in fail_models: print(x)
for x in skip_models: print(x)

print("\n[Whisper]")
print(f"  {'✅' if whisper_ok else '❌'} Groq whisper-large-v3-turbo")

if ok_models:
    print("\n✅ App theek chalega — fallback chain active hai!")
else:
    print("\n🚨 Koi bhi model kaam nahi kar raha! Keys check karo.")
print("="*60 + "\n")

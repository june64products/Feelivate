import os
import re
from typing import List, Optional

from dotenv import load_dotenv
from loguru import logger
from openai import OpenAI
# import google.generativeai as genai (Moved inside functions to prevent hang)


_groq_client: Optional[OpenAI] = None
_openai_client: Optional[OpenAI] = None
_gemini_configured = False

# ─── Consistency System Prompt ───────────────────────────────────────────────
# Injected into EVERY LLM call so that fallback switches are invisible to user.
# This ensures all models — whether OSS 120B, 20B, Llama, or GPT — respond in
# the exact same tone, format, and style. No <think> tags, no preambles.
CONSISTENCY_INSTRUCTION = (
    "CRITICAL RULES YOU MUST FOLLOW:\n"
    "1. Output ONLY the final direct response. Do NOT wrap your answer in <think>, <reasoning>, or any XML/HTML tags.\n"
    "2. Do NOT show internal reasoning, chain-of-thought, or preambles like 'Sure!' or 'Of course!'.\n"
    "3. Maintain a warm, professional, emotionally intelligent coaching tone throughout.\n"
    "4. Keep formatting consistent: use markdown where appropriate, keep lists clean, keep paragraphs short.\n"
    "5. If you are returning JSON, return ONLY raw JSON with no surrounding text or markdown code fences.\n"
    "6. Never mention which AI model you are, your version, or your provider.\n"
    "7. Respond as if you are always the same unified AI coach — the user must never notice any change."
)
# ─────────────────────────────────────────────────────────────────────────────

# ─── Fallback Chain Config ───────────────────────────────────────────────────
# Models tried in order. All Groq-hosted models use Groq client.
# Final fallback is OpenAI gpt-4o-mini (requires OPENAI_API_KEY).
FALLBACK_CHAIN = [
    ("openai/gpt-oss-120b",    "groq"),    # 1st — Groq OSS 120B   (primary reasoning)
    ("openai/gpt-oss-20b",     "groq"),    # 2nd — Groq OSS 20B    (lighter MoE)
    ("llama-3.3-70b-versatile","groq"),    # 3rd — Llama 70B       (reliable fallback)
    ("gpt-4o-mini",            "openai"),  # 4th — OpenAI GPT-4o-mini (last resort)
]
# ─────────────────────────────────────────────────────────────────────────────


def _get_groq_client() -> OpenAI:
    global _groq_client
    if _groq_client is None:
        load_dotenv()
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            logger.error("GROQ_API_KEY is not set")
            raise RuntimeError("GROQ_API_KEY is required for Groq")
        base_url = "https://api.groq.com/openai/v1"
        _groq_client = OpenAI(api_key=api_key, base_url=base_url)
    return _groq_client


# Cheapest + fastest Groq model — used for lightweight side tasks like chat-title generation.
TITLE_MODEL = "llama-3.1-8b-instant"


def generate_session_title(user_message: str, assistant_reply: str = "") -> Optional[str]:
    """
    Generate a short 3-5 word sidebar title from a session's first exchange.
    Uses Groq's cheapest model (see TITLE_MODEL). Returns a cleaned title, or
    None on any failure so the caller can fall back to existing behaviour.
    """
    user_message = (user_message or "").strip()
    if not user_message:
        return None

    convo = f"User: {user_message[:500]}"
    if assistant_reply:
        convo += f"\nAssistant: {assistant_reply.strip()[:500]}"

    try:
        client = _get_groq_client()
        resp = client.chat.completions.create(
            model=TITLE_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You generate very short titles for a chat conversation. "
                        "Reply with ONLY a 3-5 word title that captures the topic. "
                        "No quotes, no surrounding punctuation, no trailing period, "
                        "no preamble like 'Title:'. Reply in the user's language."
                    ),
                },
                {"role": "user", "content": convo},
            ],
            max_tokens=16,
            temperature=0.3,
        )
        title = (resp.choices[0].message.content or "").strip()
        if not title:
            return None
        # Clean up: take first line, strip wrapping quotes / 'Title:' prefix / trailing punctuation
        title = title.splitlines()[0].strip().strip('"\'')
        for prefix in ("Title:", "title:", "TITLE:"):
            if title.startswith(prefix):
                title = title[len(prefix):].strip()
        title = title.rstrip(".!,;:").strip()
        # Hard cap so the sidebar never overflows if the model ignores the word limit
        if len(title) > 60:
            title = title[:57].rstrip() + "..."
        return title or None
    except Exception as e:
        logger.warning(f"[Title] generation failed (non-fatal): {e}")
        return None


def _get_openai_client() -> OpenAI:
    global _openai_client
    if _openai_client is None:
        load_dotenv()
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            logger.error("OPENAI_API_KEY is not set")
            # We don't raise here yet in case only Groq is needed, 
            # but create_embedding will fail if it calls this.
            return None
        
        base_url = os.getenv("OPENAI_BASE_URL")
        if base_url:
            _openai_client = OpenAI(api_key=api_key, base_url=base_url)
        else:
            _openai_client = OpenAI(api_key=api_key)
    return _openai_client


def _get_llm_provider() -> str:
    """Determine which LLM provider to use based on environment variables."""
    load_dotenv()
    if os.getenv("GROQ_API_KEY"):
        return "groq"
    elif os.getenv("GEMINI_API_KEY"):
        return "gemini"
    elif os.getenv("OPENAI_API_KEY"):
        return "openai"
    else:
        raise RuntimeError("No API key found. Set GROQ_API_KEY, GEMINI_API_KEY or OPENAI_API_KEY")


def _configure_gemini():
    """Configure Google Gemini API."""
    global _gemini_configured
    if not _gemini_configured:
        load_dotenv()
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            logger.error("GEMINI_API_KEY is not set")
            raise RuntimeError("GEMINI_API_KEY is required")
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        _gemini_configured = True


def _inject_consistency(system: Optional[str]) -> str:
    """Inject the consistency instruction into any system prompt."""
    if system:
        if "CRITICAL RULES YOU MUST FOLLOW" not in system:
            return f"{system}\n\n{CONSISTENCY_INSTRUCTION}"
        return system
    return CONSISTENCY_INSTRUCTION


def _inject_consistency_messages(messages: List[dict]) -> List[dict]:
    """Inject the consistency instruction into a messages array."""
    # Check if already injected
    for m in messages:
        if m.get("role") == "system" and "CRITICAL RULES YOU MUST FOLLOW" in m.get("content", ""):
            return messages
    
    # Prepend as first system message
    return [{"role": "system", "content": CONSISTENCY_INSTRUCTION}] + messages


def _strip_think_tags(text: str) -> str:
    """Remove <think>...</think> blocks and similar reasoning wrappers from output."""
    # Remove <think>...</think> blocks (some OSS models produce these)
    text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL)
    # Remove <reasoning>...</reasoning> blocks
    text = re.sub(r'<reasoning>.*?</reasoning>', '', text, flags=re.DOTALL)
    # Remove leading/trailing whitespace left behind
    return text.strip()


def _detect_provider(model_name: str) -> str:
    """Detect which provider to route a model to based on its name."""
    ml = model_name.lower()
    if "gemini" in ml:
        return "gemini"
    elif ml.startswith("openai/") or "oss" in ml or "llama" in ml or "mixtral" in ml or "gemma" in ml:
        return "groq"
    elif "gpt" in ml or ml.startswith("o1") or ml.startswith("o3"):
        return "openai"
    return "groq"  # default to groq


# ─── Core LLM Call Functions ────────────────────────────────────────────────


def call_llm(
    prompt: str,
    system: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 4000,
    model_override: Optional[str] = None,
    presence_penalty: float = 0.0,
    frequency_penalty: float = 0.0
) -> str:
    """
    Single-prompt LLM call with consistency enforcement.

    - If model_override is given: routes directly to the specified model/provider.
    - Otherwise: runs through the full fallback chain
      (OSS 120B → OSS 20B → Llama 70B → GPT-4o-mini) so the user never
      experiences a hard failure due to a rate-limit or outage.
    """
    # Inject consistency into system prompt first
    system = _inject_consistency(system)

    # ── Explicit model override ────────────────────────────────────────────────
    if model_override:
        provider = _detect_provider(model_override)
        if provider == "gemini":
            return _call_gemini(prompt, system, temperature, max_tokens, model_override)
        elif provider == "groq":
            return _call_groq(prompt, system, temperature, max_tokens, model_override)
        else:  # openai
            return _call_openai(
                prompt, system, temperature, max_tokens, model_override,
                presence_penalty, frequency_penalty
            )

    # ── Default: use the fallback chain (OSS 120B first) ──────────────────────
    # Convert to messages format for call_with_fallback_chain
    messages: List[dict] = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    # Note: consistency is already injected into system above; pass raw so it
    # isn't double-injected inside call_with_fallback_chain.
    return _call_with_fallback_chain_raw(
        messages, temperature, max_tokens, presence_penalty, frequency_penalty
    )


def _call_gemini(prompt: str, system: Optional[str] = None, temperature: float = 0.7, max_tokens: int = 4000, model_override: Optional[str] = None) -> str:
    try:
        load_dotenv()
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY is required")
            
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        
        # Determine model name
        model_name = model_override or os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
        
        # Remove "models/" prefix if present for consistency
        if model_name.startswith("models/"):
            model_name = model_name.replace("models/", "")
            
        logger.info(f"Calling Gemini model: {model_name} via SDK")
        
        model = genai.GenerativeModel(
            model_name=model_name,
            system_instruction=system
        )
        
        generation_config = {
            "temperature": temperature,
            "max_output_tokens": max_tokens,
        }
        
        response = model.generate_content(
            prompt,
            generation_config=generation_config
        )
        
        if not response.text:
            logger.error(f"Gemini returned empty response: {response}")
            raise RuntimeError("Gemini returned empty response")
            
        logger.info(f"Gemini call succeeded, response length: {len(response.text)}")
        return _strip_think_tags(response.text)

    except Exception as e:
        logger.exception(f"Gemini call failed: {str(e)}")
        raise RuntimeError(f"Gemini error: {e}")


def _call_groq(prompt: str, system: Optional[str] = None, temperature: float = 0.7, max_tokens: int = 4000, model_override: Optional[str] = None) -> str:
    """Call Groq API — sends the model name as-is (no remapping)."""
    try:
        client = _get_groq_client()
        model = model_override or os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        
        resp = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        
        content = resp.choices[0].message.content or ""
        text = _strip_think_tags(content)
        logger.info("Groq call succeeded", extra={"model": model, "tokens": resp.usage})
        return text
    except Exception as e:
        logger.exception("Groq call failed")
        raise RuntimeError(f"Groq error: {e}")


def _call_openai(
    prompt: str, 
    system: Optional[str] = None, 
    temperature: float = 0.7, 
    max_tokens: int = 4000, 
    model_override: Optional[str] = None,
    presence_penalty: float = 0.0,
    frequency_penalty: float = 0.0
) -> str:
    try:
        client = _get_openai_client()
        if not client:
            raise RuntimeError("OpenAI client not configured (missing API key)")
            
        model = model_override or os.getenv("OPENAI_LLM_MODEL", "gpt-4o-mini")
        is_reasoning_model = model.startswith("o1") or model.startswith("o3")
        
        messages = []
        if system:
            # Reasoning models prefer 'developer' role for system instructions
            role = "developer" if is_reasoning_model else "system"
            messages.append({"role": role, "content": system})
        messages.append({"role": "user", "content": prompt})
        
        # Build API parameters
        kwargs = {
            "model": model,
            "messages": messages,
        }
        
        if is_reasoning_model:
            # Reasoning models (o-series) don't support temperature or standard max_tokens
            # and require max_completion_tokens instead.
            kwargs["max_completion_tokens"] = max_tokens
        else:
            kwargs["temperature"] = temperature
            kwargs["max_tokens"] = max_tokens
            kwargs["presence_penalty"] = presence_penalty
            kwargs["frequency_penalty"] = frequency_penalty

        resp = client.chat.completions.create(**kwargs)
        content = resp.choices[0].message.content or ""
        text = _strip_think_tags(content)
        logger.info("LLM call succeeded", extra={"model": model, "tokens": resp.usage})
        return text
    except Exception as e:
        logger.exception("LLM call failed")
        raise RuntimeError(f"LLM error: {e}")


def create_embedding(text: str) -> List[float]:
    """Generate embeddings using OpenAI text-embedding-3-large."""
    try:
        client = _get_openai_client()
        if not client:
            raise RuntimeError("OpenAI client not configured for embeddings")
        model = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-large")
        resp = client.embeddings.create(model=model, input=text)
        vec = resp.data[0].embedding
        logger.info("Embedding created", extra={"model": model, "length": len(vec)})
        return list(vec)
    except Exception as e:
        logger.exception("Embedding creation failed")
        raise RuntimeError(f"Embedding error: {e}")


def call_llm_chat(
    messages: List[dict],
    temperature: float = 0.7,
    max_tokens: int = 4000,
    model_override: Optional[str] = None,
    presence_penalty: float = 0.4,
    frequency_penalty: float = 0.35
) -> str:
    """
    Call LLM with a multi-turn messages array (ChatGPT-style).

    - If model_override is given: routes directly to that model/provider.
    - Otherwise: runs through the full fallback chain
      (OSS 120B → OSS 20B → Llama 70B → GPT-4o-mini).
    Consistency is enforced automatically in both paths.
    """
    # Inject consistency into messages
    messages = _inject_consistency_messages(messages)

    # ── Explicit model override ────────────────────────────────────────────────
    if model_override:
        try:
            provider = _detect_provider(model_override)
            if provider == "groq":
                client = _get_groq_client()
                resp = client.chat.completions.create(
                    model=model_override,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
            else:  # openai
                client = _get_openai_client()
                if not client:
                    raise RuntimeError("OpenAI client not configured (missing API key)")
                resp = client.chat.completions.create(
                    model=model_override,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    presence_penalty=presence_penalty,
                    frequency_penalty=frequency_penalty,
                )
            content = resp.choices[0].message.content or ""
            text = _strip_think_tags(content)
            logger.info("LLM chat call succeeded", extra={"model": model_override})
            return text
        except Exception as e:
            logger.exception("LLM chat call failed")
            raise RuntimeError(f"LLM chat error: {e}")

    # ── Default: use the fallback chain (OSS 120B first) ──────────────────────
    # Consistency already injected above; use raw helper to avoid double-inject.
    return _call_with_fallback_chain_raw(
        messages, temperature, max_tokens, presence_penalty, frequency_penalty
    )


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _is_retryable_error(e: Exception) -> bool:
    """Return True if this error means we should try the next model."""
    err = str(e).lower()
    return any(kw in err for kw in [
        "429", "rate_limit", "rate limit", "too many requests",
        "decommissioned", "model_not_found", "model not found",
        "503", "service unavailable", "overloaded",
    ])


def _call_with_fallback_chain_raw(
    messages: List[dict],
    temperature: float = 0.7,
    max_tokens: int = 4000,
    presence_penalty: float = 0.4,
    frequency_penalty: float = 0.35,
) -> str:
    """
    Internal helper: runs through FALLBACK_CHAIN without re-injecting consistency
    (assumes caller has already injected it). Use call_with_fallback_chain() for
    the public-facing version.
    """
    tried: List[str] = []
    last_error = None

    for model_name, provider in FALLBACK_CHAIN:
        if model_name in tried:
            continue
        tried.append(model_name)
        try:
            if provider == "groq":
                client = _get_groq_client()
                resp = client.chat.completions.create(
                    model=model_name,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
            else:  # openai
                client = _get_openai_client()
                if not client:
                    raise RuntimeError("OpenAI client not configured (set OPENAI_API_KEY)")
                resp = client.chat.completions.create(
                    model=model_name,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    presence_penalty=presence_penalty,
                    frequency_penalty=frequency_penalty,
                )

            content = (resp.choices[0].message.content or "").strip()
            content = _strip_think_tags(content)
            logger.info(f"[Fallback chain] ✅ {provider}/{model_name}")
            return content
        except Exception as e:
            last_error = e
            if _is_retryable_error(e):
                logger.warning(
                    f"[Fallback chain] ⚠️  {provider}/{model_name} failed "
                    f"({type(e).__name__}: {str(e)[:120]}), trying next..."
                )
                continue
            # Non-retryable (e.g. auth error) — bubble up immediately
            logger.exception(f"[Fallback chain] ❌ {provider}/{model_name} non-retryable error")
            raise RuntimeError(f"{provider}/{model_name} error: {e}")

    logger.exception("[Fallback chain] ❌ All models in fallback chain failed")
    raise RuntimeError(
        f"All models in fallback chain failed. Tried: {tried}. Last error: {last_error}"
    )


def call_with_fallback_chain(
    messages: List[dict],
    temperature: float = 0.7,
    max_tokens: int = 4000,
    presence_penalty: float = 0.4,
    frequency_penalty: float = 0.35,
) -> str:
    """
    Public API: Call LLM with auto-fallback cascade ensuring seamless consistency.

    Priority order (user never notices the switch):
      1. openai/gpt-oss-120b    (Groq — primary MoE reasoning model)
      2. openai/gpt-oss-20b     (Groq — lighter MoE, same quality style)
      3. llama-3.3-70b-versatile (Groq — fast, reliable fallback)
      4. gpt-4o-mini             (OpenAI — final safety net)

    Seamless because:
      - CONSISTENCY_INSTRUCTION is injected into every call
      - <think> / <reasoning> tags are stripped from all outputs
      - Same temperature & penalties are used at every tier
    """
    # Inject consistency once here; _call_with_fallback_chain_raw skips it
    messages = _inject_consistency_messages(messages)
    return _call_with_fallback_chain_raw(
        messages, temperature, max_tokens, presence_penalty, frequency_penalty
    )


def call_groq_transcribe(audio_bytes: bytes, filename: str = "recording.webm") -> str:
    """
    Transcribe audio using Groq Whisper Large v3 Turbo.
    Much faster than OpenAI Whisper — typically <1s response.
    """
    import io
    try:
        client = _get_groq_client()
        audio_buffer = io.BytesIO(audio_bytes)
        # Detect content type from filename extension
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "webm"
        content_type_map = {
            "webm": "audio/webm", "mp3": "audio/mpeg", "mp4": "audio/mp4",
            "wav": "audio/wav", "ogg": "audio/ogg", "m4a": "audio/mp4",
            "flac": "audio/flac",
        }
        content_type = content_type_map.get(ext, "audio/webm")
        transcript = client.audio.transcriptions.create(
            model="whisper-large-v3-turbo",
            file=(filename, audio_buffer, content_type),
            response_format="text",
        )
        text = transcript if isinstance(transcript, str) else str(transcript)
        logger.info(f"[Groq Whisper] ✅ {len(audio_bytes)} bytes → {len(text)} chars")
        return text.strip()
    except Exception as e:
        logger.exception("[Groq Whisper] transcription failed")
        raise RuntimeError(f"Groq Whisper error: {e}")
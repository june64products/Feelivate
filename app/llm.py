import os
from typing import List, Optional

from dotenv import load_dotenv
from loguru import logger
from openai import OpenAI
# import google.generativeai as genai (Moved inside functions to prevent hang)


_groq_client: Optional[OpenAI] = None
_openai_client: Optional[OpenAI] = None
_gemini_configured = False

# ─── Fallback Chain Config ───────────────────────────────────────────────────
# Each model is tried in order on rate-limit / decommission errors.
# Final fallback is OpenAI gpt-4o (requires OPENAI_API_KEY).
# NOTE: Use exact IDs from Groq's /models API (verified active 2026-05).
GROQ_FALLBACK_CHAIN = [
    "openai/gpt-oss-120b",        # 1st — Groq's hosted OSS 120B (primary)
    "openai/gpt-oss-20b",         # 2nd — Groq's hosted OSS 20B
    "llama-3.3-70b-versatile",    # 3rd — Llama 70B (reliable fallback)
    "llama-3.1-8b-instant",       # 4th — small, ultra-fast
]
OPENAI_FALLBACK_MODEL = "gpt-4o"

# Internal shorthand → real Groq model mapping (legacy support)
MODEL_MAP = {
    "gpt-oss-120b": "openai/gpt-oss-120b",
    "gpt-oss-20b":  "openai/gpt-oss-20b",
}
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


def call_llm(
    prompt: str, 
    system: Optional[str] = None, 
    temperature: float = 0.7, 
    max_tokens: int = 4000, 
    model_override: Optional[str] = None,
    presence_penalty: float = 0.0,
    frequency_penalty: float = 0.0
) -> str:
    # If model_override is provided, use it to force the correct provider
    if model_override:
        model_lower = model_override.lower()
        if "gemini" in model_lower:
            return _call_gemini(prompt, system, temperature, max_tokens, model_override)
        elif "llama" in model_lower or "mixtral" in model_lower or "gemma" in model_lower or "oss" in model_lower:
            return _call_groq(prompt, system, temperature, max_tokens, model_override)
        elif ("gpt" in model_lower or model_lower.startswith("o1") or model_lower.startswith("o3")) and "oss" not in model_lower:
            return _call_openai(
                prompt, system, temperature, max_tokens, model_override, 
                presence_penalty, frequency_penalty
            )
            
    # Fallback to default provider
    provider = _get_llm_provider()
    
    if provider == "groq":
        return _call_groq(prompt, system, temperature, max_tokens, model_override)
    elif provider == "gemini":
        return _call_gemini(prompt, system, temperature, max_tokens, model_override)
    else:
        return _call_openai(
            prompt, system, temperature, max_tokens, model_override,
            presence_penalty, frequency_penalty
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
        return response.text

    except Exception as e:
        logger.exception(f"Gemini call failed: {str(e)}")
        raise RuntimeError(f"Gemini error: {e}")


def _call_groq(prompt: str, system: Optional[str] = None, temperature: float = 0.7, max_tokens: int = 4000, model_override: Optional[str] = None) -> str:
    try:
        client = _get_groq_client()
        model = model_override or os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        
        # If using the specialized openai OSS reasoning model on Groq
        if "gpt-oss-120b" in model:
            try:
                actual_model = "llama-3.3-70b-versatile" # Map the placeholder to a real Groq model
                resp = client.chat.completions.create(
                    model=actual_model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
            except Exception as api_err:
                if "Rate limit" in str(api_err) or "429" in str(api_err) or "rate_limit_exceeded" in str(api_err):
                    fallback_model = "llama-3.1-8b-instant"
                    logger.warning(f"Rate limit hit for {model}. Falling back to {fallback_model}!")
                    resp = client.chat.completions.create(
                        model=fallback_model,
                        messages=messages,
                        temperature=temperature,
                        max_tokens=max_tokens,
                    )
                else:
                    raise api_err
        else:
            try:
                resp = client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
            except Exception as api_err:
                if "Rate limit" in str(api_err) or "429" in str(api_err) or "rate_limit_exceeded" in str(api_err):
                    fallback_model = "llama-3.1-8b-instant"
                    logger.warning(f"Rate limit hit for {model}. Falling back to {fallback_model}!")
                    resp = client.chat.completions.create(
                        model=fallback_model,
                        messages=messages,
                        temperature=temperature,
                        max_tokens=max_tokens,
                    )
                else:
                    raise api_err
        
        content = resp.choices[0].message.content or ""
        text = content.strip()
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
            # Optional: Set reasoning effort if needed
            # kwargs["reasoning_effort"] = "medium"
        else:
            kwargs["temperature"] = temperature
            kwargs["max_tokens"] = max_tokens
            kwargs["presence_penalty"] = presence_penalty
            kwargs["frequency_penalty"] = frequency_penalty

        resp = client.chat.completions.create(**kwargs)
        content = resp.choices[0].message.content or ""
        text = content.strip()
        logger.info("LLM call succeeded", extra={"model": model, "tokens": resp.usage})
        return text
    except Exception as e:
        logger.exception("LLM call failed")
        raise RuntimeError(f"LLM error: {e}")


def create_embedding(text: str) -> List[float]:
    try:
        client = _get_openai_client()
        if not client:
            raise RuntimeError("OpenAI client not configured for embeddings")
        model = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
        resp = client.embeddings.create(model=model, input=text)
        vec = resp.data[0].embedding
        logger.info("Embedding created", extra={"model": model, "length": len(vec)})
        return list(vec)
    except Exception as e:
        logger.exception("Embedding creation failed")
        raise RuntimeError(f"Embedding error: {e}")


def call_llm_chat(
    messages: List[dict],
    temperature: float = 0.85,
    max_tokens: int = 4000,
    model_override: Optional[str] = None,
    presence_penalty: float = 0.4,
    frequency_penalty: float = 0.35
) -> str:
    """
    Call LLM with a multi-turn messages array (ChatGPT-style).
    Routes to Groq if OSS models are specified, otherwise uses OpenAI.
    """
    try:
        model = model_override or os.getenv("OPENAI_LLM_MODEL", "gpt-4o-mini")
        model_lower = model.lower()
        
        # Route to Groq for OSS models
        if "llama" in model_lower or "mixtral" in model_lower or "oss" in model_lower:
            client = _get_groq_client()
            if not client:
                raise RuntimeError("Groq client not configured")
                
            if "gpt-oss-120b" in model:
                try:
                    actual_model = "llama-3.3-70b-versatile" # Map the placeholder to a real Groq model
                    resp = client.chat.completions.create(
                        model=actual_model,
                        messages=messages,
                        temperature=temperature,
                        max_tokens=max_tokens,
                    )
                except Exception as api_err:
                    if "Rate limit" in str(api_err) or "429" in str(api_err) or "rate_limit_exceeded" in str(api_err):
                        fallback_model = "llama-3.1-8b-instant"
                        logger.warning(f"Rate limit hit for {model}. Falling back to {fallback_model}!")
                        resp = client.chat.completions.create(
                            model=fallback_model,
                            messages=messages,
                            temperature=temperature,
                            max_tokens=max_tokens,
                        )
                    else:
                        raise api_err
            else:
                resp = client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
        else:
            # Route to OpenAI
            client = _get_openai_client()
            if not client:
                raise RuntimeError("OpenAI client not configured (missing API key)")
            
            resp = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                presence_penalty=presence_penalty,
                frequency_penalty=frequency_penalty,
            )
            
        content = resp.choices[0].message.content or ""
        text = content.strip()
        logger.info("LLM chat call succeeded", extra={"model": model})
        return text
    except Exception as e:
        logger.exception("LLM chat call failed")
        raise RuntimeError(f"LLM chat error: {e}")


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _is_retryable_error(e: Exception) -> bool:
    """Return True if this error means we should try the next model."""
    err = str(e).lower()
    return any(kw in err for kw in [
        "429", "rate_limit", "rate limit", "too many requests",
        "decommissioned", "model_not_found", "model not found",
        "503", "service unavailable", "overloaded",
    ])


def call_with_fallback_chain(
    messages: List[dict],
    temperature: float = 0.85,
    max_tokens: int = 4000,
    presence_penalty: float = 0.4,
    frequency_penalty: float = 0.35,
) -> str:
    """
    Call LLM with auto-fallback cascade:
      1. llama-3.3-70b-versatile  (Groq — primary)
      2. mistral-saba-24b         (Groq — gpt-oss-20b equivalent)
      3. llama-3.1-8b-instant     (Groq — fast small)
      4. gpt-4o                   (OpenAI — last resort)
    """
    tried: List[str] = []

    # ── Step 1-3: Groq models ──────────────────────────────────────────────
    for model in GROQ_FALLBACK_CHAIN:
        if model in tried:
            continue
        tried.append(model)
        try:
            client = _get_groq_client()
            resp = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            content = (resp.choices[0].message.content or "").strip()
            logger.info(f"[Fallback chain] ✅ Groq/{model}")
            return content
        except Exception as e:
            if _is_retryable_error(e):
                logger.warning(f"[Fallback chain] ⚠️  Groq/{model} failed ({type(e).__name__}: {str(e)[:120]}), trying next...")
                continue
            # Non-retryable (e.g. auth error) — bubble up immediately
            logger.exception(f"[Fallback chain] ❌ Groq/{model} non-retryable error")
            raise RuntimeError(f"Groq/{model} error: {e}")

    # ── Step 4: OpenAI gpt-4o (last resort) ──────────────────────────────
    logger.warning("[Fallback chain] All Groq models exhausted → OpenAI gpt-4o")
    try:
        client = _get_openai_client()
        if not client:
            raise RuntimeError("OpenAI client not configured (set OPENAI_API_KEY)")
        resp = client.chat.completions.create(
            model=OPENAI_FALLBACK_MODEL,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            presence_penalty=presence_penalty,
            frequency_penalty=frequency_penalty,
        )
        content = (resp.choices[0].message.content or "").strip()
        logger.info("[Fallback chain] ✅ OpenAI/gpt-4o")
        return content
    except Exception as e:
        logger.exception("[Fallback chain] ❌ OpenAI gpt-4o also failed")
        raise RuntimeError(f"All models in fallback chain failed. Last error: {e}")


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
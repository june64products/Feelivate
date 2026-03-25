import os
from typing import List, Optional

from dotenv import load_dotenv
from loguru import logger
from openai import OpenAI
# import google.generativeai as genai (Moved inside functions to prevent hang)


_groq_client: Optional[OpenAI] = None
_openai_client: Optional[OpenAI] = None
_gemini_configured = False


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


def call_llm(prompt: str, system: Optional[str] = None, temperature: float = 0.7, max_tokens: int = 4000, model_override: Optional[str] = None) -> str:
    # If model_override starts with 'gemini', force use of Gemini provider
    if model_override and ("gemini" in model_override.lower()):
        return _call_gemini(prompt, system, temperature, max_tokens, model_override)
        
    provider = _get_llm_provider()
    
    if provider == "groq":
        return _call_groq(prompt, system, temperature, max_tokens, model_override)
    elif provider == "gemini":
        return _call_gemini(prompt, system, temperature, max_tokens, model_override)
    else:
        return _call_openai(prompt, system, temperature, max_tokens, model_override)


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
        model = model_override or os.getenv("GROQ_MODEL", "llama-4-maverick")
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        
        # If using the specialized openai OSS reasoning model on Groq
        if "gpt-oss-120b" in model:
            resp = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=1,
                max_completion_tokens=max_tokens,
                top_p=1,
                reasoning_effort="medium"
            )
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


def _call_openai(prompt: str, system: Optional[str] = None, temperature: float = 0.7, max_tokens: int = 4000, model_override: Optional[str] = None) -> str:
    try:
        client = _get_openai_client()
        if not client:
            raise RuntimeError("OpenAI client not configured (missing API key)")
        model = model_override or os.getenv("OPENAI_LLM_MODEL", "gpt-4o-mini")
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
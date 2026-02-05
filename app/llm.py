import os
from typing import List, Optional

from dotenv import load_dotenv
from loguru import logger
from openai import OpenAI
import google.generativeai as genai


_client: Optional[OpenAI] = None
_gemini_configured = False


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


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        load_dotenv()
        if os.getenv("GROQ_API_KEY"):
            api_key = os.getenv("GROQ_API_KEY")
            base_url = "https://api.groq.com/openai/v1"
            _client = OpenAI(api_key=api_key, base_url=base_url)
        else:
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                logger.error("OPENAI_API_KEY is not set")
                raise RuntimeError("OPENAI_API_KEY is required")
            _client = OpenAI(api_key=api_key)
    return _client


def _configure_gemini():
    """Configure Google Gemini API."""
    global _gemini_configured
    if not _gemini_configured:
        load_dotenv()
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            logger.error("GEMINI_API_KEY is not set")
            raise RuntimeError("GEMINI_API_KEY is required")
        genai.configure(api_key=api_key)
        _gemini_configured = True


def call_llm(prompt: str, system: Optional[str] = None, temperature: float = 0.7, max_tokens: int = 2000) -> str:
    provider = _get_llm_provider()
    
    if provider == "groq":
        return _call_groq(prompt, system, temperature, max_tokens)
    elif provider == "gemini":
        return _call_gemini(prompt, system, temperature, max_tokens)
    else:
        return _call_openai(prompt, system, temperature, max_tokens)


def _call_gemini(prompt: str, system: Optional[str] = None, temperature: float = 0.7, max_tokens: int = 2000) -> str:
    try:
        import requests
        load_dotenv()
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY is required")
            
        model_name = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
        logger.info(f"Calling Gemini model: {model_name} via REST")
        
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        
        # Combine system and user prompt
        full_prompt = prompt
        if system:
            full_prompt = f"{system}\n\n{prompt}"
        
        headers = {"Content-Type": "application/json"}
        data = {
            "contents": [{
                "parts": [{"text": full_prompt}]
            }],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens
            }
        }
        
        logger.info("Sending request to Gemini API...")
        response = requests.post(url, headers=headers, json=data, timeout=60)
        
        if response.status_code != 200:
            logger.error(f"Gemini API failed: {response.status_code} - {response.text}")
            raise RuntimeError(f"Gemini API failed: {response.status_code} - {response.text}")
            
        res_json = response.json()
        
        if "candidates" in res_json and res_json["candidates"]:
            candidate = res_json["candidates"][0]
            if "content" in candidate and "parts" in candidate["content"]:
                text = candidate["content"]["parts"][0]["text"]
                logger.info(f"Gemini call succeeded, response length: {len(text)}")
                return text
                
        logger.error(f"Unexpected Gemini response format: {res_json}")
        raise RuntimeError(f"Unexpected Gemini response format: {res_json}")

    except Exception as e:
        logger.exception(f"Gemini call failed: {str(e)}")
        raise RuntimeError(f"Gemini error: {e}")


def _call_groq(prompt: str, system: Optional[str] = None, temperature: float = 0.7, max_tokens: int = 2000) -> str:
    try:
        client = _get_client()
        model = os.getenv("GROQ_MODEL", "llama-4-maverick")
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
        logger.info("Groq call succeeded", extra={"model": model, "tokens": resp.usage})
        return text
    except Exception as e:
        logger.exception("Groq call failed")
        raise RuntimeError(f"Groq error: {e}")


def _call_openai(prompt: str, system: Optional[str] = None, temperature: float = 0.7, max_tokens: int = 2000) -> str:
    try:
        client = _get_client()
        model = os.getenv("OPENAI_LLM_MODEL", "gpt-4o-mini")
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
        client = _get_client()
        model = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
        resp = client.embeddings.create(model=model, input=text)
        vec = resp.data[0].embedding
        logger.info("Embedding created", extra={"model": model, "length": len(vec)})
        return list(vec)
    except Exception as e:
        logger.exception("Embedding creation failed")
        raise RuntimeError(f"Embedding error: {e}")
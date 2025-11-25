"""
Minimal tool router (MCP-like) with logging and a simple per-minute rate limit.

Functions:
 - call_tool(tool_name, payload) -> Any

Rate limiting:
 - In-memory, per-tool, sliding window of 60 seconds.
 - Default limit 60 calls/minute; override with env TOOLS_RATE_LIMIT_PER_MINUTE.

Adding new tools:
 1) Implement a function in `app/tools.py` with a simple signature.
 2) Import it below and register in `TOOLS_REGISTRY` with a string key.
 3) Ensure the function returns JSON-serializable output.
 4) If LLM-based, rely on `app.llm.call_llm` and include basic parsing.
 5) Optional: add unit tests under `tests/` using stubs to avoid network.
"""

import os
import time
import uuid
from collections import defaultdict, deque
from typing import Any, Callable, Deque, Dict

from loguru import logger

from .tools import sentiment_tool, tts_tool


TOOLS_REGISTRY: Dict[str, Callable[..., Any]] = {
    "sentiment_tool": sentiment_tool,
    "tts_tool": tts_tool,
}


class RateLimiter:
    def __init__(self, max_per_minute: int = 60) -> None:
        self.max = max_per_minute
        self.calls: Dict[str, Deque[float]] = defaultdict(deque)

    def allow(self, key: str) -> bool:
        now = time.time()
        window_start = now - 60.0
        dq = self.calls[key]
        while dq and dq[0] < window_start:
            dq.popleft()
        if len(dq) < self.max:
            dq.append(now)
            return True
        return False


_rate_limit = RateLimiter(
    int(os.getenv("TOOLS_RATE_LIMIT_PER_MINUTE", "60"))
)


def call_tool(tool_name: str, payload: Dict[str, Any]) -> Any:
    """
    Call a registered tool by name with the given payload.

    Payload conventions:
      - For `sentiment_tool`: {"text": str}
      - For `tts_tool`: {"text": str}

    Returns tool-specific JSON-serializable output.
    """
    request_id = str(uuid.uuid4())
    log = logger.bind(request_id=request_id, tool=tool_name)

    if not _rate_limit.allow(tool_name):
        log.warning("rate_limit_exceeded")
        raise RuntimeError("Rate limit exceeded for tool")

    fn = TOOLS_REGISTRY.get(tool_name)
    if not fn:
        log.error("unknown_tool")
        raise ValueError(f"Unknown tool: {tool_name}")

    log.info("tool_call_start")
    try:
        # Expect a single text parameter for these tools
        text = str(payload.get("text", ""))
        result = fn(text)
        log.info("tool_call_success")
        return result
    except Exception:
        log.exception("tool_call_error")
        raise
import sys
import time
from typing import Any, Dict

from loguru import logger
from prometheus_client import Counter, Histogram


logger.remove()
logger.add(sys.stdout, level="INFO", serialize=True)


REQUESTS_TOTAL = Counter(
    "requests_total",
    "Total HTTP requests",
    labelnames=("route", "method", "status"),
)

AGENT_CALLS_TOTAL = Counter(
    "agent_calls_total",
    "Total agent/tool calls",
    labelnames=("agent",),
)

AGENT_LATENCY = Histogram(
    "agent_latency_seconds",
    "Latency of agent/tool calls",
    labelnames=("agent",),
)


def _redact(payload: Dict[str, Any]) -> Dict[str, Any]:
    redacted = {}
    for k, v in payload.items():
        if k in {"user_id", "text", "comments"}:
            redacted[k] = "[redacted]"
        else:
            redacted[k] = v
    return redacted


def trace_request(req_id: str, event: str, payload: Dict[str, Any]) -> None:
    logger.bind(req_id=req_id).info(event, extra=_redact(payload))


class AgentTimer:
    def __init__(self, agent: str):
        self.agent = agent
        self.start = time.perf_counter()

    def observe(self):
        dur = time.perf_counter() - self.start
        AGENT_LATENCY.labels(agent=self.agent).observe(dur)
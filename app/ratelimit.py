"""
In-process rate limiting for authentication and OTP endpoints.

Why this exists
---------------
Unlimited attempts on /login, /signup and the email OTP endpoints allow
credential stuffing, account enumeration and OTP brute force. GDPR Art 32
requires security measures appropriate to the risk, and the data behind these
endpoints (emotion logs, voice journals) sits in the highest risk band.

Scope and limits
----------------
State is per process. The API currently runs as a single Northflank instance
(see northflank.json), so this is effective today. If instances are ever scaled
above 1, move this to Redis — REDIS_URL is already configured — otherwise the
effective limit multiplies by the instance count.
"""

import os
import threading
import time
from collections import defaultdict, deque
from typing import Deque, Dict, Tuple

from loguru import logger


class SlidingWindowLimiter:
    """Fixed quota over a sliding time window, keyed by an arbitrary string."""

    def __init__(self, max_attempts: int, window_seconds: int):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._hits: Dict[str, Deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str) -> Tuple[bool, int]:
        """Record an attempt for `key`.

        Returns (allowed, retry_after_seconds). retry_after is 0 when allowed.
        """
        now = time.monotonic()
        cutoff = now - self.window_seconds
        with self._lock:
            hits = self._hits[key]
            while hits and hits[0] < cutoff:
                hits.popleft()

            if len(hits) >= self.max_attempts:
                retry_after = int(hits[0] + self.window_seconds - now) + 1
                return False, max(retry_after, 1)

            hits.append(now)
            return True, 0

    def reset(self, key: str) -> None:
        """Clear the counter for a key — call after a successful attempt."""
        with self._lock:
            self._hits.pop(key, None)

    def prune(self) -> int:
        """Drop empty/expired buckets so the dict can't grow without bound."""
        cutoff = time.monotonic() - self.window_seconds
        removed = 0
        with self._lock:
            for key in list(self._hits.keys()):
                hits = self._hits[key]
                while hits and hits[0] < cutoff:
                    hits.popleft()
                if not hits:
                    del self._hits[key]
                    removed += 1
        return removed


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


# Buckets. Deliberately generous enough not to hurt a real user who mistypes a
# password a few times, tight enough to make automated guessing useless.
LIMITERS: Dict[str, SlidingWindowLimiter] = {
    # 10 login attempts per identity per 15 minutes
    "login": SlidingWindowLimiter(_int_env("RL_LOGIN_MAX", 10), _int_env("RL_LOGIN_WINDOW", 900)),
    # 5 new accounts per IP per hour
    "signup": SlidingWindowLimiter(_int_env("RL_SIGNUP_MAX", 5), _int_env("RL_SIGNUP_WINDOW", 3600)),
    # 5 OTP sends per identity per hour — each one costs an email
    "otp_send": SlidingWindowLimiter(_int_env("RL_OTP_SEND_MAX", 5), _int_env("RL_OTP_SEND_WINDOW", 3600)),
    # 6 OTP verification attempts per identity per hour (6-digit code)
    "otp_verify": SlidingWindowLimiter(_int_env("RL_OTP_VERIFY_MAX", 6), _int_env("RL_OTP_VERIFY_WINDOW", 3600)),
    # 3 contact-form submissions per IP per hour
    "contact": SlidingWindowLimiter(_int_env("RL_CONTACT_MAX", 3), _int_env("RL_CONTACT_WINDOW", 3600)),
    # 3 account deletions per identity per hour (guards the confirm endpoint)
    "account_delete": SlidingWindowLimiter(_int_env("RL_DELETE_MAX", 3), _int_env("RL_DELETE_WINDOW", 3600)),
    # 5 full data exports per identity per day — each one is expensive
    "account_export": SlidingWindowLimiter(_int_env("RL_EXPORT_MAX", 5), _int_env("RL_EXPORT_WINDOW", 86400)),
}


def prune_all() -> None:
    """Housekeeping entry point — wired to the APScheduler hourly job."""
    total = sum(limiter.prune() for limiter in LIMITERS.values())
    if total:
        logger.debug(f"[RateLimit] pruned {total} idle buckets")

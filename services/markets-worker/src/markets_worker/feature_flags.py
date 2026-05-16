"""
Feature flag client for the markets worker.

Resolves flags via the platform.resolve_flags() Postgres function.
Results are cached in-process for `ttl_seconds` (default 60s) to avoid
hammering the DB on every request.

Usage:
    from markets_worker.feature_flags import flags

    if flags.enabled("markets.signals.fo_enabled", tenant_id=tenant_id):
        ...

    # Check multiple at once
    resolved = flags.resolve(
        ["markets.signals.enabled", "markets.backtesting.enabled"],
        tenant_id=tenant_id,
    )
"""

from __future__ import annotations

import time
from threading import Lock
from typing import Any

import structlog

from markets_worker.db import get_supabase

logger = structlog.get_logger()

_CACHE_TTL = 60  # seconds


class FeatureFlagClient:
    """Thread-safe feature flag client with short-lived in-process cache."""

    def __init__(self, ttl_seconds: int = _CACHE_TTL) -> None:
        self._ttl     = ttl_seconds
        self._cache:  dict[str, tuple[bool, float]] = {}   # key -> (value, expires_at)
        self._lock    = Lock()

    # ── Public API ────────────────────────────────────────────────────────────

    def enabled(
        self,
        key: str,
        *,
        tenant_id:    str | None = None,
        user_id:      str | None = None,
        franchise_id: str | None = None,
    ) -> bool:
        """Return True if flag `key` is enabled for the given context."""
        result = self.resolve(
            [key],
            tenant_id=tenant_id,
            user_id=user_id,
            franchise_id=franchise_id,
        )
        return result.get(key, False)

    def resolve(
        self,
        keys: list[str],
        *,
        tenant_id:    str | None = None,
        user_id:      str | None = None,
        franchise_id: str | None = None,
    ) -> dict[str, bool]:
        """Resolve a list of flag keys for the given context. Cached per key."""
        now     = time.monotonic()
        result  = {}
        missing = []

        cache_scope = f"{tenant_id}:{user_id}:{franchise_id}"

        with self._lock:
            for key in keys:
                cache_key = f"{key}@{cache_scope}"
                if cache_key in self._cache:
                    val, expires = self._cache[cache_key]
                    if now < expires:
                        result[key] = val
                        continue
                missing.append(key)

        if missing:
            fetched = self._fetch(missing, tenant_id=tenant_id,
                                  user_id=user_id, franchise_id=franchise_id)
            with self._lock:
                for key in missing:
                    val = fetched.get(key, False)
                    cache_key = f"{key}@{cache_scope}"
                    self._cache[cache_key] = (val, now + self._ttl)
                    result[key] = val

        return result

    def invalidate(self, key: str | None = None) -> None:
        """Clear cache for a specific key (or all keys if None)."""
        with self._lock:
            if key is None:
                self._cache.clear()
            else:
                self._cache = {k: v for k, v in self._cache.items()
                               if not k.startswith(f"{key}@")}

    # ── Internal ──────────────────────────────────────────────────────────────

    def _fetch(
        self,
        keys:          list[str],
        tenant_id:     str | None,
        user_id:       str | None,
        franchise_id:  str | None,
    ) -> dict[str, bool]:
        try:
            db = get_supabase()
            resp = db.schema("platform").rpc("resolve_flags", {
                "p_keys":         keys,
                "p_tenant_id":    tenant_id,
                "p_user_id":      user_id,
                "p_franchise_id": franchise_id,
            }).execute()
            raw: Any = resp.data
            if isinstance(raw, dict):
                return {k: bool(v) for k, v in raw.items()}
            # rpc may return list[dict] in some supabase-py versions
            if isinstance(raw, list) and raw:
                return {k: bool(v) for k, v in (raw[0] if isinstance(raw[0], dict) else {}).items()}
            return {k: False for k in keys}
        except Exception as exc:
            logger.warning("feature_flags.fetch_failed", keys=keys, error=str(exc))
            return {k: False for k in keys}


# Singleton used throughout the worker
flags = FeatureFlagClient()

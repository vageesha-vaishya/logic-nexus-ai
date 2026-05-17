"""Supabase admin client + DuckDB connection factory."""

from functools import lru_cache
from typing import Any

import duckdb
from supabase import Client, create_client

from markets_worker.config import get_settings


def _patch_maybe_single() -> None:
    """
    Fix postgrest-py versions where maybe_single().execute() returns None
    (instead of a response with data=None) when no row is found.
    Patching once here fixes all 40+ call sites across the codebase.
    """
    try:
        from postgrest._sync.request_builder import SyncMaybeSingleRequestBuilder

        _orig = SyncMaybeSingleRequestBuilder.execute

        def _safe_execute(self, *args, **kwargs):
            result = _orig(self, *args, **kwargs)
            if result is None:
                class _Empty:
                    data = None
                return _Empty()
            return result

        SyncMaybeSingleRequestBuilder.execute = _safe_execute  # type: ignore[method-assign]
    except Exception:
        pass  # if postgrest API changes, fail silently — don't break startup


_patch_maybe_single()


@lru_cache
def get_supabase() -> Client:
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_service_role_key)


def get_duckdb(read_only: bool = False) -> duckdb.DuckDBPyConnection:
    """Return an in-memory DuckDB connection. Callers are responsible for closing."""
    return duckdb.connect(database=":memory:", read_only=read_only)


# ── Thin typed helpers ────────────────────────────────────────────────────────

async def fetch_one(table: str, *, schema: str = "public", **filters: Any) -> dict | None:
    db = get_supabase()
    q = db.schema(schema).from_(table).select("*")
    for col, val in filters.items():
        q = q.eq(col, val)
    result = q.maybe_single().execute()
    return result.data if result is not None else None


async def fetch_many(
    table: str,
    *,
    schema: str = "public",
    select: str = "*",
    limit: int = 200,
    order_col: str | None = None,
    **filters: Any,
) -> list[dict]:
    db = get_supabase()
    q = db.schema(schema).from_(table).select(select).limit(limit)
    for col, val in filters.items():
        q = q.eq(col, val)
    if order_col:
        q = q.order(order_col, desc=True)
    result = q.execute()
    return result.data or []

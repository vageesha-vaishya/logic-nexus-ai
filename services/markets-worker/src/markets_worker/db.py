"""Supabase admin client + DuckDB connection factory."""

from functools import lru_cache
from typing import Any

import duckdb
from supabase import Client, create_client

from markets_worker.config import get_settings

_ORIG_CLIENT_SCHEMA = getattr(Client, "schema", None)

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


def _extract_error_text(exc: Exception) -> str:
    try:
        return str(exc)
    except Exception:
        return "unknown_error"


def _looks_like_unknown_schema(exc: Exception) -> bool:
    msg = _extract_error_text(exc).lower()
    return (
        "schema must be one of the following" in msg
        or "unknown schema" in msg
        or "schema cache" in msg
        or "schema" in msg and "not found" in msg
    )


@lru_cache
def resolve_markets_schema_name() -> str:
    s = get_settings()
    requested = (s.markets_schema or "").strip()
    if requested and requested.lower() != "auto":
        return requested

    client = create_client(s.supabase_url, s.supabase_service_role_key)
    if not _ORIG_CLIENT_SCHEMA:
        return "markets"

    for candidate in ("markets", "module_markets"):
        try:
            _ORIG_CLIENT_SCHEMA(client, candidate).from_("broker_connections").select("id").limit(1).execute()
            return candidate
        except Exception as exc:
            if _looks_like_unknown_schema(exc):
                continue
    return "markets"


def _patch_markets_schema_alias() -> None:
    try:
        if not _ORIG_CLIENT_SCHEMA:
            return

        def _schema(self: Client, schema: str):
            if schema == "markets":
                return _ORIG_CLIENT_SCHEMA(self, resolve_markets_schema_name())
            return _ORIG_CLIENT_SCHEMA(self, schema)

        Client.schema = _schema  # type: ignore[method-assign]
    except Exception:
        pass


_patch_markets_schema_alias()


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

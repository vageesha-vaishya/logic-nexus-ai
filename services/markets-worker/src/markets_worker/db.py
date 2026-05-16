"""Supabase admin client + DuckDB connection factory."""

from functools import lru_cache
from typing import Any

import duckdb
from supabase import Client, create_client

from markets_worker.config import get_settings


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
    return result.data


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

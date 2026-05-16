from fastapi import APIRouter
from markets_worker.config import get_settings
from markets_worker.db import get_supabase

router = APIRouter()


@router.get("/health")
async def health():
    return {"status": "ok", "service": get_settings().service_name}


@router.get("/ready")
async def ready():
    """Readiness probe: verify Supabase connectivity."""
    try:
        get_supabase().schema("markets").from_("instruments").select("id").limit(1).execute()
        db_ok = True
    except Exception as exc:
        db_ok = False
    return {
        "status": "ready" if db_ok else "degraded",
        "checks": {"supabase": db_ok},
    }

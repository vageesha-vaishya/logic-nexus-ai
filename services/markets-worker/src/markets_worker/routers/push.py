"""Push notification registration + test dispatch (Phase 1 Addendum T24c)."""
from __future__ import annotations

from typing import Any, Literal

import structlog
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field

from markets_worker.auth import Auth
from markets_worker.db import get_supabase
from markets_worker.push.fcm import fan_out_push, is_fcm_configured
from markets_worker.routers.retail import _require_user_id

logger = structlog.get_logger()
router = APIRouter(prefix="/v1/retail/push", tags=["retail-push"])


class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    platform:     Literal["android", "ios", "web"]
    token:        str = Field(min_length=10, max_length=4096)
    device_name:  str | None = None


class TestRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = "Logic Nexus"
    body:  str = "Test push from markets-worker."


@router.post("/register", status_code=status.HTTP_200_OK)
def register(body: RegisterRequest, auth: Auth) -> dict[str, Any]:
    """Upsert a device token. Idempotent on (user_id, token).

    Updates `last_seen_at` on conflict so we can prune cold tokens later.
    """
    user_id = _require_user_id(auth)
    sb = get_supabase()
    payload = {
        "user_id":      user_id,
        "platform":     body.platform,
        "token":        body.token,
        "device_name":  body.device_name,
        "is_active":    True,
        "last_seen_at": "now()",
    }
    res = (
        sb.schema("markets")
        .from_("push_tokens")
        .upsert(payload, on_conflict="user_id,token")
        .select("id, last_seen_at")
        .single()
        .execute()
    )
    return {"ok": True, "row": res.data}


@router.post("/test")
def test(body: TestRequest, auth: Auth) -> dict[str, Any]:
    """Fire a test push to all active tokens for the caller.

    Returns delivered-count + whether FCM is configured at all. Useful for
    smoke-testing the credentials wiring without faking an alert event.
    """
    user_id = _require_user_id(auth)
    if not is_fcm_configured():
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="FCM not configured on this worker (FCM_SERVICE_ACCOUNT_JSON missing).",
        )
    delivered = fan_out_push(user_id, body.title, body.body, data={"source": "test"})
    return {"delivered": delivered}

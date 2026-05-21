"""Auth middleware: validates service-account keys and Supabase user JWTs."""

import hashlib
from datetime import datetime, timezone
from typing import Annotated

import structlog
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from markets_worker.config import get_settings
from markets_worker.db import get_supabase

logger = structlog.get_logger()
bearer = HTTPBearer(auto_error=False)


def _sha256(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def _verify_supabase_jwt(token: str) -> dict:
    """Verify a Supabase user JWT by calling the Auth API (works regardless of signing key)."""
    db = get_supabase()
    try:
        resp = db.auth.get_user(token)
        if not resp or not resp.user:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid JWT: user not found")
        user = resp.user
        return {"sub": user.id, "email": getattr(user, "email", None), "role": "authenticated"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=f"Invalid JWT: {e}") from e


async def _lookup_service_account(key_hash: str) -> dict | None:
    db = get_supabase()
    try:
        resp = (
            db.schema("platform")
            .from_("service_accounts")
            .select("id, tenant_id, franchise_id, name, scope, expires_at")
            .eq("key_hash", key_hash)
            .eq("is_active", True)
            .limit(1)
            .execute()
        )
        rows = resp.data if resp and resp.data else []
        if not rows:
            return None
        sa = rows[0]
    except Exception:
        return None
    if sa.get("expires_at"):
        if datetime.fromisoformat(sa["expires_at"]) < datetime.now(timezone.utc):
            return None
    return sa


class AuthContext:
    """Resolved identity — either a service account or an authenticated user."""

    def __init__(
        self,
        *,
        user_id: str | None = None,
        tenant_id: str | None = None,
        franchise_id: str | None = None,
        service_account_id: str | None = None,
        service_account_name: str | None = None,
        scope: list[str] | None = None,
        is_service_account: bool = False,
    ):
        self.user_id = user_id
        self.tenant_id = tenant_id
        self.franchise_id = franchise_id
        self.service_account_id = service_account_id
        self.service_account_name = service_account_name
        self.scope = scope or []
        self.is_service_account = is_service_account

    def require_scope(self, required: str) -> None:
        if self.scope and required not in self.scope:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail=f"Scope '{required}' required",
            )


async def get_auth(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> AuthContext:
    if not credentials:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Missing Authorization header")

    token = credentials.credentials

    # 1. Try service account: sha256(token) lookup
    key_hash = _sha256(token)
    sa = await _lookup_service_account(key_hash)
    if sa:
        logger.info("auth.service_account", name=sa["name"])
        return AuthContext(
            tenant_id=sa.get("tenant_id"),
            franchise_id=sa.get("franchise_id"),
            service_account_id=sa["id"],
            service_account_name=sa["name"],
            scope=sa.get("scope") or [],
            is_service_account=True,
        )

    # 2. Service-role passthrough (from admin scripts / edge functions).
    # _verify_supabase_jwt below calls auth.get_user which dies on
    # service-role tokens (no user attached). Short-circuit here when the
    # Bearer literally equals SUPABASE_SERVICE_ROLE_KEY — equivalent in
    # power to a service-account, since anyone with this key could call
    # Supabase REST directly with full admin powers anyway.
    import hmac as _hmac
    s = get_settings()
    if s.supabase_service_role_key and _hmac.compare_digest(token, s.supabase_service_role_key):
        logger.info("auth.service_role_key")
        return AuthContext(
            tenant_id=(request.headers.get("x-tenant-id") or "").strip() or None,
            franchise_id=(request.headers.get("x-franchise-id") or "").strip() or None,
            is_service_account=True,
        )

    # 3. User JWT (Edge-Function-issued or direct user calls)
    claims = _verify_supabase_jwt(token)
    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="JWT missing sub claim")

    logger.info("auth.jwt_user", user_id=user_id)

    # Pull tenant from x-tenant-id header (mirrors Edge Function convention)
    tenant_id = (request.headers.get("x-tenant-id") or "").strip() or None
    franchise_id = (request.headers.get("x-franchise-id") or "").strip() or None

    return AuthContext(
        user_id=user_id,
        tenant_id=tenant_id,
        franchise_id=franchise_id,
        is_service_account=False,
    )


# Convenient FastAPI dependency alias
Auth = Annotated[AuthContext, Depends(get_auth)]

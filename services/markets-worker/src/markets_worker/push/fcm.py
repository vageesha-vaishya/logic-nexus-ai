"""FCM HTTP v1 dispatch (Phase 1 Addendum T24c).

Uses the modern HTTP v1 endpoint (legacy server-key API is deprecated):

    POST https://fcm.googleapis.com/v1/projects/{PROJECT_ID}/messages:send

Auth is a Google service-account JWT exchanged for an OAuth access token
via `google.oauth2.service_account.Credentials`. The token caches itself
(google-auth handles refresh) so per-message dispatch is one HTTP call.

The service account JSON lives in an env var so secrets don't touch git:

    FCM_SERVICE_ACCOUNT_JSON   (full JSON contents, single line)
    FCM_PROJECT_ID             (defaults to the JSON's project_id)

If either is missing the helpers no-op — useful in dev where FCM isn't
wired and tests that exercise notify_user_sync shouldn't fail on it.

Bulk fan-out (`fan_out_push`) looks up every active push_tokens row for
a user, sends one message per token, and prunes tokens that FCM rejects
as `UNREGISTERED` / `INVALID_ARGUMENT` so a stale Android install
doesn't keep getting noisy errors logged.
"""
from __future__ import annotations

import json
import os
from typing import Any

import httpx
import structlog
from google.auth.transport.requests import Request
from google.oauth2 import service_account

from markets_worker.db import get_supabase

logger = structlog.get_logger()

_SCOPES = ["https://www.googleapis.com/auth/firebase.messaging"]
_FCM_URL_TEMPLATE = "https://fcm.googleapis.com/v1/projects/{project_id}/messages:send"
# Send timeout — FCM is normally <1s but we cap so a hung worker thread
# doesn't tie up an RQ slot indefinitely.
_HTTP_TIMEOUT = 8.0


def _load_service_account() -> service_account.Credentials | None:
    """Parse FCM_SERVICE_ACCOUNT_JSON into google-auth credentials.

    Returns None when the env var isn't set or doesn't parse. Logs at
    WARNING for the missing-var case so it shows up in the worker journal
    once at startup; later failures are silent (caller treats None as
    "FCM disabled").
    """
    raw = os.environ.get("FCM_SERVICE_ACCOUNT_JSON")
    if not raw:
        return None
    try:
        info = json.loads(raw)
        return service_account.Credentials.from_service_account_info(
            info, scopes=_SCOPES
        )
    except (json.JSONDecodeError, ValueError) as exc:
        logger.warning("fcm.bad_service_account_json", error=str(exc))
        return None


_credentials: service_account.Credentials | None = _load_service_account()


def is_fcm_configured() -> bool:
    """Cheap check callers can use to decide whether to bother fetching tokens."""
    return _credentials is not None


def _project_id() -> str | None:
    if not _credentials:
        return None
    explicit = os.environ.get("FCM_PROJECT_ID")
    if explicit:
        return explicit
    # google-auth exposes the project on the credentials object.
    pid = getattr(_credentials, "project_id", None)
    return pid


def _access_token() -> str | None:
    """Get a fresh access token. google-auth caches + refreshes internally."""
    if not _credentials:
        return None
    try:
        if not _credentials.valid:
            _credentials.refresh(Request())
        return _credentials.token
    except Exception as exc:  # noqa: BLE001 — soft-fail; caller decides
        logger.warning("fcm.token_refresh_failed", error=str(exc))
        return None


def build_message(
    token: str,
    title: str,
    body: str,
    data: dict[str, Any] | None = None,
    link_url: str | None = None,
) -> dict[str, Any]:
    """Build the FCM HTTP v1 message envelope.

    Pure function for unit testing. `data` keys must be strings (FCM spec);
    we coerce non-strings to str to avoid 400s on dispatch.
    """
    payload_data: dict[str, str] = {}
    for k, v in (data or {}).items():
        if v is None:
            continue
        payload_data[str(k)] = str(v)
    if link_url:
        payload_data["link_url"] = link_url

    return {
        "message": {
            "token": token,
            "notification": {
                "title": title,
                "body":  body,
            },
            "data": payload_data,
            "android": {
                "priority": "high",
                # Default to a generic channel so Android renders the notif
                # without us having to declare a custom channel in the shell.
                # Capacitor's plugin creates a "default" channel at runtime.
                "notification": {
                    "channel_id": "default",
                },
            },
        }
    }


def _send_one(
    client: httpx.Client,
    project_id: str,
    access_token: str,
    token: str,
    title: str,
    body: str,
    data: dict[str, Any] | None,
    link_url: str | None,
) -> tuple[bool, str | None]:
    """Send one message. Returns (success, fcm_error_status).

    fcm_error_status is the FCM error enum (UNREGISTERED, INVALID_ARGUMENT,
    etc.) when the call fails — caller uses it to prune dead tokens.
    """
    msg = build_message(token, title, body, data, link_url)
    try:
        resp = client.post(
            _FCM_URL_TEMPLATE.format(project_id=project_id),
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type":  "application/json; charset=UTF-8",
            },
            json=msg,
            timeout=_HTTP_TIMEOUT,
        )
        if resp.status_code == 200:
            return True, None
        # 4xx with details — extract the FCM error code if present.
        try:
            body_json = resp.json()
        except Exception:  # noqa: BLE001
            body_json = {}
        error_status = (
            body_json.get("error", {}).get("details", [{}])[0].get("errorCode")
            or body_json.get("error", {}).get("status")
            or f"HTTP_{resp.status_code}"
        )
        return False, error_status
    except httpx.HTTPError as exc:
        logger.warning("fcm.send_failed", token=token[:12], error=str(exc))
        return False, "TRANSPORT_ERROR"


def fan_out_push(
    user_id: str,
    title: str,
    body: str,
    data: dict[str, Any] | None = None,
    link_url: str | None = None,
) -> int:
    """Dispatch a push to every active token for the user. Returns count delivered.

    Soft-fail: any per-token error is logged at WARNING but never raised —
    notify_user_sync calls this AFTER its DB insert and we don't want a
    transient FCM blip to look like a notification storage failure.

    Tokens that FCM marks UNREGISTERED (re-install / uninstall) are flipped
    to is_active=false so the next fan-out skips them.
    """
    if not is_fcm_configured() or not user_id:
        return 0

    project_id = _project_id()
    token_str  = _access_token()
    if not project_id or not token_str:
        return 0

    sb = get_supabase()
    try:
        res = (
            sb.schema("markets")
            .from_("push_tokens")
            .select("id, token")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .execute()
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("fcm.token_query_failed", user_id=user_id, error=str(exc))
        return 0

    rows = res.data or []
    if not rows:
        return 0

    delivered = 0
    with httpx.Client() as client:
        for row in rows:
            tok = row.get("token")
            if not tok:
                continue
            ok, err = _send_one(
                client, project_id, token_str, tok, title, body, data, link_url
            )
            if ok:
                delivered += 1
            elif err in ("UNREGISTERED", "INVALID_ARGUMENT", "NOT_FOUND"):
                # Stale / wrong-project token — prune so we stop sending.
                try:
                    (
                        sb.schema("markets")
                        .from_("push_tokens")
                        .update({"is_active": False})
                        .eq("id", row.get("id"))
                        .execute()
                    )
                except Exception as prune_exc:  # noqa: BLE001
                    logger.warning(
                        "fcm.prune_failed",
                        token_id=row.get("id"),
                        error=str(prune_exc),
                    )
            else:
                logger.warning(
                    "fcm.send_error",
                    token_id=row.get("id"),
                    fcm_status=err,
                )

    return delivered

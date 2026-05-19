"""Pure-function tests for the FCM dispatcher (Addendum T24c)."""
from __future__ import annotations

import os
from unittest.mock import patch

from markets_worker.push import fcm


def test_build_message_includes_token_title_body_and_data():
    msg = fcm.build_message(
        token="abc123",
        title="Time to rebalance",
        body="Tier 1 is 80% (target 55%).",
        data={"rec_id": "rec-xyz", "category": "rebalance"},
    )
    assert msg["message"]["token"] == "abc123"
    assert msg["message"]["notification"]["title"] == "Time to rebalance"
    assert msg["message"]["notification"]["body"]  == "Tier 1 is 80% (target 55%)."
    assert msg["message"]["data"] == {"rec_id": "rec-xyz", "category": "rebalance"}


def test_build_message_coerces_non_string_data_values_to_str():
    """FCM data payload MUST be strings — coerce so a caller passing ints
    doesn't get a runtime 400."""
    msg = fcm.build_message(
        token="t",
        title="x", body="y",
        data={"rec_id": 42, "drift_pct": 12.5, "drop_me": None},
    )
    d = msg["message"]["data"]
    assert d["rec_id"]    == "42"
    assert d["drift_pct"] == "12.5"
    # None values pruned so we don't send "null" strings.
    assert "drop_me" not in d


def test_build_message_appends_link_url_into_data():
    msg = fcm.build_message(
        token="t",
        title="x", body="y",
        data={"k": "v"},
        link_url="/dashboard/markets/retail/home",
    )
    assert msg["message"]["data"]["link_url"] == "/dashboard/markets/retail/home"
    assert msg["message"]["data"]["k"]        == "v"


def test_build_message_sets_android_high_priority_and_default_channel():
    """Phase 1 channel: 'default'. Capacitor's plugin auto-creates it at
    runtime so we don't have to declare a custom channel in the shell."""
    msg = fcm.build_message(token="t", title="x", body="y")
    android = msg["message"]["android"]
    assert android["priority"] == "high"
    assert android["notification"]["channel_id"] == "default"


def test_is_fcm_configured_false_when_no_env_credential():
    # When the env var isn't set the module-level _credentials stays None;
    # we patch it to None here so the test is hermetic regardless of the
    # developer's local env.
    with patch.object(fcm, "_credentials", None):
        assert fcm.is_fcm_configured() is False


def test_load_service_account_returns_none_when_env_missing(monkeypatch):
    monkeypatch.delenv("FCM_SERVICE_ACCOUNT_JSON", raising=False)
    assert fcm._load_service_account() is None


def test_load_service_account_returns_none_on_bad_json(monkeypatch):
    monkeypatch.setenv("FCM_SERVICE_ACCOUNT_JSON", "{not-json")
    assert fcm._load_service_account() is None


def test_fan_out_push_noops_when_unconfigured():
    """Calling fan_out_push when FCM isn't configured must return 0 and
    never raise — that's what makes notify_user_sync safe to call from
    every notification site, including dev environments."""
    with patch.object(fcm, "_credentials", None):
        assert fcm.fan_out_push("user-1", "title", "body") == 0


# Defence-in-depth: make sure we don't accidentally leak the env var into
# CI / coverage runs.
def test_default_environment_does_not_configure_fcm():
    if "FCM_SERVICE_ACCOUNT_JSON" in os.environ:
        # Real env var set — skip rather than assert against the dev's setup.
        return
    fresh = fcm._load_service_account()
    assert fresh is None

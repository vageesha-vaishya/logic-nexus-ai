"""
Background alert checker.

Polls markets.price_alerts WHERE status='active' every 30 seconds.
Checks each alert against the LTP cache (from routers/ltp.py).
When triggered: updates status to 'triggered', records triggered_price + triggered_at.
"""
import asyncio
import time
from datetime import datetime, timezone

import structlog

from markets_worker.db import get_supabase
from markets_worker.config import get_settings

logger = structlog.get_logger()
_POLL_INTERVAL = 30  # seconds


async def _send_push_notification(
    supabase_url: str,
    service_key: str,
    user_id: str,
    title: str,
    body: str,
    data: dict | None = None,
) -> None:
    """Fire-and-forget push notification via Supabase Edge Function."""
    import httpx
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(
                f"{supabase_url}/functions/v1/markets-push-notify",
                headers={
                    "Authorization": f"Bearer {service_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "user_id": user_id,
                    "title":   title,
                    "body":    body,
                    "data":    data or {},
                },
            )
    except Exception:
        pass  # Fire-and-forget — never let notification failure block alert processing


async def check_alerts_loop() -> None:
    """Infinite loop — runs as asyncio background task from app startup."""
    while True:
        try:
            await _check_once()
        except Exception as exc:
            logger.warning("alert_checker.error", exc=str(exc))
        await asyncio.sleep(_POLL_INTERVAL)


async def _check_once() -> None:
    from markets_worker.routers.ltp import _ltp_cache, _CACHE_TTL  # lazy import to avoid circular

    loop = asyncio.get_event_loop()
    db = await loop.run_in_executor(None, get_supabase)

    # Fetch all active alerts
    rows = await loop.run_in_executor(
        None,
        lambda: db.schema("markets").from_("price_alerts")
            .select("id, symbol, exchange, condition, trigger_price, user_id")
            .eq("status", "active")
            .execute()
            .data
    )
    if not rows:
        await _check_risk_controls(db, loop)
        await _check_rebalancing(db, loop)
        await _execute_due_sips(db, loop)
        return

    now = time.monotonic()
    to_trigger: list[dict] = []

    for alert in rows:
        sym = alert["symbol"].upper()
        exch = alert["exchange"].upper()
        key = f"{sym}:{exch}"
        entry = _ltp_cache.get(key)
        if not entry:
            continue
        ts, quote = entry
        if now - ts > _CACHE_TTL * 4:  # stale cache — skip
            continue
        ltp = quote.get("ltp")
        if ltp is None:
            continue

        condition = alert["condition"]
        trigger_price = float(alert["trigger_price"])
        triggered = (condition == "above" and ltp >= trigger_price) or \
                    (condition == "below" and ltp <= trigger_price)

        if triggered:
            to_trigger.append({"id": alert["id"], "ltp": ltp})

    if not to_trigger:
        await _check_risk_controls(db, loop)
        await _check_rebalancing(db, loop)
        await _execute_due_sips(db, loop)
        return

    settings = get_settings()
    now_iso = datetime.now(timezone.utc).isoformat()

    # Build a quick lookup of alert metadata for push notifications
    alert_map: dict[str, dict] = {str(a["id"]): a for a in rows}

    for t in to_trigger:
        await loop.run_in_executor(
            None,
            lambda t=t: db.schema("markets").from_("price_alerts")
                .update({
                    "status": "triggered",
                    "triggered_at": now_iso,
                    "triggered_price": t["ltp"],
                })
                .eq("id", t["id"])
                .eq("status", "active")  # guard against double-trigger race
                .execute()
        )
        logger.info("alert.triggered", alert_id=t["id"], ltp=t["ltp"])

        # Send push notification (fire-and-forget)
        alert = alert_map.get(str(t["id"]))
        if alert and alert.get("user_id"):
            trigger_price = float(alert.get("trigger_price", t["ltp"]))
            condition     = alert.get("condition", "above")
            sym           = alert.get("symbol", "")
            direction_str = "risen above" if condition == "above" else "fallen below"
            asyncio.ensure_future(
                _send_push_notification(
                    supabase_url=settings.supabase_url,
                    service_key=settings.supabase_service_role_key,
                    user_id=str(alert["user_id"]),
                    title=f"Price Alert: {sym}",
                    body=f"{sym} has {direction_str} ₹{trigger_price:,.2f}",
                    data={"alert_id": str(t["id"]), "symbol": sym},
                )
            )

    await _check_risk_controls(db, loop)
    await _check_rebalancing(db, loop)
    await _execute_due_sips(db, loop)


async def _check_risk_controls(db, loop) -> None:
    """Auto-activate kill switch if daily loss exceeds the limit."""
    from datetime import date
    today = date.today().isoformat()

    # Get all active risk controls with a daily loss limit
    controls = await loop.run_in_executor(
        None,
        lambda: db.schema("markets").from_("risk_controls")
            .select("id, user_id, portfolio_id, daily_loss_limit_inr, kill_switch_active")
            .not_.is_("daily_loss_limit_inr", "null")
            .eq("kill_switch_active", False)
            .execute()
            .data
    )

    for ctrl in (controls or []):
        if not ctrl.get("portfolio_id"):
            continue
        # Get today's P&L from transactions (sells - buys today)
        # Simplified: check holdings change — if realised loss today > limit, activate kill switch
        # This is a best-effort check; real implementation needs today's closed P&L
        try:
            txns = await loop.run_in_executor(
                None,
                lambda c=ctrl: db.schema("markets").from_("transactions")
                    .select("txn_type, qty, price, charges")
                    .eq("portfolio_id", c["portfolio_id"])
                    .eq("txn_date", today)
                    .execute()
                    .data
            )
            if not txns:
                continue
            day_pnl = 0.0
            for t in txns:
                val = float(t["qty"]) * float(t["price"]) - float(t.get("charges") or 0)
                if t["txn_type"] in ("sell", "redemption"):
                    day_pnl += val
                elif t["txn_type"] in ("buy", "sip"):
                    day_pnl -= val

            limit = float(ctrl["daily_loss_limit_inr"])
            if day_pnl < -limit:
                await loop.run_in_executor(
                    None,
                    lambda c=ctrl, pnl=day_pnl: db.schema("markets").from_("risk_controls")
                        .update({
                            "kill_switch_active": True,
                            "kill_switch_reason": f"Auto: daily loss ₹{abs(pnl):.0f} exceeded limit ₹{ctrl['daily_loss_limit_inr']:.0f}",
                        })
                        .eq("id", c["id"])
                        .execute()
                )
                logger.warning("risk.kill_switch.auto_activated", portfolio_id=ctrl["portfolio_id"], day_pnl=day_pnl, limit=limit)
        except Exception as exc:
            logger.warning("risk.check_error", exc=str(exc))


async def _check_rebalancing(db, loop) -> None:
    """Check portfolio weights against rebalancing rules and insert alerts."""
    from collections import defaultdict

    # Get all active rebalancing rules
    rules = await loop.run_in_executor(None, lambda:
        db.schema("markets").from_("rebalancing_rules")
          .select("id, portfolio_id, instrument_id, symbol, target_weight, min_weight, max_weight")
          .eq("alert_enabled", True)
          .execute().data
    )
    if not rules:
        return

    # Group by portfolio
    by_portfolio: dict = defaultdict(list)
    for r in rules:
        by_portfolio[r["portfolio_id"]].append(r)

    for portfolio_id, port_rules in by_portfolio.items():
        # Get holdings for this portfolio
        holdings = await loop.run_in_executor(None, lambda p=portfolio_id:
            db.schema("markets").from_("holdings")
              .select("instrument_id, qty, avg_cost")
              .eq("portfolio_id", p)
              .gt("qty", 0)
              .execute().data
        )
        if not holdings:
            continue

        # Estimate total value using avg_cost (simplified — real implementation uses LTP)
        total = sum(float(h["qty"]) * float(h["avg_cost"]) for h in holdings)
        if total <= 0:
            continue

        holding_map = {h["instrument_id"]: h for h in holdings}

        for rule in port_rules:
            h = holding_map.get(rule["instrument_id"])
            if not h:
                continue
            current_value = float(h["qty"]) * float(h["avg_cost"])
            current_weight = (current_value / total) * 100

            min_w = float(rule["min_weight"] or 0)
            max_w = float(rule["max_weight"] or 100)

            direction = None
            if current_weight > max_w:
                direction = "over"
            elif current_weight < min_w and min_w > 0:
                direction = "under"

            if direction:
                # Check if we already sent this alert recently (unacknowledged)
                existing = await loop.run_in_executor(None, lambda r=rule, d=direction:
                    db.schema("markets").from_("rebalancing_alerts")
                      .select("id")
                      .eq("rule_id", r["id"])
                      .eq("direction", d)
                      .eq("acknowledged", False)
                      .execute().data
                )
                if existing:
                    continue  # already alerted — skip until acknowledged

                await loop.run_in_executor(None, lambda r=rule, cw=current_weight, d=direction:
                    db.schema("markets").from_("rebalancing_alerts").insert({
                        "rule_id": r["id"],
                        "portfolio_id": portfolio_id,
                        "symbol": r.get("symbol", ""),
                        "current_weight": round(cw, 2),
                        "target_weight": r.get("target_weight"),
                        "direction": d,
                    }).execute()
                )
                logger.info(
                    "rebalancing.alert",
                    portfolio_id=portfolio_id,
                    symbol=rule.get("symbol"),
                    direction=direction,
                    weight=current_weight,
                )


async def _execute_due_sips(db, loop) -> None:
    """Execute SIP schedules due today (sip_day == today's day-of-month)."""
    from datetime import date, datetime, timezone
    today = date.today()
    today_day = today.day
    today_iso = today.isoformat()
    now_iso = datetime.now(timezone.utc).isoformat()

    # Fetch active SIP schedules due today
    rows = await loop.run_in_executor(
        None,
        lambda: db.schema("markets").from_("sip_schedules")
            .select("id, portfolio_id, scheme_code, scheme_name, amount, owner_user_id")
            .eq("sip_day", today_day)
            .eq("status", "active")
            .execute().data or []
    )
    if not rows:
        return

    for sip in rows:
        try:
            # Check if already executed today
            recent = await loop.run_in_executor(
                None,
                lambda s=sip: db.schema("markets").from_("sip_schedules")
                    .select("last_executed_at")
                    .eq("id", s["id"])
                    .maybe_single()
                    .execute()
            )
            if recent and recent.data:
                last = (recent.data.get("last_executed_at") or "")[:10]
                if last == today_iso:
                    continue  # already ran today

            # Insert paper transaction
            await loop.run_in_executor(
                None,
                lambda s=sip: db.schema("markets").from_("transactions").insert({
                    "portfolio_id":  s["portfolio_id"],
                    "owner_user_id": s["owner_user_id"],
                    "txn_type":      "sip",
                    "txn_date":      today_iso,
                    "qty":           1.0,
                    "price":         float(s["amount"]),
                    "charges":       0.0,
                    "net_amount":    float(s["amount"]),
                    "currency":      "INR",
                    "fx_rate":       1.0,
                    "asset_class":   "mutual_fund",
                    "source":        "sip_auto",
                    "notes":         f"Auto SIP: {s['scheme_name']}",
                }).execute()
            )

            # Mark last_executed_at
            await loop.run_in_executor(
                None,
                lambda s=sip: db.schema("markets").from_("sip_schedules")
                    .update({"last_executed_at": now_iso})
                    .eq("id", s["id"])
                    .execute()
            )
            logger.info("sip.executed", schedule_id=sip["id"], scheme=sip["scheme_name"])

        except Exception as exc:
            logger.error("sip.execution_failed", schedule_id=sip.get("id"), error=str(exc))

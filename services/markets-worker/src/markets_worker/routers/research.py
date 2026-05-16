"""Research thread message endpoint.

POST /v1/research/message
  - Fetches thread context (portfolio holdings, recent news, signals)
  - Sends conversation to Claude via LLM gateway (markets.research_thread prompt)
  - Persists both user message and assistant response in markets.research_messages
  - Returns the assistant's response
"""

import uuid
from typing import Any

import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from markets_worker.auth import Auth
from markets_worker.db import get_supabase
from markets_worker.llm_gateway import invoke
from markets_worker.mcp_server import get_holdings, get_news

logger = structlog.get_logger()
router = APIRouter(prefix="/v1/research")


class MessageRequest(BaseModel):
    thread_id: str
    content:   str   # User's message text


class MessageResponse(BaseModel):
    message_id:    str
    content:       str
    input_tokens:  int
    output_tokens: int
    cost_usd:      float
    latency_ms:    int
    request_id:    str


async def _get_thread_context(thread_id: str, user_id: str) -> dict[str, Any]:
    """Build context injected into the research thread system prompt."""
    db = get_supabase()
    thread = (
        db.schema("markets")
        .from_("research_threads")
        .select("id, title, context_type, context_ref_id, owner_user_id, tenant_id")
        .eq("id", thread_id)
        .maybe_single()
        .execute()
    ).data

    if not thread:
        raise HTTPException(404, detail="Thread not found")
    if thread["owner_user_id"] != user_id:
        raise HTTPException(403, detail="Not your thread")

    context: dict[str, Any] = {"thread_title": thread.get("title")}

    # If thread is scoped to a portfolio, inject holdings + news
    if thread.get("context_type") == "portfolio" and thread.get("context_ref_id"):
        portfolio_id = thread["context_ref_id"]
        try:
            context["holdings"] = await get_holdings(portfolio_id)
            symbols = ",".join(
                h["symbol"] for h in context["holdings"] if h.get("symbol")
            )[:500]  # cap length
            if symbols:
                context["recent_news"] = await get_news(symbols, days=3)
        except Exception as exc:
            logger.warning("research.context_fetch_failed", error=str(exc))

    return context


async def _load_history(thread_id: str, limit: int = 20) -> list[dict]:
    db = get_supabase()
    result = (
        db.schema("markets")
        .from_("research_messages")
        .select("role, content, sequence_num")
        .eq("thread_id", thread_id)
        .order("sequence_num", desc=False)
        .limit(limit)
        .execute()
    )
    return [
        {"role": row["role"], "content": row["content"]}
        for row in (result.data or [])
    ]


async def _persist_message(
    *,
    thread_id: str,
    tenant_id: str | None,
    franchise_id: str | None,
    user_id: str | None,
    role: str,
    content: str,
    provider: str | None = None,
    model: str | None = None,
    input_tokens: int = 0,
    output_tokens: int = 0,
    cost_usd: float = 0.0,
    is_error: bool = False,
) -> str:
    msg_id = str(uuid.uuid4())
    get_supabase().schema("markets").from_("research_messages").insert({
        "id":            msg_id,
        "thread_id":     thread_id,
        "tenant_id":     tenant_id,
        "franchise_id":  franchise_id,
        "owner_user_id": user_id,
        "role":          role,
        "content":       content,
        "llm_provider":  provider,
        "llm_model":     model,
        "input_tokens":  input_tokens,
        "output_tokens": output_tokens,
        "cost_usd":      cost_usd,
        "is_error":      is_error,
    }).execute()
    return msg_id


@router.post("/message", response_model=MessageResponse)
async def post_message(body: MessageRequest, auth: Auth):
    if not auth.user_id and not auth.is_service_account:
        raise HTTPException(401, detail="User ID required for research threads")

    user_id = auth.user_id or auth.service_account_id

    # Load context + conversation history in parallel (sequential for simplicity)
    context = await _get_thread_context(body.thread_id, user_id)
    history = await _load_history(body.thread_id, limit=20)

    # Persist user message first (fires the sequence trigger)
    await _persist_message(
        thread_id=body.thread_id,
        tenant_id=auth.tenant_id,
        franchise_id=auth.franchise_id,
        user_id=user_id,
        role="user",
        content=body.content,
    )

    # Build conversation with full history
    messages = [*history, {"role": "user", "content": body.content}]

    # Build context summary for system prompt augmentation
    ctx_parts: list[str] = []
    if context.get("holdings"):
        n = len(context["holdings"])
        total_value = sum(h.get("current_value") or 0 for h in context["holdings"])
        ctx_parts.append(f"Portfolio has {n} holdings, estimated value ₹{total_value:,.0f}.")
    if context.get("recent_news"):
        n = len(context["recent_news"])
        ctx_parts.append(f"{n} recent news items ingested (last 3 days).")
    context_note = " ".join(ctx_parts) if ctx_parts else ""

    system_suffix = f"\n\nCurrent context: {context_note}" if context_note else ""

    # Invoke LLM
    result = await invoke(
        task_id="markets.research_thread",
        variables={"user_message": body.content},
        tenant_id=auth.tenant_id,
        franchise_id=auth.franchise_id,
        user_id=user_id,
        messages=messages,
        system_override=None,  # will be loaded from prompts table + suffix appended
    )

    # Append context note to system prompt if present
    # (invoke already resolved the system prompt from DB; we do a second pass for context)
    # TODO: wire context_note into system_prompt inside invoke() via variables substitution

    # Persist assistant message
    assistant_msg_id = await _persist_message(
        thread_id=body.thread_id,
        tenant_id=auth.tenant_id,
        franchise_id=auth.franchise_id,
        user_id=user_id,
        role="assistant",
        content=result.content,
        provider=result.provider,
        model=result.model,
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
        cost_usd=result.cost_usd,
    )

    logger.info(
        "research.message",
        thread_id=body.thread_id,
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
        cost_usd=result.cost_usd,
    )

    return MessageResponse(
        message_id=assistant_msg_id,
        content=result.content,
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
        cost_usd=result.cost_usd,
        latency_ms=result.latency_ms,
        request_id=result.request_id,
    )

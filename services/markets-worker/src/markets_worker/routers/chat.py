"""AI conversational assistant for the markets domain with SSE streaming.

Endpoints (prefix /v1/chat):
  GET    /v1/chat/sessions                          — list sessions
  POST   /v1/chat/sessions                          — create session
  DELETE /v1/chat/sessions/{session_id}             — delete session + messages
  GET    /v1/chat/sessions/{session_id}/messages    — list messages
  POST   /v1/chat/sessions/{session_id}/stream      — streaming chat (SSE)
"""

import asyncio
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Any, AsyncGenerator

import structlog
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from markets_worker.auth import Auth
from markets_worker.db import get_supabase
from markets_worker.llm_gateway import resolve_llm_config

logger = structlog.get_logger()

router = APIRouter(prefix="/v1/chat")

_executor = ThreadPoolExecutor(max_workers=4)

# ── System prompt ─────────────────────────────────────────────────────────────

_BASE_SYSTEM_PROMPT = """You are an expert Indian stock market assistant embedded in Logic Nexus AI, a professional trading and investment platform. You help users with:
- Market analysis, technical and fundamental
- Portfolio advice and risk management
- Options and F&O strategies
- Understanding economic indicators, FII/DII flows
- Trade ideas, backtesting concepts
- NSE/BSE instruments, indices, and sectors

Be concise, precise, and use ₹ for Indian currency. When discussing stocks, prefer NSE symbols. \
Format responses in markdown when helpful (use code blocks for calculations, tables for comparisons).
Today's date context: use current date when relevant.
If the user shares a symbol or portfolio context, factor it into your analysis."""


# ── Pydantic models ───────────────────────────────────────────────────────────

class CreateSessionBody(BaseModel):
    title: str | None = None


class StreamBody(BaseModel):
    message: str
    context: dict[str, Any] | None = None


# ── DB helpers ────────────────────────────────────────────────────────────────

def _db():
    return get_supabase()


def _sessions_table():
    return _db().schema("markets").from_("chat_sessions")


def _messages_table():
    return _db().schema("markets").from_("chat_messages")


def _require_session_owner(session_id: str, user_id: str) -> dict:
    """Fetch session and raise 403/404 if not owned by user_id."""
    result = (
        _sessions_table()
        .select("id, user_id, title, created_at, updated_at")
        .eq("id", session_id)
        .maybe_single()
        .execute()
    )
    session = result.data if result else None
    if not session:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Session not found")
    if session["user_id"] != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Not your session")
    return session


# ── Streaming helpers ─────────────────────────────────────────────────────────

def _build_system_prompt(context: dict[str, Any] | None) -> str:
    system = _BASE_SYSTEM_PROMPT
    if context:
        symbol = context.get("symbol")
        portfolio_summary = context.get("portfolio_summary")
        if symbol:
            system += f"\nCurrent chart symbol in focus: {symbol}"
        if portfolio_summary:
            system += f"\nUser portfolio context: {portfolio_summary}"
    return system


async def _generate_sse(
    cfg: Any,
    messages_payload: list[dict],
    system_prompt: str,
    on_complete,
) -> AsyncGenerator[str, None]:
    """Async SSE generator — supports Anthropic streaming and OpenAI-compat streaming."""
    queue: asyncio.Queue[str | None] = asyncio.Queue()
    loop = asyncio.get_event_loop()

    def run_stream():
        full_text: list[str] = []
        try:
            if cfg.provider in ("anthropic", "claude"):
                import anthropic
                client = anthropic.Anthropic(api_key=cfg.api_key)
                with client.messages.stream(
                    model=cfg.model,
                    max_tokens=1024,
                    system=system_prompt,
                    messages=messages_payload,
                ) as stream:
                    for text in stream.text_stream:
                        full_text.append(text)
                        asyncio.run_coroutine_threadsafe(queue.put(text), loop)
            else:
                from openai import OpenAI
                from markets_worker.llm_gateway import OPENROUTER_BASE_URL
                base_url = cfg.base_url or (OPENROUTER_BASE_URL if cfg.provider == "openrouter" else None)
                client = OpenAI(api_key=cfg.api_key, base_url=base_url)
                oai_msgs = [{"role": "system", "content": system_prompt}, *messages_payload]
                stream = client.chat.completions.create(
                    model=cfg.model,
                    max_tokens=1024,
                    messages=oai_msgs,
                    stream=True,
                )
                for chunk in stream:
                    delta = chunk.choices[0].delta.content or "" if chunk.choices else ""
                    if delta:
                        full_text.append(delta)
                        asyncio.run_coroutine_threadsafe(queue.put(delta), loop)
        finally:
            asyncio.run_coroutine_threadsafe(queue.put(None), loop)
        return "".join(full_text)

    future = loop.run_in_executor(_executor, run_stream)

    while True:
        chunk = await queue.get()
        if chunk is None:
            break
        yield f"data: {chunk}\n\n"

    yield "data: [DONE]\n\n"

    full_response = await future
    await on_complete(full_response)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/sessions")
async def list_sessions(auth: Auth):
    """List the authenticated user's chat sessions, most recent first."""
    if not auth.user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="User ID required")

    result = (
        _sessions_table()
        .select("id, title, created_at, updated_at")
        .eq("user_id", auth.user_id)
        .order("updated_at", desc=True)
        .limit(20)
        .execute()
    )
    return result.data or []


@router.post("/sessions", status_code=status.HTTP_201_CREATED)
async def create_session(body: CreateSessionBody, auth: Auth):
    """Create a new chat session."""
    if not auth.user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="User ID required")

    session_id = str(uuid.uuid4())
    title = body.title or "New Chat"
    row = {
        "id":      session_id,
        "user_id": auth.user_id,
        "title":   title,
    }
    result = _sessions_table().insert(row).execute()
    data = result.data
    if not data:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create session")
    return data[0]


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(session_id: str, auth: Auth):
    """Delete a session and all its messages."""
    if not auth.user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="User ID required")

    _require_session_owner(session_id, auth.user_id)

    # Delete messages first (FK constraint), then session
    _messages_table().delete().eq("session_id", session_id).execute()
    _sessions_table().delete().eq("id", session_id).execute()
    return None


@router.get("/sessions/{session_id}/messages")
async def list_messages(session_id: str, auth: Auth):
    """List messages for a session, oldest first."""
    if not auth.user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="User ID required")

    _require_session_owner(session_id, auth.user_id)

    result = (
        _messages_table()
        .select("id, role, content, created_at")
        .eq("session_id", session_id)
        .order("created_at", desc=False)
        .execute()
    )
    return result.data or []


@router.post("/sessions/{session_id}/stream")
async def stream_chat(session_id: str, body: StreamBody, auth: Auth):
    """Stream an Anthropic response for the given session via SSE."""
    if not auth.user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="User ID required")

    # 1. Verify session ownership
    _require_session_owner(session_id, auth.user_id)

    # 2. Load last 20 messages as history
    history_result = (
        _messages_table()
        .select("role, content")
        .eq("session_id", session_id)
        .order("created_at", desc=False)
        .limit(20)
        .execute()
    )
    history = [
        {"role": row["role"], "content": row["content"]}
        for row in (history_result.data or [])
    ]

    # 3. Save user message
    user_msg_id = str(uuid.uuid4())
    _messages_table().insert({
        "id":         user_msg_id,
        "session_id": session_id,
        "user_id":    auth.user_id,
        "role":       "user",
        "content":    body.message,
    }).execute()

    # 4. Build messages payload for Anthropic
    messages_payload = [*history, {"role": "user", "content": body.message}]

    # 5. Build system prompt (with optional context injections)
    system_prompt = _build_system_prompt(body.context)

    # 6. Resolve LLM config (Anthropic or OpenAI-compat, whichever is configured)
    try:
        cfg = resolve_llm_config(auth.tenant_id)
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))

    # 7. Callback: persist assistant response + update session after stream ends
    async def on_complete(full_response: str) -> None:
        if not full_response:
            return

        # Persist assistant message
        _messages_table().insert({
            "id":         str(uuid.uuid4()),
            "session_id": session_id,
            "user_id":    auth.user_id,
            "role":       "assistant",
            "content":    full_response,
        }).execute()

        # Update session updated_at; auto-generate title from first user message
        update_payload: dict[str, Any] = {"updated_at": "now()"}
        session = (
            _sessions_table()
            .select("title")
            .eq("id", session_id)
            .maybe_single()
            .execute()
        )
        if session and session.data and session.data.get("title") == "New Chat":
            update_payload["title"] = body.message[:60]

        _sessions_table().update(update_payload).eq("id", session_id).execute()

        logger.info(
            "chat.stream_complete",
            session_id=session_id,
            user_id=auth.user_id,
            response_len=len(full_response),
        )

    # 8. Return StreamingResponse
    return StreamingResponse(
        _generate_sse(cfg, messages_payload, system_prompt, on_complete),
        media_type="text/event-stream",
        headers={
            "Cache-Control":    "no-cache",
            "X-Accel-Buffering": "no",
        },
    )

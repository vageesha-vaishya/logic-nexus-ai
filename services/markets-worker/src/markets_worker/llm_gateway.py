"""LLM Gateway — single chokepoint for all AI calls from the Python worker.

Provider resolution order:
  1. platform.llm_provider_configs — the LLM configured in Settings → LLM Provider UI
  2. Environment variables (fallback for local dev without a DB config)

OpenRouter uses the OpenAI-compatible API so we use the OpenAI client with
a custom base_url for both openrouter and custom/local providers.
"""

import time
import uuid
from functools import lru_cache
from typing import Any

import structlog
from anthropic import Anthropic
from openai import OpenAI

from markets_worker.config import get_settings
from markets_worker.db import get_supabase

logger = structlog.get_logger()

# ── Provider resolution ───────────────────────────────────────────────────────

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

# Approximate cost per 1M tokens (USD)
_COST_TABLE: dict[str, tuple[float, float]] = {
    "claude-sonnet-4-6":              (3.0,  15.0),
    "claude-haiku-4-5":               (0.8,   4.0),
    "claude-opus-4-7":                (15.0, 75.0),
    "gpt-4o":                         (5.0,  15.0),
    "gpt-4o-mini":                    (0.15,  0.6),
    "google/gemini-2.5-flash-lite":   (0.07,  0.3),
    "google/gemini-2.5-flash":        (0.15,  0.6),
    "google/gemini-2.5-pro":          (1.25,  5.0),
}


class ResolvedConfig:
    """Resolved LLM provider + model + credentials."""
    def __init__(
        self,
        *,
        provider: str,
        model: str,
        api_key: str,
        base_url: str | None = None,
        max_tokens: int = 2048,
        config_id: str | None = None,
    ):
        self.provider = provider
        self.model = model
        self.api_key = api_key
        self.base_url = base_url
        self.max_tokens = max_tokens
        self.config_id = config_id


def _resolve_from_db(tenant_id: str | None = None) -> ResolvedConfig | None:
    """
    Read the default active LLM config from platform.llm_provider_configs.
    Retrieves the API key from vault.decrypted_secrets via a single query.
    Returns None if no config exists (falls back to env vars).
    """
    try:
        db = get_supabase()
        q = (
            db.schema("platform")
            .rpc("get_default_llm_config", {"p_tenant_id": tenant_id})
            .execute()
        )
        if q.data and len(q.data) > 0:
            row = q.data[0]  # RPC returns a list of rows
            return ResolvedConfig(
                provider=row["provider"],
                model=row["default_model"],
                api_key=row["api_key"],
                base_url=row.get("base_url"),
                config_id=row.get("id"),
            )
    except Exception as exc:
        logger.warning("llm_gateway.db_resolve_failed", error=str(exc))
    return None


def _resolve_from_env() -> ResolvedConfig:
    """Fallback: use env vars (local dev without a DB config)."""
    s = get_settings()
    if s.anthropic_api_key and not s.anthropic_api_key.startswith("your-"):
        return ResolvedConfig(
            provider="anthropic",
            model="claude-sonnet-4-6",
            api_key=s.anthropic_api_key,
        )
    if s.openai_api_key and not s.openai_api_key.startswith("your-"):
        return ResolvedConfig(
            provider="openai",
            model="gpt-4o-mini",
            api_key=s.openai_api_key,
        )
    raise RuntimeError(
        "No LLM configured. Add a provider in Settings → LLM Provider, "
        "or set ANTHROPIC_API_KEY / OPENAI_API_KEY in .env"
    )


def resolve_llm_config(tenant_id: str | None = None) -> ResolvedConfig:
    """Return the active LLM config: DB first, env fallback."""
    return _resolve_from_db(tenant_id) or _resolve_from_env()


def _make_client(cfg: ResolvedConfig) -> tuple[str, Any]:
    """Return (provider_family, client) — 'anthropic' or 'openai-compat'."""
    if cfg.provider in ("anthropic", "claude"):
        return "anthropic", Anthropic(api_key=cfg.api_key)

    # OpenAI, OpenRouter, Gemini (via OpenRouter), custom local — all OpenAI-compat
    base_url = cfg.base_url or (
        OPENROUTER_BASE_URL if cfg.provider == "openrouter" else None
    )
    extra_headers: dict[str, str] = {}
    if cfg.provider == "openrouter":
        extra_headers["HTTP-Referer"] = "https://logic-nexus.ai"
        extra_headers["X-Title"] = "Logic Nexus AI Markets"

    client = OpenAI(
        api_key=cfg.api_key,
        base_url=base_url,
        default_headers=extra_headers if extra_headers else None,
    )
    return "openai_compat", client


# ── Prompt resolution ─────────────────────────────────────────────────────────

def _render_template(template: str, variables: dict[str, str]) -> str:
    result = template
    for key, value in variables.items():
        result = result.replace(f"${{{key}}}", str(value))
    return result


def _resolve_prompt(task_id: str, variables: dict[str, str]) -> tuple[str, str, str | None]:
    """Returns (system_prompt, user_message, prompt_version)."""
    try:
        db = get_supabase()
        result = (
            db.schema("markets").from_("prompts")
            .select("version, system_prompt, user_template")
            .eq("task_id", task_id)
            .eq("state", "active")
            .maybe_single()
            .execute()
        )
        if result.data:
            row = result.data
            return (
                row["system_prompt"],
                _render_template(row["user_template"], variables),
                row["version"],
            )
    except Exception as exc:
        logger.warning("llm_gateway.prompt_resolve_failed", task_id=task_id, error=str(exc))

    # Fallback: use variables directly
    return (
        variables.get("system", "You are a helpful assistant."),
        variables.get("user_message", ""),
        None,
    )


# ── Usage logging ─────────────────────────────────────────────────────────────

def _estimate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    in_rate, out_rate = _COST_TABLE.get(model, (3.0, 15.0))
    return (input_tokens * in_rate + output_tokens * out_rate) / 1_000_000


def _write_usage(*, request_id: str, task_id: str, tenant_id: str | None,
                 franchise_id: str | None, user_id: str | None,
                 provider: str, model: str, input_tokens: int, output_tokens: int,
                 cost_usd: float, latency_ms: int, status: str,
                 prompt_version: str | None, error_message: str | None = None) -> None:
    try:
        get_supabase().schema("platform").from_("llm_usage").insert({
            "request_id": request_id, "task_id": task_id,
            "prompt_version": prompt_version, "tenant_id": tenant_id,
            "franchise_id": franchise_id, "user_id": user_id,
            "provider": provider, "model": model,
            "input_tokens": input_tokens, "output_tokens": output_tokens,
            "cost_usd": cost_usd, "latency_ms": latency_ms,
            "status": status, "error_message": error_message,
        }).execute()
    except Exception as exc:
        logger.warning("llm_usage.write_failed", error=str(exc))


# ── Result type ───────────────────────────────────────────────────────────────

class LlmGatewayResult:
    def __init__(self, *, content: str, provider: str, model: str,
                 input_tokens: int, output_tokens: int, cost_usd: float,
                 latency_ms: int, request_id: str, prompt_version: str | None):
        self.content = content
        self.provider = provider
        self.model = model
        self.input_tokens = input_tokens
        self.output_tokens = output_tokens
        self.cost_usd = cost_usd
        self.latency_ms = latency_ms
        self.request_id = request_id
        self.prompt_version = prompt_version


# ── Main invoke ───────────────────────────────────────────────────────────────

async def invoke(
    *,
    task_id: str,
    variables: dict[str, str],
    tenant_id: str | None = None,
    franchise_id: str | None = None,
    user_id: str | None = None,
    system_override: str | None = None,
    user_override: str | None = None,
    model_override: str | None = None,
    messages: list[dict] | None = None,
    tools: list[dict] | None = None,
) -> LlmGatewayResult:
    request_id = str(uuid.uuid4())
    t0 = time.monotonic()

    # 1. Resolve LLM config from DB (Settings → LLM Provider) or env fallback
    cfg = resolve_llm_config(tenant_id)
    if model_override:
        cfg.model = model_override

    # 2. Resolve prompt from markets.prompts registry (or use overrides)
    if system_override:
        system_prompt = system_override
        user_message  = user_override or _render_template("${user_message}", variables)
        prompt_version = None
    else:
        system_prompt, user_message, prompt_version = _resolve_prompt(task_id, variables)
        if user_override:
            user_message = user_override

    # 3. Build conversation
    convo = list(messages or [])
    if not convo or convo[-1].get("role") != "user":
        convo.append({"role": "user", "content": user_message})

    # 4. Call provider
    provider_family, client = _make_client(cfg)
    input_tokens = output_tokens = 0
    content = ""
    status_str = "ok"
    error_message: str | None = None

    try:
        if provider_family == "anthropic":
            kwargs: dict[str, Any] = {
                "model": cfg.model, "max_tokens": cfg.max_tokens,
                "system": system_prompt, "messages": convo,
            }
            if tools:
                kwargs["tools"] = tools
            response = client.messages.create(**kwargs)
            content = "".join(
                b.text for b in response.content if hasattr(b, "text")
            )
            input_tokens  = response.usage.input_tokens
            output_tokens = response.usage.output_tokens

        else:  # OpenAI-compatible (OpenRouter, OpenAI, Gemini, local)
            oai_msgs = [{"role": "system", "content": system_prompt}, *convo]
            response_oai = client.chat.completions.create(
                model=cfg.model,
                max_tokens=cfg.max_tokens,
                messages=oai_msgs,
            )
            content = response_oai.choices[0].message.content or ""
            usage = response_oai.usage
            input_tokens  = usage.prompt_tokens     if usage else 0
            output_tokens = usage.completion_tokens if usage else 0

    except Exception as exc:
        status_str    = "error"
        error_message = str(exc)
        logger.error("llm_gateway.error", task_id=task_id, provider=cfg.provider,
                     model=cfg.model, error=error_message)
        raise

    finally:
        latency_ms = int((time.monotonic() - t0) * 1000)
        cost_usd   = _estimate_cost(cfg.model, input_tokens, output_tokens)
        _write_usage(
            request_id=request_id, task_id=task_id, tenant_id=tenant_id,
            franchise_id=franchise_id, user_id=user_id,
            provider=cfg.provider, model=cfg.model,
            input_tokens=input_tokens, output_tokens=output_tokens,
            cost_usd=cost_usd, latency_ms=latency_ms, status=status_str,
            prompt_version=prompt_version, error_message=error_message,
        )

    logger.info("llm_gateway.ok", task_id=task_id, provider=cfg.provider,
                model=cfg.model, input_tokens=input_tokens,
                output_tokens=output_tokens, cost_usd=round(cost_usd, 6),
                latency_ms=latency_ms)

    return LlmGatewayResult(
        content=content, provider=cfg.provider, model=cfg.model,
        input_tokens=input_tokens, output_tokens=output_tokens,
        cost_usd=cost_usd, latency_ms=latency_ms,
        request_id=request_id, prompt_version=prompt_version,
    )

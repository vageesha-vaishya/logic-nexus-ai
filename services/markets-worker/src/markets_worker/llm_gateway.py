"""LLM Gateway — single chokepoint for all AI calls from the Python worker.

Resolves the active prompt from markets.prompts, calls the configured
provider (Anthropic primary, OpenAI fallback), and writes every call
to platform.llm_usage for cost attribution.
"""

import time
import uuid
from typing import Any

import structlog
from anthropic import Anthropic
from openai import OpenAI

from markets_worker.config import get_settings
from markets_worker.db import get_supabase

logger = structlog.get_logger()


def _anthropic_client() -> Anthropic:
    return Anthropic(api_key=get_settings().anthropic_api_key)


def _openai_client() -> OpenAI:
    return OpenAI(api_key=get_settings().openai_api_key)


def _render_template(template: str, variables: dict[str, str]) -> str:
    """Simple ${var} substitution — no Jinja to keep deps minimal."""
    result = template
    for key, value in variables.items():
        result = result.replace(f"${{{key}}}", str(value))
    return result


def _write_usage(
    *,
    request_id: str,
    task_id: str,
    tenant_id: str | None,
    franchise_id: str | None,
    user_id: str | None,
    provider: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    cost_usd: float,
    latency_ms: int,
    status: str,
    prompt_version: str | None,
    error_message: str | None = None,
) -> None:
    try:
        get_supabase().schema("platform").from_("llm_usage").insert({
            "request_id":    request_id,
            "task_id":       task_id,
            "prompt_version": prompt_version,
            "tenant_id":     tenant_id,
            "franchise_id":  franchise_id,
            "user_id":       user_id,
            "provider":      provider,
            "model":         model,
            "input_tokens":  input_tokens,
            "output_tokens": output_tokens,
            "cost_usd":      cost_usd,
            "latency_ms":    latency_ms,
            "status":        status,
            "error_message": error_message,
        }).execute()
    except Exception as exc:
        logger.warning("llm_usage write failed", error=str(exc))


# Approximate cost per 1M tokens (USD) — update as pricing changes
_COST_TABLE: dict[str, tuple[float, float]] = {
    "claude-sonnet-4-6":  (3.0,  15.0),
    "claude-haiku-4-5":   (0.8,   4.0),
    "claude-opus-4-7":    (15.0, 75.0),
    "gpt-4o":             (5.0,  15.0),
    "gpt-4o-mini":        (0.15,  0.6),
}

def _estimate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    in_rate, out_rate = _COST_TABLE.get(model, (5.0, 15.0))
    return (input_tokens * in_rate + output_tokens * out_rate) / 1_000_000


class LlmGatewayResult:
    def __init__(
        self,
        *,
        content: str,
        provider: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
        cost_usd: float,
        latency_ms: int,
        request_id: str,
        prompt_version: str | None,
    ):
        self.content = content
        self.provider = provider
        self.model = model
        self.input_tokens = input_tokens
        self.output_tokens = output_tokens
        self.cost_usd = cost_usd
        self.latency_ms = latency_ms
        self.request_id = request_id
        self.prompt_version = prompt_version


async def invoke(
    *,
    task_id: str,
    variables: dict[str, str],
    tenant_id: str | None = None,
    franchise_id: str | None = None,
    user_id: str | None = None,
    # Optional overrides (bypass DB prompt lookup)
    system_override: str | None = None,
    user_override: str | None = None,
    model_override: str | None = None,
    tools: list[dict] | None = None,
    messages: list[dict] | None = None,
) -> LlmGatewayResult:
    request_id = str(uuid.uuid4())
    t0 = time.monotonic()
    s = get_settings()

    # ── Resolve prompt from DB (or use override) ─────────────────────────
    prompt_version: str | None = None
    provider = "anthropic"
    model = "claude-sonnet-4-6"
    max_tokens = 2048
    system_prompt = system_override or ""
    user_message = user_override or _render_template("${user_message}", variables)

    if not system_override:
        db = get_supabase()
        result = (
            db.schema("markets").from_("prompts")
            .select("version, system_prompt, user_template, provider_overrides")
            .eq("task_id", task_id)
            .eq("state", "active")
            .maybe_single()
            .execute()
        )
        if result.data:
            row = result.data
            prompt_version = row["version"]
            system_prompt = row["system_prompt"]
            user_message = _render_template(row["user_template"], variables)
            overrides: dict[str, Any] = row.get("provider_overrides") or {}
            provider  = overrides.get("provider",   provider)
            model     = model_override or overrides.get("model",     model)
            max_tokens = overrides.get("max_tokens", max_tokens)

    # ── Build conversation history ────────────────────────────────────────
    convo = list(messages or [])
    if not convo or convo[-1].get("role") != "user":
        convo.append({"role": "user", "content": user_message})

    # ── Call provider ─────────────────────────────────────────────────────
    input_tokens = output_tokens = 0
    content = ""
    status_str = "ok"
    error_message: str | None = None

    try:
        if provider in ("anthropic", "claude"):
            client = _anthropic_client()
            kwargs: dict[str, Any] = {
                "model":      model,
                "max_tokens": max_tokens,
                "system":     system_prompt,
                "messages":   convo,
            }
            if tools:
                kwargs["tools"] = tools

            response = client.messages.create(**kwargs)
            content = "".join(
                block.text for block in response.content
                if hasattr(block, "text")
            )
            input_tokens  = response.usage.input_tokens
            output_tokens = response.usage.output_tokens

        elif provider == "openai":
            client_oai = _openai_client()
            oai_msgs = [{"role": "system", "content": system_prompt}, *convo]
            response_oai = client_oai.chat.completions.create(
                model=model,
                max_tokens=max_tokens,
                messages=oai_msgs,
            )
            content = response_oai.choices[0].message.content or ""
            usage = response_oai.usage
            input_tokens  = usage.prompt_tokens if usage else 0
            output_tokens = usage.completion_tokens if usage else 0

        else:
            raise ValueError(f"Unknown provider: {provider}")

    except Exception as exc:
        status_str = "error"
        error_message = str(exc)
        logger.error("llm_gateway.error", task_id=task_id, error=error_message)
        raise

    finally:
        latency_ms = int((time.monotonic() - t0) * 1000)
        cost_usd   = _estimate_cost(model, input_tokens, output_tokens)
        _write_usage(
            request_id=request_id,
            task_id=task_id,
            tenant_id=tenant_id,
            franchise_id=franchise_id,
            user_id=user_id,
            provider=provider,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost_usd,
            latency_ms=latency_ms,
            status=status_str,
            prompt_version=prompt_version,
            error_message=error_message,
        )

    logger.info(
        "llm_gateway.ok",
        task_id=task_id,
        model=model,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cost_usd=round(cost_usd, 6),
        latency_ms=latency_ms,
    )

    return LlmGatewayResult(
        content=content,
        provider=provider,
        model=model,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cost_usd=cost_usd,
        latency_ms=latency_ms,
        request_id=request_id,
        prompt_version=prompt_version,
    )

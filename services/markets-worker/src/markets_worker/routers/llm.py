from fastapi import APIRouter
from pydantic import BaseModel

from markets_worker.auth import Auth
from markets_worker.llm_gateway import invoke

router = APIRouter(prefix="/v1/llm")


class InvokeRequest(BaseModel):
    task_id:  str
    variables: dict[str, str] = {}
    model_override: str | None = None


class InvokeResponse(BaseModel):
    content:        str
    provider:       str
    model:          str
    input_tokens:   int
    output_tokens:  int
    cost_usd:       float
    latency_ms:     int
    request_id:     str
    prompt_version: str | None


@router.post("/invoke", response_model=InvokeResponse)
async def llm_invoke(body: InvokeRequest, auth: Auth):
    result = await invoke(
        task_id=body.task_id,
        variables=body.variables,
        tenant_id=auth.tenant_id,
        user_id=auth.user_id,
        model_override=body.model_override,
    )
    return InvokeResponse(
        content=result.content,
        provider=result.provider,
        model=result.model,
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
        cost_usd=result.cost_usd,
        latency_ms=result.latency_ms,
        request_id=result.request_id,
        prompt_version=result.prompt_version,
    )

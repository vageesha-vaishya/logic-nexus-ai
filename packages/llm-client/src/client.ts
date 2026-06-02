// Real HTTP wrapper for the unified LLM gateway. Per
// docs/plans/2026-06-02-unified-llm-gateway-design.md §1.5 + §2.6.
//
// Previously this file threw a NOT_WIRED stub from Phase 0. P4.1 turns
// it into a thin client over services/llm-gateway. The InvokeRequest /
// InvokeResponse / Outcome contract is preserved 1:1 so any caller
// that imported these types is unaffected.

import type { InvokeRequest, InvokeResponse, Outcome } from "./types.js";

// ── Public configuration surface ──────────────────────────────────────────

export interface LlmClientOptions {
  /** Base URL of the gateway. Falls back to LLM_GATEWAY_URL env, then http://localhost:3020. */
  gatewayUrl?: string;
  /** Bearer service token. Falls back to LLM_SERVICE_TOKEN env. */
  serviceToken?: string;
  /** Calling platform identifier (sent as X-Platform-Id). Falls back to LLM_PLATFORM_ID env. */
  platformId?: string;
  /** Per-call defaults. */
  defaults?: {
    timeoutMs?: number;
    /** Reserved for future retry-on-5xx logic; currently unused. */
    retries?: number;
  };
  /**
   * Optional fetch impl. Defaults to globalThis.fetch. Injection is the
   * test seam — production callers should not override this.
   */
  fetch?: typeof fetch;
}

/** Error thrown for any non-2xx response from the gateway. */
export class LlmGatewayError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly request_id: string | null,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "LlmGatewayError";
  }
}

/** Resolves the active prompt response from GET /v1/prompts/:key. */
export interface PromptFetchResult {
  prompt: {
    key: string;
    module: string;
    feature: string;
    description?: string | null;
    status: string;
    active_version_id: string | null;
  };
  active_version: {
    id: string;
    prompt_key: string;
    version_number: number;
    body: string;
    body_variants: Record<string, string>;
    frontmatter: Record<string, unknown>;
    default_capability?: string | null;
    default_temperature?: number | null;
    default_max_tokens?: number | null;
    cache_ttl_seconds: number;
    safety_class: string;
    status: string;
  };
}

// ── Implementation ────────────────────────────────────────────────────────

const DEFAULT_GATEWAY_URL = "http://localhost:3020";
const DEFAULT_TIMEOUT_MS = 30_000;

interface ResolvedConfig {
  gatewayUrl: string;
  serviceToken: string | null;
  platformId: string | null;
  timeoutMs: number;
  fetchImpl: typeof fetch;
}

function readEnv(name: string): string | undefined {
  // Node and browser-bundlers (Vite, Webpack DefinePlugin) both expose
  // process.env at build/runtime. Guarded so this file is safe in any env.
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return proc?.env?.[name];
}

function resolveConfig(opts: LlmClientOptions): ResolvedConfig {
  const gatewayUrl =
    opts.gatewayUrl?.trim() || readEnv("LLM_GATEWAY_URL")?.trim() || DEFAULT_GATEWAY_URL;
  const serviceToken =
    opts.serviceToken?.trim() || readEnv("LLM_SERVICE_TOKEN")?.trim() || null;
  const platformId =
    opts.platformId?.trim() || readEnv("LLM_PLATFORM_ID")?.trim() || null;
  const fetchImpl = opts.fetch ?? (globalThis as { fetch?: typeof fetch }).fetch;
  if (!fetchImpl) {
    throw new Error(
      "[@platform/llm-client] no fetch implementation found. Inject one via options.fetch or run on Node 18+ / a modern browser.",
    );
  }
  return {
    gatewayUrl: gatewayUrl.replace(/\/+$/, ""),
    serviceToken,
    platformId,
    timeoutMs: opts.defaults?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    fetchImpl,
  };
}

interface GatewayErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: Record<string, unknown>;
    request_id?: string;
  };
}

async function parseResponseOrThrow<T>(res: Response): Promise<T> {
  if (res.ok) {
    return (await res.json()) as T;
  }
  let body: GatewayErrorBody = {};
  try {
    body = (await res.json()) as GatewayErrorBody;
  } catch {
    // body wasn't JSON; carry on with empty envelope
  }
  const code = body.error?.code ?? "INTERNAL";
  const message = body.error?.message ?? `Gateway returned ${res.status}`;
  throw new LlmGatewayError(
    code,
    message,
    res.status,
    body.error?.request_id ?? res.headers.get("x-request-id") ?? null,
    body.error?.details,
  );
}

export class LlmClient {
  private readonly cfg: ResolvedConfig;

  constructor(opts: LlmClientOptions = {}) {
    this.cfg = resolveConfig(opts);
  }

  private headers(extra?: Record<string, string>): Headers {
    const h = new Headers({ "Content-Type": "application/json", Accept: "application/json" });
    if (this.cfg.serviceToken) h.set("Authorization", `Bearer ${this.cfg.serviceToken}`);
    if (this.cfg.platformId) h.set("X-Platform-Id", this.cfg.platformId);
    if (extra) for (const [k, v] of Object.entries(extra)) h.set(k, v);
    return h;
  }

  private async request<T>(path: string, init: RequestInit & { timeoutMs?: number }): Promise<T> {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), init.timeoutMs ?? this.cfg.timeoutMs);
    try {
      const res = await this.cfg.fetchImpl(`${this.cfg.gatewayUrl}${path}`, {
        ...init,
        signal: ctrl.signal,
      });
      return await parseResponseOrThrow<T>(res);
    } finally {
      clearTimeout(timeout);
    }
  }

  async invoke<TOutput = unknown>(req: InvokeRequest): Promise<InvokeResponse<TOutput>> {
    return this.request<InvokeResponse<TOutput>>("/v1/invoke", {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(req),
      timeoutMs: req.options?.timeout_ms,
    });
  }

  async recordOutcome(invocation_id: string, outcome: Outcome): Promise<void> {
    // POST /v1/outcomes is not implemented gateway-side yet (lands in a
    // future slice). For now we hit the endpoint and swallow 404 / 503
    // as a warning so outcome telemetry never crashes a caller workflow.
    try {
      await this.request<void>("/v1/outcomes", {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({ invocation_id, outcome }),
      });
    } catch (err) {
      if (err instanceof LlmGatewayError && (err.status === 404 || err.status === 503)) {
        // expected until the endpoint exists; silently degrade
        return;
      }
      throw err;
    }
  }

  async getPrompt(key: string): Promise<PromptFetchResult> {
    return this.request<PromptFetchResult>(`/v1/prompts/${encodeURIComponent(key)}`, {
      method: "GET",
      headers: this.headers(),
    });
  }

  async renderPrompt(key: string, variables: Record<string, unknown>, provider_kind?: string): Promise<{
    prompt_key: string;
    version_id: string;
    version_number: number;
    rendered: string;
    missing_paths: string[];
    applied_paths: string[];
    provider_kind: string | null;
  }> {
    return this.request(`/v1/prompts/${encodeURIComponent(key)}/render`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ variables, provider_kind }),
    });
  }
}

// ── Module-singleton convenience API ──────────────────────────────────────
// Keeps the top-level `invoke()` / `recordOutcome()` callable shape from
// Phase 0 so existing imports keep working without `new LlmClient()`.

let singleton: LlmClient | null = null;

/** Initialize (or replace) the module-level singleton client. */
export function configure(opts: LlmClientOptions): LlmClient {
  singleton = new LlmClient(opts);
  return singleton;
}

function getSingleton(): LlmClient {
  if (!singleton) singleton = new LlmClient();
  return singleton;
}

export async function invoke<TOutput = unknown>(req: InvokeRequest): Promise<InvokeResponse<TOutput>> {
  return getSingleton().invoke<TOutput>(req);
}

export async function recordOutcome(invocation_id: string, outcome: Outcome): Promise<void> {
  return getSingleton().recordOutcome(invocation_id, outcome);
}

export async function getPrompt(key: string): Promise<PromptFetchResult> {
  return getSingleton().getPrompt(key);
}

export async function renderPrompt(
  key: string,
  variables: Record<string, unknown>,
  provider_kind?: string,
): Promise<ReturnType<LlmClient["renderPrompt"]>> {
  return getSingleton().renderPrompt(key, variables, provider_kind);
}

/** Test helper — never call from production. */
export function _resetSingletonForTesting(): void {
  singleton = null;
}

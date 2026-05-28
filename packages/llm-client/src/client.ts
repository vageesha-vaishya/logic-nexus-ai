import type { InvokeRequest, InvokeResponse, Outcome } from "./types.js";

const NOT_WIRED_MESSAGE =
  "[@platform/llm-client] not yet wired. See docs/plans/2026-05-28-platform-modules-redesign.md §6 (LLM infrastructure) and §7.4 Phase 9 (rollout).";

/**
 * The platform-wide entry point for every LLM call. CI lint enforces that
 * `@anthropic-ai/sdk`, `openai`, and other provider SDKs are imported only
 * from inside `packages/llm-client/**`.
 *
 * Phase 0: throws. Full implementation lands in Phase 9 per master §7.4.
 */
export async function invoke<TOutput = unknown>(
  req: InvokeRequest,
): Promise<InvokeResponse<TOutput>> {
  void req;
  throw new Error(NOT_WIRED_MESSAGE);
}

/**
 * Records the downstream outcome of an invocation. Called by application code
 * when a user accepts / rejects / overrides / edits the LLM result. Closes the
 * observability loop (master §6.6).
 *
 * Phase 0: throws.
 */
export async function recordOutcome(
  invocation_id: string,
  outcome: Outcome,
): Promise<void> {
  void invocation_id;
  void outcome;
  throw new Error(NOT_WIRED_MESSAGE);
}

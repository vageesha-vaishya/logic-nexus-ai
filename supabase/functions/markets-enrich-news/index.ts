// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../types.d.ts" />

// markets-enrich-news — two-pass enrichment for markets.news_events rows:
//   PASS 1 (β): instrument tagging — regex-matches symbols from
//               markets.instruments against the headline, fills instruments[].
//               Free, fast, deterministic.
//   PASS 2 (α): sentiment scoring — calls the LLM Gateway (Anthropic Haiku
//               by default per ADR-024) once per batch, parses JSON,
//               populates sentiment_score in [-1, 1]. Costs ~$0.001 per batch.
//
// Behavior:
//   • Input  (POST JSON): { news_event_ids?: string[], limit?: number }
//       - If news_event_ids given: enriches those rows.
//       - Else: enriches recent rows where sentiment_score IS NULL (default 20).
//   • Auth: service-role OR admin user (same as markets-ingest-news).
//   • Sentiment is best-effort — if ANTHROPIC_API_KEY is unset, sentiment is
//     skipped (logged warning); tagging still runs.

import { serveWithLogger } from "../_shared/logger.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { requireServiceRoleOrAdmin } from "../_shared/auth.ts";
import { callLLM, LlmGatewayError } from "../_shared/llm-gateway.ts";

declare const Deno: any;

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

interface NewsRow {
  id: string;
  title: string;
  body: string | null;
  instruments: string[] | null;
  sentiment_score: number | null;
  tenant_id?: string | null;       // null — news_events is shared reference data
  franchise_id?: string | null;
}

interface InstrumentRow {
  symbol: string;
  exchange: string;
  instrument_type: string;
}

interface SentimentItem {
  headline_index: number;
  score: number;       // -1..1
  label: "positive" | "negative" | "neutral";
}

interface EnrichResult {
  considered: number;
  tagged: number;
  sentiment_scored: number;
  sentiment_skipped: number;
  sentiment_error: string | null;
}

const DEFAULT_BATCH_LIMIT = 20;
const SENTIMENT_TENANT_FOR_USAGE = "00000000-0000-0000-0000-000000000000"; // shared/reference; LLM cost charged to "platform" placeholder
// TODO: when this enrichment is invoked per-tenant (e.g., personalized briefs),
// pass the real tenant_id through so platform.llm_usage attributes cost correctly.

serveWithLogger(async (req, logger, supabaseAdmin) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const auth = await requireServiceRoleOrAdmin(req, supabaseAdmin, logger);
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ error: auth.error }),
        { status: auth.status, headers: jsonHeaders },
      );
    }

    // ─── Parse input ───────────────────────────────────────────────────
    let news_event_ids: string[] | undefined;
    let limit = DEFAULT_BATCH_LIMIT;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (Array.isArray(body?.news_event_ids)) {
          news_event_ids = body.news_event_ids.filter((x: unknown) => typeof x === "string");
        }
        if (typeof body?.limit === "number" && body.limit > 0 && body.limit <= 100) {
          limit = Math.floor(body.limit);
        }
      } catch { /* no body → use defaults */ }
    }

    // ─── Select rows to enrich ─────────────────────────────────────────
    let query = (supabaseAdmin as any)
      .schema("markets")
      .from("news_events")
      .select("id, title, body, instruments, sentiment_score");

    if (news_event_ids && news_event_ids.length > 0) {
      query = query.in("id", news_event_ids);
    } else {
      query = query
        .is("sentiment_score", null)
        .order("created_at", { ascending: false })
        .limit(limit);
    }

    const { data: rows, error: rowsErr } = await query;
    if (rowsErr) {
      logger.error("rows lookup failed", { error: rowsErr.message });
      return new Response(
        JSON.stringify({ error: rowsErr.message }),
        { status: 500, headers: jsonHeaders },
      );
    }

    const newsRows: NewsRow[] = (rows ?? []) as NewsRow[];
    if (newsRows.length === 0) {
      const empty: EnrichResult = {
        considered: 0,
        tagged: 0,
        sentiment_scored: 0,
        sentiment_skipped: 0,
        sentiment_error: null,
      };
      return new Response(JSON.stringify(empty), { headers: jsonHeaders });
    }

    // ─── Load instruments catalog (small set; load once per call) ──────
    const { data: instruments, error: instrErr } = await (supabaseAdmin as any)
      .schema("markets")
      .from("instruments")
      .select("symbol, exchange, instrument_type")
      .eq("is_active", true)
      .limit(1000);

    if (instrErr) {
      logger.error("instruments lookup failed", { error: instrErr.message });
    }
    const instrumentList: InstrumentRow[] = instruments ?? [];

    // ─── PASS 1 — instrument tagging ───────────────────────────────────
    const taggedUpdates: Array<{ id: string; instruments: string[] }> = [];
    for (const row of newsRows) {
      const matched = tagInstruments(row.title, instrumentList);
      // Only update if the set actually changed
      const existing = new Set(row.instruments ?? []);
      const next = new Set(matched);
      const changed = matched.length !== existing.size ||
        [...next].some(s => !existing.has(s));
      if (changed) {
        taggedUpdates.push({ id: row.id, instruments: matched });
      }
    }

    // Bulk-apply tag updates
    if (taggedUpdates.length > 0) {
      for (const u of taggedUpdates) {
        const { error: updErr } = await (supabaseAdmin as any)
          .schema("markets")
          .from("news_events")
          .update({ instruments: u.instruments })
          .eq("id", u.id);
        if (updErr) {
          logger.warn("tag update failed", { id: u.id, error: updErr.message });
        }
      }
    }

    // ─── PASS 2 — sentiment via LLM Gateway ────────────────────────────
    let sentimentScored = 0;
    let sentimentSkipped = 0;
    let sentimentError: string | null = null;

    try {
      // Build a single batched prompt input
      const headlines_numbered = newsRows
        .map((r, i) => `${i}. ${r.title}`)
        .join("\n");

      // Use union of all tagged instruments as the "instruments_csv" — gives the model context
      const taggedSymbols = new Set<string>();
      for (const u of taggedUpdates) u.instruments.forEach((s) => taggedSymbols.add(s));
      for (const r of newsRows) (r.instruments ?? []).forEach((s) => taggedSymbols.add(s));
      const instruments_csv = [...taggedSymbols].slice(0, 50).join(", ") || "(none specifically tagged)";

      // Resolve a tenant_id that has an active default LLM config so the
      // gateway can route through tenant_config instead of the missing env key.
      // news_events is shared reference data (no real tenant owner), so we just
      // borrow the platform's first available config for cost-bucketing.
      let resolvedTenantId: string = SENTIMENT_TENANT_FOR_USAGE;
      try {
        const { data: defaultConfig } = await (supabaseAdmin as any)
          .schema("platform")
          .from("llm_provider_configs")
          .select("tenant_id")
          .eq("is_active", true)
          .eq("is_default", true)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (defaultConfig?.tenant_id) {
          resolvedTenantId = defaultConfig.tenant_id;
        }
      } catch (e: any) {
        logger.warn("could not resolve default LLM tenant; falling back to env key", { error: e?.message ?? String(e) });
      }

      const result = await callLLM(
        "markets.news_sentiment",
        { instruments_csv, headlines_numbered },
        {
          tenantId: resolvedTenantId,
          supabaseAdmin,
          logger,
        },
      );

      // Try to parse JSON array out of the response
      const parsed = safeParseJsonArray(result.text);
      if (!parsed || !Array.isArray(parsed)) {
        sentimentError = `Could not parse JSON from LLM response (first 200 chars: ${result.text.slice(0, 200)})`;
        logger.warn("sentiment parse failed", { sample: result.text.slice(0, 200) });
        sentimentSkipped = newsRows.length;
      } else {
        for (const item of parsed as SentimentItem[]) {
          if (
            typeof item?.headline_index !== "number" ||
            item.headline_index < 0 ||
            item.headline_index >= newsRows.length ||
            typeof item?.score !== "number"
          ) continue;

          const row = newsRows[item.headline_index];
          const clamped = Math.max(-1, Math.min(1, item.score));

          const { error: scoreErr } = await (supabaseAdmin as any)
            .schema("markets")
            .from("news_events")
            .update({ sentiment_score: clamped })
            .eq("id", row.id);

          if (scoreErr) {
            logger.warn("sentiment update failed", { id: row.id, error: scoreErr.message });
          } else {
            sentimentScored++;
          }
        }
        sentimentSkipped = newsRows.length - sentimentScored;
      }
    } catch (e: any) {
      if (e instanceof LlmGatewayError && e.code === "missing_api_key") {
        sentimentError = "ANTHROPIC_API_KEY not set — sentiment skipped";
        sentimentSkipped = newsRows.length;
        logger.warn(sentimentError);
      } else {
        sentimentError = e?.message ?? String(e);
        sentimentSkipped = newsRows.length;
        logger.error("sentiment scoring failed", { error: sentimentError });
      }
    }

    const out: EnrichResult = {
      considered: newsRows.length,
      tagged: taggedUpdates.length,
      sentiment_scored: sentimentScored,
      sentiment_skipped: sentimentSkipped,
      sentiment_error: sentimentError,
    };
    logger.info("markets-enrich-news done", out);
    return new Response(JSON.stringify(out), { headers: jsonHeaders });
  } catch (e: any) {
    logger.error("markets-enrich-news unhandled", { error: e?.message ?? String(e) });
    return new Response(
      JSON.stringify({ error: e?.message ?? "Internal server error" }),
      { status: 500, headers: jsonHeaders },
    );
  }
}, "markets-enrich-news");

// ─── Helpers ───────────────────────────────────────────────────────────

/**
 * Case-insensitive word-boundary symbol matching against the headline.
 * Skips symbols ≤ 2 chars (too common — TCS still ok at 3) and skips
 * symbols that contain only English-common words.
 */
function tagInstruments(title: string, instruments: InstrumentRow[]): string[] {
  if (!title) return [];
  const upper = title.toUpperCase();
  const matched = new Set<string>();
  for (const i of instruments) {
    const sym = i.symbol;
    if (!sym || sym.length < 3) continue;
    // Word-boundary regex; escape regex specials in symbol.
    const escaped = sym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\b`, "i");
    if (re.test(title) || re.test(upper)) {
      matched.add(sym);
    }
  }
  return [...matched];
}

/**
 * Extract a JSON array from an LLM response that may include code fences
 * or surrounding prose. Returns null if no array could be parsed.
 */
function safeParseJsonArray(text: string): unknown[] | null {
  if (!text) return null;
  // 1) Strip ```json ... ``` fences if a closing fence exists.
  let candidate = text;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    candidate = fenced[1];
  } else {
    // Gemini sometimes opens a fence without closing it (response truncated
    // at max_output_tokens). Strip the opener and try parsing anyway.
    candidate = candidate.replace(/^\s*```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  }
  // 2) Find the outermost [ … ]. If the closing ] is missing, try to
  //    truncate to the last complete object so we can still recover N-1 items.
  const start = candidate.indexOf("[");
  if (start === -1) return null;
  let end = candidate.lastIndexOf("]");
  if (end <= start) {
    // No closing bracket — find the last "}," and synthesize a closer.
    const lastObjEnd = candidate.lastIndexOf("}");
    if (lastObjEnd > start) {
      candidate = candidate.slice(0, lastObjEnd + 1) + "]";
      end = candidate.length - 1;
    } else {
      return null;
    }
  }
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

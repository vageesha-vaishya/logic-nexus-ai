/**
 * Markets domain types — frontend mirror of the Postgres schema in `markets.*`.
 * Per ADR-001 (schema isolation) and §6.2 of the design doc.
 *
 * Kept locally inside the feature so the markets domain owns its own types;
 * not exported from src/types/supabase.ts to avoid coupling all consumers
 * to markets-specific tables.
 */

export type PortfolioMode = "paper" | "live";

export interface Portfolio {
  id: string;
  name: string;
  description: string | null;
  mode: PortfolioMode;
  base_currency: string;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreatePortfolioInput {
  name: string;
  description?: string | null;
  mode?: PortfolioMode;
  base_currency?: string;
}

/** Edge-function response envelope shape (markets-portfolios). */
export interface PortfoliosListResponse {
  data: Portfolio[];
  count: number;
}

export interface PortfolioMutationResponse {
  data: Portfolio;
}

export interface MarketsApiErrorBody {
  error: string;
  reason?: string;
  code?: string;
}

// ─── LLM provider configs (per-tenant API key management) ──────────────

export type LlmProviderKind =
  | "anthropic"
  | "openai"
  | "openrouter"
  | "gemini"
  | "local-qwen"
  | "custom";

export interface LlmProviderConfig {
  id: string;
  tenant_id: string;
  provider: LlmProviderKind;
  display_name: string;
  base_url: string | null;
  default_model: string;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
}

export interface CreateLlmConfigInput {
  provider: LlmProviderKind;
  display_name: string;
  default_model: string;
  api_key: string;
  base_url?: string | null;
  is_default?: boolean;
}

export interface UpdateLlmConfigInput {
  display_name?: string;
  default_model?: string;
  base_url?: string | null;
  is_active?: boolean;
  is_default?: boolean;
  /** If set, the existing vault entry is rotated to this new key. */
  api_key?: string;
}

// ─── Briefs (AI-generated portfolio analyses) ───────────────────────────

export interface BriefSource {
  title: string;
  url: string | null;
  ts: string;
  source: string;
}

export interface Brief {
  id: string;
  ts: string;
  title: string | null;
  body: string;                            // Markdown
  sources: BriefSource[] | null;
  llm_provider: string | null;
  llm_model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  metadata: Record<string, unknown> | null;
}

// ─── News events ─────────────────────────────────────────────────────────

export interface NewsEvent {
  id: string;
  ts: string;                              // ISO timestamp
  source: string;                          // 'moneycontrol' | 'moneycontrol_business' | ...
  title: string;
  body: string | null;
  instruments: string[] | null;            // NSE/BSE symbols tagged by markets-enrich-news
  sentiment_score: number | null;          // -1..1, set by LLM Gateway via markets-enrich-news
  raw_url: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ─── Watchlists ────────────────────────────────────────────────────────

export interface Instrument {
  id: string;
  symbol: string;
  exchange: string;
  isin: string | null;
  instrument_type: string;                 // 'equity' | 'index' | 'futures' | 'option' | etc.
}

export interface Watchlist {
  id: string;
  name: string;
  is_default: boolean;
  metadata: Record<string, unknown> | null;
  item_count: number;
  created_at: string;
  updated_at: string;
}

export interface WatchlistItem {
  id: string;
  instrument_id: string;
  note: string | null;
  added_at: string;
  instrument: Instrument | null;           // joined; may be null if instrument deleted
}

export interface WatchlistDetail extends Watchlist {
  items: WatchlistItem[];
}

export interface CreateWatchlistInput {
  name: string;
  is_default?: boolean;
}

export interface UpdateWatchlistInput {
  name?: string;
  is_default?: boolean;
}

export interface AddWatchlistItemInput {
  instrument_id: string;
  note?: string;
}

// ─── Holdings + NAV ────────────────────────────────────────────────────

export interface Holding {
  id: string;
  instrument_id: string;
  qty: number;
  avg_cost: number;
  realized_pnl: number;
  last_updated_at: string;
  instrument: Instrument | null;
}

export interface HoldingWithPrice extends Holding {
  last_price: number | null;
  prev_price: number | null;
}

export interface PortfolioHoldingsResult {
  holdings: HoldingWithPrice[];
  nav: number;
  todayPnl: number;
  sinceInceptionPct: number;
}

export interface InstrumentDetail {
  instrument: Instrument & {
    lot_size: number | null;
    tick_size: number | null;
    expiry: string | null;
    strike: number | null;
    metadata: Record<string, unknown> | null;
    is_active: boolean;
    created_at: string;
  };
  on_watchlists: Array<{
    watchlist_id: string;
    watchlist_name: string;
    is_default: boolean;
    item_id: string;
    note: string | null;
    added_at: string;
  }>;
  news: Array<{
    id: string;
    ts: string;
    source: string;
    title: string;
    sentiment_score: number | null;
    raw_url: string | null;
    instruments: string[] | null;
  }>;
  sentiment_summary: {
    count_7d: number;
    count_scored_7d: number;
    avg_score_7d: number | null;
    count_30d: number;
  };
}

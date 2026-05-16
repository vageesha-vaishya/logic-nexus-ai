/**
 * Markets domain types — frontend mirror of the Postgres schema in `markets.*`.
 * Per ADR-001 (schema isolation) and §6.2 of the design doc.
 *
 * Kept locally inside the feature so the markets domain owns its own types;
 * not exported from src/types/supabase.ts to avoid coupling all consumers
 * to markets-specific tables.
 */

export type PortfolioMode = "paper" | "live";
export type PortfolioHolderType = "individual" | "huf" | "corporate" | "joint" | "self_directed";

export interface Portfolio {
  id: string;
  name: string;
  description: string | null;
  mode: PortfolioMode;
  base_currency: string;
  holder_type: PortfolioHolderType;
  contact_id: string | null;
  account_id: string | null;
  managed_by: string | null;
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
  holder_type?: PortfolioHolderType;
  contact_id?: string | null;
  account_id?: string | null;
}

// Contact + account search result used in portfolio creation picker
export interface CrmContactSearchResult {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  account_id: string;
  account_name: string;
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

// ─── Asset classes ────────────────────────────────────────────────────
export type AssetClass =
  | "equity"
  | "mutual_fund"
  | "commodity"
  | "forex"
  | "fixed_income"
  | "derivative"
  | "reit"
  | "cash"
  | "other";

export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  equity:        "Equity",
  mutual_fund:   "Mutual Fund",
  commodity:     "Commodity",
  forex:         "Forex / Currency",
  fixed_income:  "Fixed Income / Bond",
  derivative:    "Derivative (F&O)",
  reit:          "REIT / InvIT",
  cash:          "Cash / FD",
  other:         "Other",
};

// ─── Transactions ──────────────────────────────────────────────────────
export type TransactionType =
  | "buy" | "sell"
  | "sip" | "redemption"
  | "dividend" | "interest"
  | "bonus" | "split"
  | "transfer_in" | "transfer_out"
  | "fd_deposit" | "fd_maturity"
  | "fee" | "adjustment";

export const TXN_TYPE_LABELS: Record<TransactionType, string> = {
  buy:          "Buy",
  sell:         "Sell",
  sip:          "SIP (MF)",
  redemption:   "Redemption (MF)",
  dividend:     "Dividend",
  interest:     "Interest",
  bonus:        "Bonus Issue",
  split:        "Stock Split",
  transfer_in:  "Transfer In",
  transfer_out: "Transfer Out",
  fd_deposit:   "FD Deposit",
  fd_maturity:  "FD Maturity",
  fee:          "Fee / Charge",
  adjustment:   "Adjustment",
};

// Types that require an instrument
export const TXN_TYPES_NEED_INSTRUMENT: TransactionType[] = [
  "buy","sell","sip","redemption","dividend","bonus","split","transfer_in","transfer_out",
];

export interface Transaction {
  id: string;
  portfolio_id: string;
  instrument_id: string | null;
  txn_type: TransactionType;
  txn_date: string;
  settlement_date: string | null;
  qty: number;
  price: number;
  charges: number;
  net_amount: number | null;
  currency: string;
  fx_rate: number;
  asset_class: AssetClass | null;
  notes: string | null;
  source: "manual" | "import" | "broker_api" | "cas_import";
  reference_id: string | null;
  folio_number: string | null;
  owner_user_id: string;
  tenant_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  // joined
  instrument?: {
    symbol: string;
    exchange: string;
    instrument_type: string;
    asset_class: string | null;
    currency_code: string | null;
  } | null;
}

export interface CreateTransactionInput {
  portfolio_id: string;
  instrument_id?: string | null;
  txn_type: TransactionType;
  txn_date: string;
  qty: number;
  price: number;
  charges?: number;
  currency?: string;
  asset_class?: AssetClass | null;
  notes?: string | null;
  folio_number?: string | null;
  reference_id?: string | null;
}

export interface TransactionsListResponse {
  data: Transaction[];
  count: number;
}

// ─── Research threads ─────────────────────────────────────────────────────

export type ResearchContextType = "portfolio" | "watchlist" | "instrument" | "sector" | "general";
export type ResearchThreadStatus = "active" | "archived";

export interface ResearchThread {
  id:              string;
  title:           string;
  status:          ResearchThreadStatus;
  context_type:    ResearchContextType | null;
  context_ref_id:  string | null;
  message_count:   number;
  last_message_at: string | null;
  created_at:      string;
  updated_at:      string;
}

export interface ResearchMessage {
  id:            string;
  role:          "user" | "assistant";
  content:       string;
  citations:     Array<{ url: string; title: string; snippet?: string }> | null;
  sequence_num:  number | null;
  is_error:      boolean;
  llm_model:     string | null;
  input_tokens:  number | null;
  output_tokens: number | null;
  cost_usd:      number | null;
  created_at:    string;
}

export interface CreateThreadInput {
  title?:          string;
  context_type?:   ResearchContextType;
  context_ref_id?: string;
}

export interface SendMessageInput {
  thread_id: string;
  content:   string;
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

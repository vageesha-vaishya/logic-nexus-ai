/**
 * Markets domain query-key factory — per ADR-025 §3.
 *
 * Convention: [domain, entity, ...filters?]
 * Always use the factory; never write string literals at the call site.
 * Invalidation patterns then become typed and grep-safe:
 *   queryClient.invalidateQueries({ queryKey: marketsKeys.portfolios.all() })
 *   queryClient.invalidateQueries({ queryKey: marketsKeys.portfolios.detail(id) })
 */

export const marketsKeys = {
  all: ["markets"] as const,

  portfolios: {
    all: () => [...marketsKeys.all, "portfolios"] as const,
    list: (filters?: { tenantId?: string | null }) =>
      [...marketsKeys.portfolios.all(), "list", filters ?? {}] as const,
    detail: (id: string) =>
      [...marketsKeys.portfolios.all(), "detail", id] as const,
  },

  watchlists: {
    all: () => [...marketsKeys.all, "watchlists"] as const,
    list: (filters?: { tenantId?: string | null }) =>
      [...marketsKeys.watchlists.all(), "list", filters ?? {}] as const,
    detail: (id: string) =>
      [...marketsKeys.watchlists.all(), "detail", id] as const,
  },

  instruments: {
    all: () => [...marketsKeys.all, "instruments"] as const,
    list: (filters?: { exchange?: string; type?: string }) =>
      [...marketsKeys.instruments.all(), "list", filters ?? {}] as const,
    detail: (id: string) =>
      [...marketsKeys.instruments.all(), "detail", id] as const,
  },

  briefs: {
    all: () => [...marketsKeys.all, "briefs"] as const,
    list: (filters?: { ownerUserId?: string; scope?: string }) =>
      [...marketsKeys.briefs.all(), "list", filters ?? {}] as const,
    detail: (id: string) =>
      [...marketsKeys.briefs.all(), "detail", id] as const,
  },

  news: {
    all: () => [...marketsKeys.all, "news"] as const,
    list: (filters?: { instrument?: string; limit?: number }) =>
      [...marketsKeys.news.all(), "list", filters ?? {}] as const,
    detail: (id: string) =>
      [...marketsKeys.news.all(), "detail", id] as const,
  },

  threads: {
    all:      () => [...marketsKeys.all, "threads"] as const,
    list:     (filters?: { status?: string }) =>
      [...marketsKeys.threads.all(), "list", filters ?? {}] as const,
    detail:   (id: string) =>
      [...marketsKeys.threads.all(), "detail", id] as const,
    messages: (threadId: string) =>
      [...marketsKeys.threads.all(), "messages", threadId] as const,
  },

  signals: {
    all:     () => [...marketsKeys.all, "signals"] as const,
    list:    (filters?: { portfolioId?: string | null; limit?: number }) =>
      [...marketsKeys.signals.all(), "list", filters ?? {}] as const,
    summary: (symbols: string[], exchange: string) =>
      [...marketsKeys.signals.all(), "summary", [...symbols].sort().join(","), exchange] as const,
    scanner: (filters: string[], match: string, exchange: string) =>
      [...marketsKeys.signals.all(), "scanner", [...filters].sort().join(","), match, exchange] as const,
  },

  strategies: {
    all:    () => [...marketsKeys.all, "strategies"] as const,
    list:   () => [...marketsKeys.strategies.all(), "list"] as const,
    detail: (id: string) => [...marketsKeys.strategies.all(), "detail", id] as const,
  },

  brokers: {
    all:         () => [...marketsKeys.all, "brokers"] as const,
    supported:   () => [...marketsKeys.brokers.all(), "supported"] as const,
    connections: () => [...marketsKeys.brokers.all(), "connections"] as const,
    connection:  (id: string) => [...marketsKeys.brokers.connections(), id] as const,
    holdings:    (connectionId: string) => [...marketsKeys.brokers.connection(connectionId), "holdings"] as const,
    positions:   (connectionId: string) => [...marketsKeys.brokers.connection(connectionId), "positions"] as const,
    orders:      (connectionId: string) => [...marketsKeys.brokers.connection(connectionId), "orders"] as const,
    gtts:        (connectionId: string) => [...marketsKeys.brokers.connection(connectionId), "gtts"] as const,
  },

  fno: {
    all:         () => [...marketsKeys.all, "fno"] as const,
    underlyings: () => [...marketsKeys.fno.all(), "underlyings"] as const,
    chain: (symbol: string, expiry: string) =>
      [...marketsKeys.fno.all(), "chain", symbol, expiry] as const,
  },

  mf: {
    all:          () => [...marketsKeys.all, "mf"] as const,
    funds:        (q: string, category: string) => [...marketsKeys.mf.all(), "funds", q, category] as const,
    fund:         (code: string) => [...marketsKeys.mf.all(), "fund", code] as const,
    portfolio:    () => [...marketsKeys.mf.all(), "portfolio"] as const,
    sips:         () => [...marketsKeys.mf.all(), "sips"] as const,
    sipSchedules: () => [...marketsKeys.mf.all(), "sip-schedules"] as const,
  },

  chart: {
    all:  () => [...marketsKeys.all, "chart"] as const,
    data: (symbol: string, exchange: string, interval: string, lookback: number) =>
      [...marketsKeys.chart.all(), symbol, exchange, interval, lookback] as const,
  },

  ltp: {
    all: () => [...marketsKeys.all, "ltp"] as const,
    batch: (symbols: string[], exchange: string) =>
      [...marketsKeys.ltp.all(), "batch", [...symbols].sort().join(","), exchange] as const,
  },

  backtests: {
    all:    () => [...marketsKeys.all, "backtests"] as const,
    list:   (filters?: { strategyId?: string | null }) =>
      [...marketsKeys.backtests.all(), "list", filters ?? {}] as const,
    detail: (id: string) => [...marketsKeys.backtests.all(), "detail", id] as const,
  },

  paper: {
    all:     () => [...marketsKeys.all, "paper"] as const,
    capital: (portfolioId: string) => [...marketsKeys.paper.all(), "capital", portfolioId] as const,
  },

  rebalancing: {
    all:    () => [...marketsKeys.all, "rebalancing"] as const,
    rules:  (portfolioId: string) => [...marketsKeys.rebalancing.all(), "rules", portfolioId] as const,
    alerts: (portfolioId: string) => [...marketsKeys.rebalancing.all(), "alerts", portfolioId] as const,
  },

  options: {
    all:       () => [...marketsKeys.all, "options"] as const,
    positions: (portfolioId: string) =>
      [...marketsKeys.options.all(), "positions", portfolioId] as const,
  },

  journal: {
    all:   () => [...marketsKeys.all, "journal"] as const,
    list:  (filters?: { symbol?: string; portfolioId?: string; outcome?: string; tags?: string[] }) =>
      [...marketsKeys.journal.all(), "list", filters ?? {}] as const,
    stats: (userId: string) => [...marketsKeys.journal.all(), "stats", userId] as const,
  },

  retail: {
    all:     () => [...marketsKeys.all, "retail"] as const,
    profile: () => [...marketsKeys.all, "retail", "profile"] as const,
    tiers:   () => [...marketsKeys.all, "retail", "tiers"] as const,
    signals: (f?: object) => [...marketsKeys.all, "retail", "signals", f ?? {}] as const,
    behavioral: {
      stress: () => [...marketsKeys.all, "retail", "behavioral", "stress"] as const,
      events: () => [...marketsKeys.all, "retail", "behavioral", "events"] as const,
    },
    autonomous: {
      progress:   () => [...marketsKeys.retail.all(), 'autonomous', 'progress'] as const,
      rules:      () => [...marketsKeys.retail.all(), 'autonomous', 'rules'] as const,
      audit:      () => [...marketsKeys.retail.all(), 'autonomous', 'audit'] as const,
      killSwitch: () => [...marketsKeys.retail.all(), 'autonomous', 'kill-switch'] as const,
    },
    community: {
      baskets:    () => [...marketsKeys.retail.all(), 'community', 'baskets'] as const,
      basket:     (id: string) => [...marketsKeys.retail.all(), 'community', 'basket', id] as const,
      strategies: () => [...marketsKeys.retail.all(), 'community', 'strategies'] as const,
      creator:    () => [...marketsKeys.retail.all(), 'community', 'creator'] as const,
    },
  },
} as const;

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
    all:  () => [...marketsKeys.all, "signals"] as const,
    list: (filters?: { portfolioId?: string | null; limit?: number }) =>
      [...marketsKeys.signals.all(), "list", filters ?? {}] as const,
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
  },

  fno: {
    all:         () => [...marketsKeys.all, "fno"] as const,
    underlyings: () => [...marketsKeys.fno.all(), "underlyings"] as const,
    chain: (symbol: string, expiry: string) =>
      [...marketsKeys.fno.all(), "chain", symbol, expiry] as const,
  },

  mf: {
    all:       () => [...marketsKeys.all, "mf"] as const,
    funds:     (q: string, category: string) => [...marketsKeys.mf.all(), "funds", q, category] as const,
    fund:      (code: string) => [...marketsKeys.mf.all(), "fund", code] as const,
    portfolio: () => [...marketsKeys.mf.all(), "portfolio"] as const,
    sips:      () => [...marketsKeys.mf.all(), "sips"] as const,
  },

  backtests: {
    all:    () => [...marketsKeys.all, "backtests"] as const,
    list:   (filters?: { strategyId?: string | null }) =>
      [...marketsKeys.backtests.all(), "list", filters ?? {}] as const,
    detail: (id: string) => [...marketsKeys.backtests.all(), "detail", id] as const,
  },
} as const;

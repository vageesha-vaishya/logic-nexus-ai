// Markets domain — barrel.
// Per ADR-001 (schema isolation) and ADR-025 (feature-folder organization).

export * from "./types";
export { marketsKeys } from "./hooks/queryKeys";
export { usePortfolios, useCreatePortfolio } from "./hooks/usePortfolios";
export { usePortfolio } from "./hooks/usePortfolio";
export { useBriefs, useGenerateBrief } from "./hooks/useBriefs";
export { useNewsEvents } from "./hooks/useNewsEvents";
export { NewsPanel } from "./components/NewsPanel";
export {
  useLlmConfigs,
  useSaveLlmConfig,
  useDeleteLlmConfig,
  defaultModelFor,
} from "./hooks/useLlmConfigs";
export {
  useWatchlists,
  useWatchlist,
  useCreateWatchlist,
  useUpdateWatchlist,
  useDeleteWatchlist,
  useAddWatchlistItem,
  useRemoveWatchlistItem,
  useInstrumentSearch,
  useInstrumentDetail,
} from "./hooks/useWatchlists";

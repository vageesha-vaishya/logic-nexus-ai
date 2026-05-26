/**
 * useActivePortfolio — picks "which portfolio is the current page looking at"
 * for users who own more than one. Persists the choice in localStorage so
 * the same portfolio is selected across page reloads.
 *
 * Behaviour:
 *   - On first read (or if the stored id is no longer in the user's
 *     portfolio list), falls back to portfolios[0] silently.
 *   - setActivePortfolioId(id) writes through to localStorage AND updates
 *     React state so consumers re-render.
 *   - Storage key is hashed by user id so two accounts on the same device
 *     don't bleed selection.
 *
 * Pages that show "the user's portfolio" (terminal PortfolioPanel, retail
 * pages, etc.) should call this instead of `portfolios?.[0]` so users with
 * multiple portfolios can switch between them. Pair with
 * <ActivePortfolioPicker /> for the actual dropdown UI.
 */
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import type { Portfolio } from "../types";

import { usePortfolios } from "./usePortfolios";

const STORAGE_PREFIX = "markets.activePortfolioId.";

function storageKey(userId: string | null | undefined): string {
  return `${STORAGE_PREFIX}${userId ?? "anon"}`;
}

function readStored(userId: string | null | undefined): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(storageKey(userId));
  } catch {
    return null;
  }
}

function writeStored(userId: string | null | undefined, id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(storageKey(userId), id);
    else    window.localStorage.removeItem(storageKey(userId));
  } catch {
    // Quota / disabled — ignore. Selection just won't persist this session.
  }
}

export interface UseActivePortfolioResult {
  portfolios:           Portfolio[];
  activePortfolioId:    string | null;
  activePortfolio:      Portfolio | null;
  setActivePortfolioId: (id: string | null) => void;
  isLoading:            boolean;
  hasMultiple:          boolean;
}

export function useActivePortfolio(): UseActivePortfolioResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const portfoliosQuery = usePortfolios();
  const portfolios = useMemo(() => portfoliosQuery.data ?? [], [portfoliosQuery.data]);

  const [activeId, setActiveId] = useState<string | null>(() => readStored(userId));

  // If the active id is missing from the portfolios list (deleted by user,
  // RLS removed access, fresh login), fall back to portfolios[0] but don't
  // persist that fallback — let the user explicitly pick or stay on the
  // first one. Persist only on explicit setActivePortfolioId.
  const resolvedId = useMemo(() => {
    if (activeId && portfolios.some((p) => p.id === activeId)) return activeId;
    return portfolios[0]?.id ?? null;
  }, [activeId, portfolios]);

  // Re-read storage when the user changes (e.g. after sign-in completes
  // and useAuth's user populates). One-shot per userId.
  useEffect(() => {
    const stored = readStored(userId);
    setActiveId(stored);
  }, [userId]);

  const setActivePortfolioId = useCallback(
    (id: string | null) => {
      setActiveId(id);
      writeStored(userId, id);
    },
    [userId],
  );

  const activePortfolio = useMemo(
    () => portfolios.find((p) => p.id === resolvedId) ?? null,
    [portfolios, resolvedId],
  );

  return {
    portfolios,
    activePortfolioId: resolvedId,
    activePortfolio,
    setActivePortfolioId,
    isLoading: portfoliosQuery.isLoading,
    hasMultiple: portfolios.length > 1,
  };
}

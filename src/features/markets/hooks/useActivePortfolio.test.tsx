/**
 * useActivePortfolio unit tests.
 *
 * Covers the multi-portfolio user paths that the new hook is designed for:
 *   • Returns null when the user has no portfolios
 *   • Defaults to portfolios[0] when nothing is stored
 *   • Honours a stored id when it points to an existing portfolio
 *   • Falls back to portfolios[0] when the stored id is stale (deleted)
 *   • Persists the choice via setActivePortfolioId
 *   • Scopes storage by userId so two accounts on one device don't bleed
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import type { Portfolio } from "../types";

let mockUserId: string | null = "user-A";
let mockPortfolios: Portfolio[] = [];

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mockUserId ? { id: mockUserId } : null }),
}));

vi.mock("./usePortfolios", () => ({
  usePortfolios: () => ({ data: mockPortfolios, isLoading: false }),
}));

import { useActivePortfolio } from "./useActivePortfolio";

function mkPortfolio(id: string, name: string): Portfolio {
  return {
    id,
    name,
    description: null,
    mode: "live",
    base_currency: "INR",
    holder_type: "self_directed",
    owner_user_id: mockUserId,
    tenant_id: "t",
    franchise_id: "f",
    account_id: null,
    managed_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as unknown as Portfolio;
}

beforeEach(() => {
  window.localStorage.clear();
  mockUserId = "user-A";
  mockPortfolios = [];
});

describe("useActivePortfolio", () => {
  it("returns null active when the user has no portfolios", () => {
    const { result } = renderHook(() => useActivePortfolio());
    expect(result.current.activePortfolio).toBeNull();
    expect(result.current.activePortfolioId).toBeNull();
    expect(result.current.hasMultiple).toBe(false);
  });

  it("defaults to portfolios[0] when nothing is stored", () => {
    mockPortfolios = [mkPortfolio("p1", "Core"), mkPortfolio("p2", "Experimental")];
    const { result } = renderHook(() => useActivePortfolio());
    expect(result.current.activePortfolioId).toBe("p1");
    expect(result.current.activePortfolio?.name).toBe("Core");
    expect(result.current.hasMultiple).toBe(true);
  });

  it("honours a stored id when it points at an existing portfolio", () => {
    window.localStorage.setItem("markets.activePortfolioId.user-A", "p2");
    mockPortfolios = [mkPortfolio("p1", "Core"), mkPortfolio("p2", "Experimental")];
    const { result } = renderHook(() => useActivePortfolio());
    expect(result.current.activePortfolioId).toBe("p2");
    expect(result.current.activePortfolio?.name).toBe("Experimental");
  });

  it("falls back to portfolios[0] when the stored id is no longer in the list", () => {
    window.localStorage.setItem("markets.activePortfolioId.user-A", "p-deleted");
    mockPortfolios = [mkPortfolio("p1", "Core")];
    const { result } = renderHook(() => useActivePortfolio());
    expect(result.current.activePortfolioId).toBe("p1");
  });

  it("persists the choice via setActivePortfolioId", () => {
    mockPortfolios = [mkPortfolio("p1", "Core"), mkPortfolio("p2", "Experimental")];
    const { result } = renderHook(() => useActivePortfolio());

    act(() => result.current.setActivePortfolioId("p2"));
    expect(result.current.activePortfolioId).toBe("p2");
    expect(window.localStorage.getItem("markets.activePortfolioId.user-A")).toBe("p2");
  });

  it("scopes storage per userId so two accounts on one device don't bleed", () => {
    window.localStorage.setItem("markets.activePortfolioId.user-A", "p1");
    window.localStorage.setItem("markets.activePortfolioId.user-B", "p2");
    mockPortfolios = [mkPortfolio("p1", "A's"), mkPortfolio("p2", "B's")];

    mockUserId = "user-A";
    const { result: a } = renderHook(() => useActivePortfolio());
    expect(a.current.activePortfolioId).toBe("p1");

    mockUserId = "user-B";
    const { result: b } = renderHook(() => useActivePortfolio());
    expect(b.current.activePortfolioId).toBe("p2");
  });
});

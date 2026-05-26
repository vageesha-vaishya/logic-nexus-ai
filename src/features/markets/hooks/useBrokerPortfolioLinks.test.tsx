/**
 * useBrokerPortfolioLinks unit tests — pin the CRUD shape that
 * RoutingRulesSheet relies on.
 *
 * Tests the public surface only: list (returns active links),
 * create (writes sync_filter.segments + weight 1.0 + is_active true),
 * delete (by id), setDefault (updates broker_connections.portfolio_id).
 * Cache-invalidation paths are exercised via the React Query client.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    roles: [{ tenant_id: "t1", franchise_id: "f1" }],
    user: { id: "user-A" },
  }),
}));

// Shared captures across the supabase mock.
const insertCaptured: any[] = [];
const deleteCaptured: any[] = [];
const updateCaptured: any[] = [];
let listRows: any[] = [];

vi.mock("@/integrations/supabase/client", () => {
  function makeBuilder(table: string) {
    const builder: any = { table };
    builder.select = vi.fn((..._args: any[]) => builder);
    builder.eq = vi.fn((..._args: any[]) => builder);
    builder.order = vi.fn((..._args: any[]) => Promise.resolve({ data: listRows, error: null }));
    builder.insert = vi.fn((row: any) => {
      insertCaptured.push(row);
      const after: any = {
        select: () => ({
          single: () =>
            Promise.resolve({
              data: { ...row, id: "new-link-id", created_at: "now", updated_at: "now" },
              error: null,
            }),
        }),
      };
      return after;
    });
    builder.delete = vi.fn(() => ({
      eq: (col: string, val: string) => {
        deleteCaptured.push({ table, col, val });
        return Promise.resolve({ data: null, error: null });
      },
    }));
    builder.update = vi.fn((patch: any) => ({
      eq: (col: string, val: string) => {
        updateCaptured.push({ table, patch, col, val });
        return Promise.resolve({ data: null, error: null });
      },
    }));
    return builder;
  }
  const supabase: any = {
    schema: () => ({ from: (table: string) => makeBuilder(table) }),
  };
  return { supabase };
});

import {
  useBrokerPortfolioLinks,
  useCreateBrokerPortfolioLink,
  useDeleteBrokerPortfolioLink,
  useSetDefaultPortfolio,
} from "./useBrokerPortfolioLinks";

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  insertCaptured.length = 0;
  deleteCaptured.length = 0;
  updateCaptured.length = 0;
  listRows = [];
});

describe("useBrokerPortfolioLinks", () => {
  it("lists active links for the connection", async () => {
    listRows = [
      { id: "l1", broker_connection_id: "c1", portfolio_id: "p2",
        sync_filter: { segments: ["fno"] }, is_active: true, weight: 1,
        owner_user_id: "user-A", tenant_id: "t1", franchise_id: "f1",
        created_at: "now", updated_at: "now" },
    ];
    const { result } = renderHook(() => useBrokerPortfolioLinks("c1"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].sync_filter?.segments).toEqual(["fno"]);
  });

  it("is disabled when connectionId is undefined", async () => {
    const { result } = renderHook(() => useBrokerPortfolioLinks(undefined), { wrapper: wrapper() });
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });
});

describe("useCreateBrokerPortfolioLink", () => {
  it("writes sync_filter.segments + weight 1.0 + is_active true", async () => {
    const { result } = renderHook(() => useCreateBrokerPortfolioLink(), { wrapper: wrapper() });
    await act(async () => {
      await result.current.mutateAsync({
        broker_connection_id: "c1",
        portfolio_id:         "p-fno",
        segments:             ["fno"],
      });
    });
    expect(insertCaptured).toHaveLength(1);
    const row = insertCaptured[0];
    expect(row.broker_connection_id).toBe("c1");
    expect(row.portfolio_id).toBe("p-fno");
    expect(row.sync_filter).toEqual({ segments: ["fno"] });
    expect(row.weight).toBe(1.0);
    expect(row.is_active).toBe(true);
    expect(row.owner_user_id).toBe("user-A");
    expect(row.tenant_id).toBe("t1");
    expect(row.franchise_id).toBe("f1");
  });

  it("supports multi-segment rules", async () => {
    const { result } = renderHook(() => useCreateBrokerPortfolioLink(), { wrapper: wrapper() });
    await act(async () => {
      await result.current.mutateAsync({
        broker_connection_id: "c1",
        portfolio_id:         "p-deriv",
        segments:             ["fno", "currency"],
      });
    });
    expect(insertCaptured[0].sync_filter).toEqual({ segments: ["fno", "currency"] });
  });
});

describe("useDeleteBrokerPortfolioLink", () => {
  it("deletes by id", async () => {
    const { result } = renderHook(() => useDeleteBrokerPortfolioLink(), { wrapper: wrapper() });
    await act(async () => {
      await result.current.mutateAsync({ id: "l1", broker_connection_id: "c1" });
    });
    expect(deleteCaptured).toEqual([
      { table: "broker_portfolio_links", col: "id", val: "l1" },
    ]);
  });
});

describe("useSetDefaultPortfolio", () => {
  it("updates broker_connections.portfolio_id by connection id", async () => {
    const { result } = renderHook(() => useSetDefaultPortfolio(), { wrapper: wrapper() });
    await act(async () => {
      await result.current.mutateAsync({
        broker_connection_id: "c1",
        portfolio_id:         "p-new-default",
      });
    });
    expect(updateCaptured).toEqual([
      {
        table: "broker_connections",
        patch: { portfolio_id: "p-new-default" },
        col:   "id",
        val:   "c1",
      },
    ]);
  });
});

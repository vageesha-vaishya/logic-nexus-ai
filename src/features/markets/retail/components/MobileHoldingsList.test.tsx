/**
 * MobileHoldingsList unit tests — pin the multi-broker UX:
 *   • Empty state renders helpful prompt.
 *   • Single-source row collapses to a simple card (no "N brokers" chip).
 *   • Multi-source row shows the "N brokers" chip + per-broker rows on expand.
 *   • Broker labels resolve via useBrokerConnections; unknown ids fall back gracefully.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";

import type { AggregatedHolding, BrokerConnection } from "../../types";
// Note: BrokerConnection lives in the broker hook file, not in types. Re-import:
// We mock useBrokerConnections directly so the type import is decorative.

const mockConnections: BrokerConnection[] = [
  {
    id: "conn-zerodha", broker: "zerodha", display_name: "Zerodha — main",
    broker_client_id: "ZX1", status: "active", portfolio_id: "p1",
    segments: ["equity"], can_trade: true, can_read_holdings: true,
    can_read_positions: true, token_expires_at: null, last_synced_at: null,
    error_message: null, created_at: "now",
  } as unknown as BrokerConnection,
  {
    id: "conn-groww", broker: "groww", display_name: "Groww — beta",
    broker_client_id: "GR1", status: "active", portfolio_id: "p1",
    segments: ["equity"], can_trade: false, can_read_holdings: true,
    can_read_positions: true, token_expires_at: null, last_synced_at: null,
    error_message: null, created_at: "now",
  } as unknown as BrokerConnection,
];

vi.mock("../../hooks/useBrokerConnections", () => ({
  useBrokerConnections: () => ({ data: mockConnections }),
}));

import { MobileHoldingsList } from "./MobileHoldingsList";

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

function mkHolding(over: Partial<AggregatedHolding> = {}): AggregatedHolding {
  const base: AggregatedHolding = {
    id: "h1",
    instrument_id: "i1",
    qty: 10,
    avg_cost: 2500,
    realized_pnl: 0,
    last_updated_at: "2026-05-26T00:00:00Z",
    instrument: { symbol: "RELIANCE", exchange: "NSE" } as any,
    last_price: 2600,
    prev_price: 2580,
    broker_connection_id: "conn-zerodha",
    source_count: 1,
    sources: [
      { id: "h1", instrument_id: "i1", qty: 10, avg_cost: 2500,
        realized_pnl: 0, last_updated_at: "2026-05-26T00:00:00Z",
        instrument: null, last_price: 2600, prev_price: 2580,
        broker_connection_id: "conn-zerodha" },
    ],
  };
  return { ...base, ...over };
}

describe("MobileHoldingsList", () => {
  it("renders an empty-state when given zero holdings", () => {
    render(<MobileHoldingsList holdings={[]} />, { wrapper: wrapper() });
    expect(screen.getByText(/no holdings yet/i)).toBeInTheDocument();
  });

  it("renders a single-source card without the N-brokers chip", () => {
    render(<MobileHoldingsList holdings={[mkHolding()]} />, { wrapper: wrapper() });
    expect(screen.getByText("RELIANCE")).toBeInTheDocument();
    expect(screen.queryByText(/brokers$/i)).not.toBeInTheDocument();
  });

  it("renders multi-source chip and per-broker rows on expand", () => {
    const multi = mkHolding({
      qty: 20,
      avg_cost: 2550,
      source_count: 2,
      sources: [
        { id: "h1a", instrument_id: "i1", qty: 10, avg_cost: 2500,
          realized_pnl: 0, last_updated_at: "2026-05-26T00:00:00Z",
          instrument: null, last_price: 2600, prev_price: 2580,
          broker_connection_id: "conn-zerodha" },
        { id: "h1b", instrument_id: "i1", qty: 10, avg_cost: 2600,
          realized_pnl: 0, last_updated_at: "2026-05-26T00:00:00Z",
          instrument: null, last_price: 2600, prev_price: 2580,
          broker_connection_id: "conn-groww" },
      ],
    });
    render(<MobileHoldingsList holdings={[multi]} />, { wrapper: wrapper() });

    // Chip
    expect(screen.getByText(/2 brokers/i)).toBeInTheDocument();

    // Expand
    fireEvent.click(screen.getByRole("button", { expanded: false }));

    // Both broker labels resolve
    expect(screen.getByText("Zerodha — main")).toBeInTheDocument();
    expect(screen.getByText("Groww — beta")).toBeInTheDocument();
  });

  it("falls back to a truncated id when broker_connection_id is unknown", () => {
    const orphan = mkHolding({
      source_count: 2,
      sources: [
        { id: "h1a", instrument_id: "i1", qty: 5, avg_cost: 2500,
          realized_pnl: 0, last_updated_at: "2026-05-26T00:00:00Z",
          instrument: null, last_price: 2600, prev_price: 2580,
          broker_connection_id: "unknown-uuid-9999" },
        { id: "h1b", instrument_id: "i1", qty: 5, avg_cost: 2500,
          realized_pnl: 0, last_updated_at: "2026-05-26T00:00:00Z",
          instrument: null, last_price: 2600, prev_price: 2580,
          broker_connection_id: null },
      ],
    });
    render(<MobileHoldingsList holdings={[orphan]} />, { wrapper: wrapper() });
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByText(/unknown-/)).toBeInTheDocument();
    expect(screen.getByText(/Manual entry/i)).toBeInTheDocument();
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

import { RebalanceCard } from "./RebalanceCard";
import type {
  RebalanceRecommendation,
} from "../hooks/useRebalanceRecommendation";

const stubRec: RebalanceRecommendation = {
  id:           "rec-1",
  user_id:      "u-1",
  generated_at: "2026-05-19T10:00:00Z",
  expires_at:   "2026-05-26T10:00:00Z",
  status:       "pending",
  executed_at:  null,
  confirm_method: null,
  created_at:   "2026-05-19T10:00:00Z",
  updated_at:   "2026-05-19T10:00:00Z",
  payload: {
    reason: "Tier 2 is 15% (target 35%); tier 1 is 80% (target 55%).",
    orders: [
      { action: "buy",  symbol: "NIFTYBEES", name: "Nifty 50 ETF", tier_to: 2,   amount_inr: 12500, exchange: "NSE" },
      { action: "sell", symbol: null,        name: "Trim tier 1",  tier_from: 1, amount_inr: 12500 },
    ],
    net_cash_impact:     0,
    estimated_brokerage: 40,
    drifts: [
      { tier_number: 1, target_pct: 55, actual_pct: 80, drift_pct:  25 },
      { tier_number: 2, target_pct: 35, actual_pct: 15, drift_pct: -20 },
      { tier_number: 3, target_pct: 10, actual_pct:  5, drift_pct:  -5 },
    ],
    threshold_pct: 5,
  },
};

const mockHook = vi.hoisted(() => ({
  data: undefined as RebalanceRecommendation | null | undefined,
  isLoading: false,
}));

vi.mock("../hooks/useRebalanceRecommendation", async () => {
  const actual = await vi.importActual<
    typeof import("../hooks/useRebalanceRecommendation")
  >("../hooks/useRebalanceRecommendation");
  return {
    ...actual,
    usePendingRebalance: () => mockHook,
    useDismissRebalance: () => ({ mutate: vi.fn(), isPending: false }),
    useExecuteRebalance: () => ({ mutate: vi.fn(), isPending: false }),
  };
});

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <RebalanceCard />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("RebalanceCard", () => {
  it("renders nothing while the pending query is loading", () => {
    mockHook.data = undefined;
    mockHook.isLoading = true;
    const { container } = render(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient()}>
          <RebalanceCard />
        </QueryClientProvider>
      </MemoryRouter>,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when there's no pending recommendation", () => {
    mockHook.data = null;
    mockHook.isLoading = false;
    const { container } = render(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient()}>
          <RebalanceCard />
        </QueryClientProvider>
      </MemoryRouter>,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the reason + order counts + brokerage when a rec is pending", () => {
    mockHook.data = stubRec;
    mockHook.isLoading = false;
    renderCard();
    expect(screen.getByText(/time to rebalance/i)).toBeInTheDocument();
    expect(screen.getByText(stubRec.payload.reason)).toBeInTheDocument();
    expect(screen.getByText(/1 buy/i)).toBeInTheDocument();
    expect(screen.getByText(/1 sell/i)).toBeInTheDocument();
    expect(screen.getByText(/~₹40 brokerage/i)).toBeInTheDocument();
  });

  it("opens the RebalanceSheet on Review & confirm click", () => {
    mockHook.data = stubRec;
    mockHook.isLoading = false;
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /review and confirm/i }));
    // Sheet content renders the same orders — assert the underlying primitive
    // produced the second instance of the reason text.
    expect(screen.getAllByText(stubRec.payload.reason).length).toBeGreaterThan(1);
    expect(screen.getByText(/proposed orders/i)).toBeInTheDocument();
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

import { RiskScoreCard } from "./RiskScoreCard";
import type {
  RiskScoreComponents,
  RiskScoreResponse,
} from "../hooks/useRiskScore";

const stubComponents: RiskScoreComponents = {
  concentration_score: 4.2,
  tier_skew_score:     2.1,
  drawdown_score:      1.0,
  beta_score:          5.0,
  weights: { concentration: 0.3, tier_skew: 0.3, drawdown: 0.2, beta: 0.2 },
};

function stubResponse(score: number, target: number): RiskScoreResponse {
  return {
    current: {
      score,
      target_score: target,
      components:   stubComponents,
      computed_at:  "2026-05-19T10:00:00Z",
    },
    history: [],
  };
}

// vi.hoisted lets us mutate the mock return per-test without re-mocking.
const mockState = vi.hoisted(() => ({
  data: undefined as RiskScoreResponse | undefined,
  isLoading: false,
  isError:   false,
  error:     null as Error | null,
}));

vi.mock("../hooks/useRiskScore", () => ({
  useRiskScore: () => mockState,
}));

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <RiskScoreCard />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("RiskScoreCard", () => {
  it("shows a loading state while fetching", () => {
    mockState.data = undefined;
    mockState.isLoading = true;
    mockState.isError = false;
    mockState.error = null;
    renderCard();
    expect(screen.getByText(/computing your risk score/i)).toBeInTheDocument();
  });

  it("renders the score, band, and target when on-plan", () => {
    mockState.data = stubResponse(5.8, 6.0);
    mockState.isLoading = false;
    mockState.isError = false;
    mockState.error = null;
    renderCard();
    expect(screen.getByText("5.8")).toBeInTheDocument();
    expect(screen.getByText(/Moderate/i)).toBeInTheDocument();
    expect(screen.getByText(/Target 6\.0/)).toBeInTheDocument();
    // On-plan → no "How to fix this" CTA
    expect(screen.queryByText(/how to fix this/i)).toBeNull();
  });

  it("upgrades to elevated state when delta > 2 and shows the rebalance CTA", () => {
    // current 9.0, target 6.0 → delta = +3.0 → elevated
    mockState.data = stubResponse(9.0, 6.0);
    mockState.isLoading = false;
    mockState.isError = false;
    mockState.error = null;
    renderCard();
    expect(screen.getByText("9.0")).toBeInTheDocument();
    const cta = screen.getByRole("link", { name: /how to fix this/i });
    expect(cta).toHaveAttribute("href", "/dashboard/markets/retail/portfolio");
    expect(screen.getByText(/\+3\.0 vs plan/i)).toBeInTheDocument();
  });

  it("returns null on 412 (onboarding not complete) so the dashboard stays clean", () => {
    mockState.data = undefined;
    mockState.isLoading = false;
    mockState.isError = true;
    mockState.error = new Error("risk-score: 412 — Risk profile not set");
    const { container } = renderCard();
    expect(container.firstChild).toBeNull();
  });

  it("renders a destructive message on other errors", () => {
    mockState.data = undefined;
    mockState.isLoading = false;
    mockState.isError = true;
    mockState.error = new Error("risk-score: 500 — boom");
    renderCard();
    expect(screen.getByText(/couldn.?t load risk score/i)).toBeInTheDocument();
  });
});

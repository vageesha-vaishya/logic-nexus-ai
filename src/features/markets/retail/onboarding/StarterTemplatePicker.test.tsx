import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { StarterTemplatePicker } from "./StarterTemplatePicker";
import type { PortfolioTemplate } from "../hooks/useStarterTemplates";

// Stub out the hook so we don't hit Supabase from a unit test.
const mockTemplates: PortfolioTemplate[] = [
  {
    id: "1",
    slug: "conservative",
    display_name: "Conservative",
    description: "Capital preservation first. 70/25/5.",
    risk_tag: "conservative",
    is_active: true,
    display_order: 10,
    created_at: "",
    updated_at: "",
    tier_allocations: [
      { tier_number: 1, weight_pct: 70, focus: "", suggested_holdings: [] },
      { tier_number: 2, weight_pct: 25, focus: "", suggested_holdings: [] },
      { tier_number: 3, weight_pct: 5,  focus: "", suggested_holdings: [] },
    ],
  },
  {
    id: "2",
    slug: "balanced",
    display_name: "Balanced",
    description: "55/35/10.",
    risk_tag: "moderate",
    is_active: true,
    display_order: 20,
    created_at: "",
    updated_at: "",
    tier_allocations: [
      { tier_number: 1, weight_pct: 55, focus: "", suggested_holdings: [] },
      { tier_number: 2, weight_pct: 35, focus: "", suggested_holdings: [] },
      { tier_number: 3, weight_pct: 10, focus: "", suggested_holdings: [] },
    ],
  },
];

vi.mock("../hooks/useStarterTemplates", async () => {
  const actual = await vi.importActual<
    typeof import("../hooks/useStarterTemplates")
  >("../hooks/useStarterTemplates");
  return {
    ...actual,
    useStarterTemplates: () => ({
      data: mockTemplates,
      isLoading: false,
      isError: false,
    }),
  };
});

function renderPicker(onApply = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <StarterTemplatePicker onApply={onApply} />
    </QueryClientProvider>,
  );
  return { onApply };
}

describe("StarterTemplatePicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts collapsed and expands when the CTA is clicked", () => {
    renderPicker();
    expect(screen.getByText(/not sure where to start/i)).toBeInTheDocument();
    expect(screen.queryByText("Conservative")).toBeNull();
    fireEvent.click(screen.getByText(/not sure where to start/i));
    expect(screen.getByText("Conservative")).toBeInTheDocument();
    expect(screen.getByText("Balanced")).toBeInTheDocument();
  });

  it("disables template cards until a budget is entered", () => {
    renderPicker();
    fireEvent.click(screen.getByText(/not sure where to start/i));
    const conservativeCard = screen.getByRole("button", { name: /conservative/i });
    expect(conservativeCard).toBeDisabled();
  });

  it("calls onApply with the per-tier split when a template is chosen", () => {
    const { onApply } = renderPicker();
    fireEvent.click(screen.getByText(/not sure where to start/i));

    const budgetInput = screen.getByLabelText(/total to invest/i);
    fireEvent.change(budgetInput, { target: { value: "500000" } });

    const conservativeCard = screen.getByRole("button", { name: /conservative/i });
    fireEvent.click(conservativeCard);

    expect(onApply).toHaveBeenCalledTimes(1);
    const [allocations, template] = onApply.mock.calls[0];
    expect(template.slug).toBe("conservative");
    expect(allocations).toEqual([
      { tier_number: 1, target_amount: 350_000 },
      { tier_number: 2, target_amount: 125_000 },
      { tier_number: 3, target_amount:  25_000 },
    ]);
  });
});

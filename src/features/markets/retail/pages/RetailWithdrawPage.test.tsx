import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

import RetailWithdrawPage from "./RetailWithdrawPage";

// Stub the data hooks so the page renders deterministically.
vi.mock("../../hooks/usePortfolios", () => ({
  usePortfolios: () => ({
    data: [
      { id: "p1", name: "Long-term core", description: null, currency: "INR" },
    ],
  }),
}));

const mockBrokers = vi.hoisted(() => ({
  data: [] as Array<{
    id: string;
    display_name: string;
    status: string;
    broker_client_id: string;
  }>,
}));

vi.mock("../../hooks/useBrokerConnections", () => ({
  useBrokerConnections: () => mockBrokers,
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <RetailWithdrawPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("RetailWithdrawPage", () => {
  it("renders the header + back-to-More affordance", () => {
    mockBrokers.data = [];
    renderPage();
    expect(screen.getByRole("heading", { name: /^withdraw$/i })).toBeInTheDocument();
    const back = screen.getByRole("link", { name: /back to more/i });
    expect(back).toHaveAttribute("href", "/dashboard/markets/retail/more");
  });

  it("shows 'connect a broker' state when no broker connection exists", () => {
    mockBrokers.data = [];
    renderPage();
    expect(screen.getByText(/no broker connected/i)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /connect a broker/i });
    expect(link).toHaveAttribute("href", "/dashboard/markets/settings/brokers");
  });

  it("surfaces the active broker name + client id when connected", () => {
    mockBrokers.data = [
      {
        id:               "c1",
        display_name:     "Zerodha — main",
        status:           "active",
        broker_client_id: "ZAA123",
      },
    ];
    renderPage();
    expect(screen.getByText("Zerodha — main")).toBeInTheDocument();
    expect(screen.getByText(/ZAA123/)).toBeInTheDocument();
  });

  it("updates the net-received summary live as the amount changes", () => {
    mockBrokers.data = [];
    renderPage();
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. 100000/i), { target: { value: "100000" } });
    // No gain entered, equity, default 1 yr held → net = amount (no tax, no exit load).
    expect(screen.getByText("₹1,00,000")).toBeInTheDocument();
  });

  it("applies STCG tax estimate when holding period < 1 year and a gain is entered", () => {
    mockBrokers.data = [];
    renderPage();
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. 100000/i), { target: { value: "100000" } });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. 1\.5/i),   { target: { value: "0.5" } });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. 20000/i),  { target: { value: "20000" } });
    // STCG = 20% × ₹20k = ₹4k. Net = ₹96k.
    expect(screen.getByText(/STCG @ 20% = ₹4,000/i)).toBeInTheDocument();
    expect(screen.getByText("₹96,000")).toBeInTheDocument();
  });
});

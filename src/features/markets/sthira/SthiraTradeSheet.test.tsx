import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/lib/biometric", () => ({
  requireBiometric: vi.fn(),
}));
vi.mock("@/features/markets/hooks/useBrokerConnections", () => ({
  useBrokerConnections: vi.fn(),
}));
vi.mock("@/features/markets/hooks/useBrokerPortfolio", () => ({
  usePlaceOrder: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { requireBiometric } from "@/lib/biometric";
import { useBrokerConnections } from "@/features/markets/hooks/useBrokerConnections";
import { usePlaceOrder } from "@/features/markets/hooks/useBrokerPortfolio";
import { SthiraTradeSheet } from "./SthiraTradeSheet";

const tradeBroker = {
  id: "conn-1",
  status: "active" as const,
  can_trade: true,
  display_name: "Sarvesh Groww Account",
};

const renderSheet = () =>
  render(<SthiraTradeSheet open onClose={() => undefined} />);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useBrokerConnections).mockReturnValue({ data: [tradeBroker] } as any);
});

describe("SthiraTradeSheet", () => {
  it("renders the broker routing line and an inactive submit button by default", () => {
    vi.mocked(usePlaceOrder).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    renderSheet();
    expect(screen.getByText(/Routing via Sarvesh Groww Account/i)).toBeInTheDocument();
    // Empty symbol + zero qty → cancel-pair primary button is disabled.
    const buttons = screen.getAllByRole("button", { name: /BUY/ });
    const submit = buttons.find((b) => (b as HTMLButtonElement).disabled);
    expect(submit).toBeDefined();
  });

  it("submits a market BUY order via biometric gate", async () => {
    const placeOrderMock = vi.fn().mockResolvedValue({ order_id: "ORD-1", status: "open" });
    vi.mocked(usePlaceOrder).mockReturnValue({
      mutateAsync: placeOrderMock,
      isPending: false,
    } as any);
    vi.mocked(requireBiometric).mockResolvedValue({ ok: true, method: "biometric" });

    renderSheet();
    fireEvent.change(screen.getByLabelText(/Symbol/i), { target: { value: "hdfcbank" } });
    fireEvent.change(screen.getByLabelText(/Quantity/i), { target: { value: "5" } });

    // Submit button label includes the side + uppercased symbol.
    const submit = await screen.findByRole("button", { name: /BUY HDFCBANK/i });
    fireEvent.click(submit);

    await waitFor(() => expect(placeOrderMock).toHaveBeenCalledTimes(1));
    expect(placeOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tradingsymbol:    "HDFCBANK",
        transaction_type: "BUY",
        order_type:       "MARKET",
        product:          "CNC",
        quantity:         5,
        exchange:         "NSE",
        validity:         "DAY",
      }),
    );
  });

  it("blocks submission and shows error when biometric fails", async () => {
    const placeOrderMock = vi.fn();
    vi.mocked(usePlaceOrder).mockReturnValue({
      mutateAsync: placeOrderMock,
      isPending: false,
    } as any);
    vi.mocked(requireBiometric).mockResolvedValue({
      ok: false,
      reason: "userCancel",
      message: "Authentication cancelled",
    });

    renderSheet();
    fireEvent.change(screen.getByLabelText(/Symbol/i), { target: { value: "INFY" } });
    fireEvent.change(screen.getByLabelText(/Quantity/i), { target: { value: "1" } });

    fireEvent.click(await screen.findByRole("button", { name: /BUY INFY/i }));

    await waitFor(() =>
      expect(screen.getByText(/Authentication cancelled/i)).toBeInTheDocument(),
    );
    expect(placeOrderMock).not.toHaveBeenCalled();
  });

  it("warns when no active trade-enabled broker exists", () => {
    vi.mocked(useBrokerConnections).mockReturnValue({ data: [] } as any);
    vi.mocked(usePlaceOrder).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    renderSheet();
    expect(screen.getByText(/No active broker/i)).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { RebalanceSheet } from "./RebalanceSheet";
import type {
  RebalanceRecommendation,
} from "../hooks/useRebalanceRecommendation";

// The Confirm button calls into the biometric wrapper. In jsdom Capacitor
// reports platform="web", so the wrapper would already short-circuit to
// ok=true / method='web' — but we mock the module to keep this test
// independent of @capacitor/core's runtime detection.
const requireBiometricMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/biometric", () => ({
  requireBiometric: requireBiometricMock,
}));

const stubRec: RebalanceRecommendation = {
  id:           "rec-2",
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

const dismissMock = vi.fn();
const executeMock = vi.fn();

vi.mock("../hooks/useRebalanceRecommendation", async () => {
  const actual = await vi.importActual<
    typeof import("../hooks/useRebalanceRecommendation")
  >("../hooks/useRebalanceRecommendation");
  return {
    ...actual,
    useDismissRebalance: (opts?: { onSuccess?: () => void }) => ({
      mutate: (id: string, ev?: { onError?: (e: Error) => void }) => {
        dismissMock(id, ev);
        opts?.onSuccess?.();
      },
      isPending: false,
    }),
    useExecuteRebalance: (opts?: { onSuccess?: () => void }) => ({
      mutate: (
        input: { recId: string; confirmMethod?: string },
        ev?: { onError?: (e: Error) => void },
      ) => {
        executeMock(input, ev);
        opts?.onSuccess?.();
      },
      isPending: false,
    }),
  };
});

function renderSheet(open = true) {
  const onOpenChange = vi.fn();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <RebalanceSheet
        recommendation={stubRec}
        open={open}
        onOpenChange={onOpenChange}
      />
    </QueryClientProvider>,
  );
  return { onOpenChange };
}

describe("RebalanceSheet", () => {
  beforeEach(() => {
    dismissMock.mockClear();
    executeMock.mockClear();
    requireBiometricMock.mockReset();
    // Default: biometric passes through as on web.
    requireBiometricMock.mockResolvedValue({ ok: true, method: "web" });
  });

  it("renders nothing when recommendation is null", () => {
    const qc = new QueryClient();
    const { container } = render(
      <QueryClientProvider client={qc}>
        <RebalanceSheet recommendation={null} open onOpenChange={vi.fn()} />
      </QueryClientProvider>,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders orders, brokerage, and drift table", () => {
    renderSheet();
    expect(screen.getByText(/proposed orders \(2\)/i)).toBeInTheDocument();
    expect(screen.getByText("NIFTYBEES")).toBeInTheDocument();
    expect(screen.getByText(/^₹40$/)).toBeInTheDocument();    // brokerage
    expect(screen.getByText(/^\+25\.0%$/)).toBeInTheDocument(); // drift row tier 1
  });

  it("dispatches dismiss mutation on Not now click", () => {
    const { onOpenChange } = renderSheet();
    fireEvent.click(screen.getByRole("button", { name: /not now/i }));
    expect(dismissMock).toHaveBeenCalledWith(stubRec.id, expect.anything());
    // onOpenChange(false) fires via the hook's onSuccess wrapper.
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("dispatches execute mutation with confirm_method=web on Confirm click (web platform)", async () => {
    const { onOpenChange } = renderSheet();
    fireEvent.click(screen.getByRole("button", { name: /confirm rebalance/i }));
    await waitFor(() => {
      expect(executeMock).toHaveBeenCalledWith(
        { recId: stubRec.id, confirmMethod: "web" },
        expect.anything(),
      );
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("records confirm_method=biometric when the OS biometric prompt resolves", async () => {
    requireBiometricMock.mockResolvedValueOnce({ ok: true, method: "biometric" });
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: /confirm rebalance/i }));
    await waitFor(() => {
      expect(executeMock).toHaveBeenCalledWith(
        { recId: stubRec.id, confirmMethod: "biometric" },
        expect.anything(),
      );
    });
  });

  it("does NOT execute the mutation when biometric is cancelled by the user", async () => {
    requireBiometricMock.mockResolvedValueOnce({
      ok: false,
      reason: "userCancel",
      message: "cancelled",
    });
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: /confirm rebalance/i }));
    await waitFor(() => expect(requireBiometricMock).toHaveBeenCalled());
    expect(executeMock).not.toHaveBeenCalled();
  });
});

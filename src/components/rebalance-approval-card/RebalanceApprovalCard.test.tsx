import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  RebalanceApprovalCard,
  type RebalanceDiff,
} from "./RebalanceApprovalCard";

const baseRebalance: RebalanceDiff = {
  from: [
    { id: "equity", label: "Equity", percent: 60 },
    { id: "debt", label: "Debt", percent: 30 },
    { id: "gold", label: "Gold", percent: 10 },
  ],
  to: [
    { id: "equity", label: "Equity", percent: 55 },
    { id: "debt", label: "Debt", percent: 35 },
    { id: "gold", label: "Gold", percent: 10 },
  ],
  reason:
    "Your equity weighting has drifted 5% above your target band. Bringing it back in line keeps your risk inside what you signed off on.",
};

describe("RebalanceApprovalCard", () => {
  it("renders the plain-language reason", () => {
    render(
      <RebalanceApprovalCard
        rebalance={baseRebalance}
        onApprove={() => {}}
        onDeny={() => {}}
      />,
    );
    expect(screen.getByText(/drifted 5% above/)).toBeInTheDocument();
  });

  it("renders only the lines that actually changed, sorted by biggest delta", () => {
    render(
      <RebalanceApprovalCard
        rebalance={baseRebalance}
        onApprove={() => {}}
        onDeny={() => {}}
      />,
    );
    const card = screen.getByTestId("rebalance-approval-card");
    // Equity and Debt changed (5% each); Gold stayed put and should not appear in the diff list
    expect(card.textContent).toContain("Equity");
    expect(card.textContent).toContain("Debt");
    // Gold is unchanged so should be filtered out of the diff
    expect(card.textContent).not.toContain("Gold");
  });

  it("formats deltas with sign and one decimal", () => {
    render(
      <RebalanceApprovalCard
        rebalance={baseRebalance}
        onApprove={() => {}}
        onDeny={() => {}}
      />,
    );
    expect(screen.getByText("-5.0")).toBeInTheDocument();
    expect(screen.getByText("+5.0")).toBeInTheDocument();
  });

  it("shows an auto-approve countdown when autoApproveAt is set", () => {
    const future = new Date(Date.now() + 48 * 60 * 60 * 1000); // +48h
    render(
      <RebalanceApprovalCard
        rebalance={{ ...baseRebalance, autoApproveAt: future }}
        onApprove={() => {}}
        onDeny={() => {}}
      />,
    );
    expect(screen.getByText(/Auto-approves in/)).toBeInTheDocument();
  });

  it("hides the auto-approve line when no autoApproveAt is set", () => {
    render(
      <RebalanceApprovalCard
        rebalance={baseRebalance}
        onApprove={() => {}}
        onDeny={() => {}}
      />,
    );
    expect(screen.queryByText(/Auto-approves in/)).toBeNull();
  });

  it("calls onApprove / onDeny / onPause when the corresponding buttons are clicked", async () => {
    const onApprove = vi.fn();
    const onDeny = vi.fn();
    const onPause = vi.fn();
    render(
      <RebalanceApprovalCard
        rebalance={baseRebalance}
        onApprove={onApprove}
        onDeny={onDeny}
        onPause={onPause}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Approve now" }));
    await userEvent.click(screen.getByRole("button", { name: "Deny" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Pause this cycle" }),
    );
    expect(onApprove).toHaveBeenCalledTimes(1);
    expect(onDeny).toHaveBeenCalledTimes(1);
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it("disables all CTAs when busy", () => {
    render(
      <RebalanceApprovalCard
        rebalance={baseRebalance}
        onApprove={() => {}}
        onDeny={() => {}}
        onPause={() => {}}
        busy
      />,
    );
    expect(screen.getByRole("button", { name: "Approve now" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Deny" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Pause this cycle" }),
    ).toBeDisabled();
  });

  it("renders an empty-state line when from === to", () => {
    const noOp: RebalanceDiff = {
      ...baseRebalance,
      to: baseRebalance.from,
    };
    render(
      <RebalanceApprovalCard
        rebalance={noOp}
        onApprove={() => {}}
        onDeny={() => {}}
      />,
    );
    expect(screen.getByText("No allocation changes.")).toBeInTheDocument();
  });
});

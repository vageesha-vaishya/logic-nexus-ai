import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  RebalanceApprovalCard,
  type RebalanceDiff,
} from "./RebalanceApprovalCard";

const meta: Meta<typeof RebalanceApprovalCard> = {
  title: "Platform/RebalanceApprovalCard",
  component: RebalanceApprovalCard,
  parameters: { a11y: { disable: false }, layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof RebalanceApprovalCard>;

const driftRebalance: RebalanceDiff = {
  from: [
    { id: "equity", label: "Equity (Nifty 50 ETF)", percent: 65 },
    { id: "debt", label: "Debt (Liquid + Gilt)", percent: 25 },
    { id: "gold", label: "Gold ETF", percent: 10 },
  ],
  to: [
    { id: "equity", label: "Equity (Nifty 50 ETF)", percent: 60 },
    { id: "debt", label: "Debt (Liquid + Gilt)", percent: 30 },
    { id: "gold", label: "Gold ETF", percent: 10 },
  ],
  reason:
    "Equity has drifted to 65% — 5% above your target band. Trimming equity back to 60% keeps your portfolio inside the risk profile you signed off on.",
  autoApproveAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
};

export const DriftRebalance: Story = {
  render: () => (
    <RebalanceApprovalCard
      rebalance={driftRebalance}
      onApprove={() => alert("Approve")}
      onDeny={() => alert("Deny")}
      onPause={() => alert("Pause this cycle")}
    />
  ),
};

export const NoAutoApprove: Story = {
  render: () => (
    <RebalanceApprovalCard
      rebalance={{ ...driftRebalance, autoApproveAt: null }}
      onApprove={() => alert("Approve")}
      onDeny={() => alert("Deny")}
    />
  ),
};

export const Busy: Story = {
  render: () => (
    <RebalanceApprovalCard
      rebalance={driftRebalance}
      onApprove={() => {}}
      onDeny={() => {}}
      onPause={() => {}}
      busy
    />
  ),
};

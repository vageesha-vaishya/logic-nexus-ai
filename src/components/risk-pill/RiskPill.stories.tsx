import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter } from "react-router-dom";
import { RiskPill } from "./RiskPill";

const meta: Meta<typeof RiskPill> = {
  title: "Platform/RiskPill",
  component: RiskPill,
  parameters: { a11y: { disable: false }, layout: "centered" },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof RiskPill>;

export const AllLevels: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <RiskPill risk="low" />
      <RiskPill risk="medium" />
      <RiskPill risk="high" />
    </div>
  ),
};

export const Small: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <RiskPill risk="low" size="sm" />
      <RiskPill risk="medium" size="sm" />
      <RiskPill risk="high" size="sm" />
    </div>
  ),
};

export const InFundCard: Story = {
  render: () => (
    <div className="w-72 rounded-lg border p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold">Index 50 ETF</p>
          <p className="text-xs text-muted-foreground">Nifty 50 tracking · 0.08% expense</p>
        </div>
        <RiskPill risk="medium" size="sm" />
      </div>
      <p className="mt-3 text-sm">
        3Y returns: <span className="font-semibold">14.2%</span>
        <span className="text-muted-foreground"> · Past performance does not guarantee future returns</span>
      </p>
    </div>
  ),
};

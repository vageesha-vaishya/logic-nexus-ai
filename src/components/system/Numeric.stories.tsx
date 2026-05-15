import type { Meta, StoryObj } from "@storybook/react-vite";
import { Numeric } from "./Numeric";

const meta: Meta<typeof Numeric> = {
  title: "System/Numeric",
  component: Numeric,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  argTypes: {
    format: {
      control: "select",
      options: ["currency", "pnl", "percent", "integer", "decimal"],
    },
    colorBySign: { control: "boolean" },
    withArrow: { control: "boolean" },
    compact: { control: "boolean" },
    showSign: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Numeric>;

export const Currency: Story = {
  args: { value: 1234567.89, format: "currency" },
};

export const CurrencyCompactLakhCrore: Story = {
  args: { value: 12_345_678, format: "currency", compact: true },
};

export const Percent: Story = {
  args: { value: 0.0234, format: "percent", colorBySign: true, withArrow: true },
};

export const PercentNegative: Story = {
  args: { value: -0.0512, format: "percent", colorBySign: true, withArrow: true },
};

export const PnLPositive: Story = {
  args: { value: 1234.5, format: "pnl", colorBySign: true, withArrow: true },
};

export const PnLNegative: Story = {
  args: { value: -89.2, format: "pnl", colorBySign: true, withArrow: true },
};

export const Integer: Story = {
  args: { value: 1234567, format: "integer" },
};

export const Decimal: Story = {
  args: { value: 1234.567, format: "decimal", maximumFractionDigits: 4 },
};

export const Null: Story = {
  args: { value: null, format: "currency", placeholder: "—" },
};

export const Grid: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <div>NAV</div>
      <Numeric value={1_23_456.78} format="currency" />
      <div>Today P&amp;L</div>
      <Numeric value={1234.5} format="pnl" colorBySign withArrow />
      <div>Today % change</div>
      <Numeric value={0.0234} format="percent" colorBySign withArrow />
      <div>YTD return</div>
      <Numeric value={-0.0812} format="percent" colorBySign withArrow />
      <div>Holdings count</div>
      <Numeric value={47} format="integer" />
      <div>Compact (crore)</div>
      <Numeric value={1.23e9} format="currency" compact />
      <div>Null state</div>
      <Numeric value={null} />
    </div>
  ),
};

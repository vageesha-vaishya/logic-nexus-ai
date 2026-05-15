import type { Meta, StoryObj } from "@storybook/react-vite";
import { Sparkline } from "./Sparkline";

const meta: Meta<typeof Sparkline> = {
  title: "System/Sparkline",
  component: Sparkline,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Sparkline>;

const uptrend = Array.from({ length: 30 }).map(
  (_, i) => 100 + i * 1.2 + Math.sin(i * 0.7) * 3,
);
const downtrend = Array.from({ length: 30 }).map(
  (_, i) => 140 - i * 1.0 + Math.sin(i * 0.5) * 2,
);
const flat = Array.from({ length: 30 }).map(
  (_, i) => 100 + Math.sin(i * 0.8) * 1.5,
);
const volatile = Array.from({ length: 30 }).map(
  (_, i) => 100 + Math.sin(i * 1.7) * 12 + Math.cos(i * 0.4) * 6,
);

export const Up: Story = {
  args: { series: uptrend },
};

export const Down: Story = {
  args: { series: downtrend },
};

export const Flat: Story = {
  args: { series: flat },
};

export const Volatile: Story = {
  args: { series: volatile },
};

export const Larger: Story = {
  args: { series: uptrend, width: 200, height: 60, strokeWidth: 2 },
};

export const NoFill: Story = {
  args: { series: uptrend, fillArea: false },
};

export const Empty: Story = {
  args: { series: [], accessibleLabel: "No data" },
};

export const Single: Story = {
  args: { series: [100] },
};

export const InWatchlistRow: Story = {
  render: () => (
    <ul className="divide-y rounded-lg border">
      {[
        { sym: "RELIANCE", series: uptrend },
        { sym: "TCS", series: downtrend },
        { sym: "HDFCBANK", series: flat },
        { sym: "INFY", series: volatile },
      ].map(({ sym, series }) => (
        <li key={sym} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <span className="font-mono">{sym}</span>
          <Sparkline series={series} accessibleLabel={`${sym} 30-day trend`} />
        </li>
      ))}
    </ul>
  ),
};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { MoneyDelta } from "./MoneyDelta";

const meta: Meta<typeof MoneyDelta> = {
  title: "System/MoneyDelta",
  component: MoneyDelta,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof MoneyDelta>;

export const Positive: Story = {
  args: { value: 1234.5 },
};

export const Negative: Story = {
  args: { value: -89.2 },
};

export const Flat: Story = {
  args: { value: 0 },
};

export const WithPercentSecondary: Story = {
  args: { value: 1234.5, secondary: 0.0234 },
};

export const NegativeWithPercent: Story = {
  args: { value: -1500, secondary: -0.0234 },
};

export const HideArrow: Story = {
  args: { value: 1234.5, secondary: 0.0234, hideArrow: true },
};

export const InTable: Story = {
  render: () => (
    <table className="w-full text-sm">
      <thead className="border-b text-left">
        <tr>
          <th className="py-2">Portfolio</th>
          <th className="py-2 text-right">Today</th>
        </tr>
      </thead>
      <tbody>
        <tr className="border-b">
          <td className="py-2">Long-only equity</td>
          <td className="py-2 text-right">
            <MoneyDelta value={1234.5} secondary={0.0234} />
          </td>
        </tr>
        <tr className="border-b">
          <td className="py-2">F&amp;O paper</td>
          <td className="py-2 text-right">
            <MoneyDelta value={-892.4} secondary={-0.0512} />
          </td>
        </tr>
        <tr>
          <td className="py-2">Balanced 60/40</td>
          <td className="py-2 text-right">
            <MoneyDelta value={0} secondary={0} />
          </td>
        </tr>
      </tbody>
    </table>
  ),
};

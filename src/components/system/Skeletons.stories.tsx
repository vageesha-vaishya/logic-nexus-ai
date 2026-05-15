import type { Meta, StoryObj } from "@storybook/react-vite";
import { SkeletonRow, SkeletonCard } from "./Skeletons";

const meta: Meta = {
  title: "System/Skeletons",
  parameters: { layout: "padded" },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj;

export const SingleRow: Story = {
  render: () => <SkeletonRow />,
};

export const RowList: Story = {
  render: () => (
    <div className="divide-y rounded-lg border">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="px-3">
          <SkeletonRow columns={5} />
        </div>
      ))}
    </div>
  ),
};

export const CompactRow: Story = {
  render: () => <SkeletonRow columns={3} size="compact" widths={["40%", "30%", "20%"]} />,
};

export const SingleCard: Story = {
  render: () => <SkeletonCard />,
};

export const CardGrid: Story = {
  render: () => (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonCard key={i} lines={4} />
      ))}
    </div>
  ),
};

export const CardNoHeader: Story = {
  render: () => <SkeletonCard withHeader={false} lines={5} />,
};

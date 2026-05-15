import type { Meta, StoryObj } from "@storybook/react-vite";
import { Inbox, Wallet, FileText } from "lucide-react";
import { EmptyState } from "./EmptyState";

const meta: Meta<typeof EmptyState> = {
  title: "System/EmptyState",
  component: EmptyState,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  args: {
    icon: <Inbox className="h-10 w-10" />,
    title: "No items yet",
    description: "Create your first item to get started.",
  },
};

export const WithPrimaryAction: Story = {
  args: {
    icon: <Wallet className="h-10 w-10" />,
    title: "No portfolios yet",
    description: "Create your first paper portfolio to start tracking.",
    actionLabel: "Create a portfolio",
    onAction: () => {},
  },
};

export const WithPrimaryAndSecondary: Story = {
  args: {
    icon: <Wallet className="h-10 w-10" />,
    title: "No portfolios yet",
    description: "Pick a template or start from scratch.",
    actionLabel: "Create from scratch",
    onAction: () => {},
    secondaryActionLabel: "Use template",
    onSecondaryAction: () => {},
  },
};

export const Compact: Story = {
  args: {
    icon: <FileText className="h-8 w-8" />,
    title: "No notes",
    description: "Inline placeholder size.",
    size: "compact",
  },
};

export const WithIllustration: Story = {
  args: {
    illustration: (
      <svg viewBox="0 0 120 80" className="h-20 w-auto text-muted-foreground/40">
        <rect x="10" y="60" width="20" height="12" rx="2" fill="currentColor" />
        <rect x="38" y="40" width="20" height="32" rx="2" fill="currentColor" />
        <rect x="66" y="20" width="20" height="52" rx="2" fill="currentColor" />
        <rect x="94" y="50" width="20" height="22" rx="2" fill="currentColor" />
      </svg>
    ),
    title: "No data to chart yet",
    description: "Once a portfolio has holdings, an allocation chart appears here.",
  },
};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { ErrorState } from "./ErrorState";

const meta: Meta<typeof ErrorState> = {
  title: "System/ErrorState",
  component: ErrorState,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof ErrorState>;

export const Basic: Story = {
  args: {
    message: "Something went wrong while loading the data.",
  },
};

export const WithTitle: Story = {
  args: {
    title: "Failed to load portfolios",
    message: "Edge Function returned a non-2xx status code.",
  },
};

export const WithCode: Story = {
  args: {
    title: "Failed to load portfolios",
    message: "Edge Function returned a non-2xx status code.",
    code: "FunctionsHttpError",
  },
};

export const WithRetry: Story = {
  args: {
    title: "Failed to load portfolios",
    message: "Network request failed.",
    code: 503,
    onRetry: () => {},
  },
};

export const WithRetryAndDocs: Story = {
  args: {
    title: "Failed to load portfolios",
    message: "Tenant does not have the markets domain enabled.",
    code: "domain_not_enabled",
    onRetry: () => {},
    learnMoreUrl: "https://docs.example.com/errors/domain-not-enabled",
  },
};

export const Warning: Story = {
  args: {
    title: "Real-time updates lagging",
    message: "Last tick was received 45 seconds ago.",
    severity: "warning",
  },
};

export const Compact: Story = {
  args: {
    message: "Failed to save",
    code: 400,
    size: "compact",
    onRetry: () => {},
  },
};

export const HiddenIcon: Story = {
  args: {
    title: "Validation failed",
    message: "Two fields need attention.",
    hideIcon: true,
    severity: "warning",
  },
};

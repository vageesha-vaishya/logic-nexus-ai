import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "@/components/ui/button";
import { SebiDisclaimer } from "./SebiDisclaimer";

const meta: Meta<typeof SebiDisclaimer> = {
  title: "Platform/SebiDisclaimer",
  component: SebiDisclaimer,
  parameters: { a11y: { disable: false }, layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof SebiDisclaimer>;

export const Default: Story = {
  render: () => <SebiDisclaimer />,
};

export const FiveSecondGate: Story = {
  render: () => (
    <SebiDisclaimer minVisibleMs={5000}>
      {({ canProceed, secondsRemaining }) => (
        <Button disabled={!canProceed}>
          {canProceed ? "Proceed to invest" : `Proceed (${secondsRemaining}s)`}
        </Button>
      )}
    </SebiDisclaimer>
  ),
};

export const Custom: Story = {
  render: () => (
    <SebiDisclaimer
      text="Sthira does not place trades on your behalf without your explicit approval. Pre-authorised drift rebalancing is the sole exception, and every event is logged."
      minVisibleMs={3000}
    >
      {({ canProceed, secondsRemaining }) => (
        <Button disabled={!canProceed} variant="secondary">
          {canProceed ? "I understand" : `I understand (${secondsRemaining}s)`}
        </Button>
      )}
    </SebiDisclaimer>
  ),
};

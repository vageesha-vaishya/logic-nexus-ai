import type { Meta, StoryObj } from "@storybook/react";
import { EntityCard } from "./EntityCard";
import { Button } from "@/components/ui/button";

const meta: Meta<typeof EntityCard> = {
  title: "System/EntityCard",
  component: EntityCard,
  parameters: {
    a11y: { disable: false },
  },
  argTypes: {
    title: { control: "text", description: "Primary title" },
    subtitle: { control: "text", description: "Secondary text" },
    meta: { control: "text", description: "Small metadata block" },
    tags: { control: "object", description: "Array of tag labels" },
    onClick: { action: "click", description: "Click handler" },
  },
};

export default meta;
type Story = StoryObj<typeof EntityCard>;

export const Basic: Story = {
  args: {
    title: "Acme Corp",
    subtitle: "Manufacturing",
    meta: "acme.com • +1 555-1111",
  },
};

export const WithTags: Story = {
  args: {
    ...Basic.args,
    tags: ["Active", "Enterprise", "Priority"],
  },
};

export const WithRightActions: Story = {
  args: {
    ...WithTags.args,
    right: <Button size="sm" variant="outline">Manage</Button>,
  },
};

export const Clickable: Story = {
  args: {
    ...WithRightActions.args,
  },
};


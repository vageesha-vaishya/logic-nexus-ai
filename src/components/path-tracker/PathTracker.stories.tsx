import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { PathTracker, type PathTrackerStage } from "./PathTracker";

const meta: Meta<typeof PathTracker> = {
  title: "Platform/PathTracker",
  component: PathTracker,
  parameters: {
    a11y: { disable: false },
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof PathTracker>;

const quotationStages: PathTrackerStage[] = [
  { id: "draft", label: "Draft" },
  {
    id: "review",
    label: "Internal Review",
    fields: [
      { label: "Owner", value: "Alice Kapoor" },
      { label: "Estimate", value: "$12,400" },
      { label: "Decision by", value: "Jun 1, 2026" },
    ],
    guidance: "Confirm margin against pricing matrix before moving to Sent.",
  },
  { id: "sent", label: "Sent to Customer" },
  { id: "negotiation", label: "Negotiation" },
  { id: "won", label: "Won" },
];

export const QuotationPipeline: Story = {
  render: () => (
    <PathTracker stages={quotationStages} currentStageId="review" />
  ),
};

export const Interactive: Story = {
  render: () => {
    const [current, setCurrent] = useState("sent");
    const completed = quotationStages
      .slice(0, quotationStages.findIndex((s) => s.id === current))
      .map((s) => s.id);
    return (
      <PathTracker
        stages={quotationStages}
        currentStageId={current}
        completedStageIds={completed}
        onStageClick={setCurrent}
      />
    );
  },
};

const woStages: PathTrackerStage[] = [
  { id: "planned", label: "Planned" },
  {
    id: "in-progress",
    label: "In Progress",
    fields: [
      { label: "Aircraft", value: "VT-ABC" },
      { label: "Hangar", value: "H2" },
      { label: "Lead AME", value: "R. Khan" },
    ],
    guidance: "All AD compliance checks logged before sign-off.",
  },
  { id: "inspection", label: "Inspection" },
  { id: "closed", label: "Closed" },
];

export const AmroWorkOrder: Story = {
  render: () => (
    <PathTracker
      stages={woStages}
      currentStageId="in-progress"
      completedStageIds={["planned"]}
    />
  ),
};

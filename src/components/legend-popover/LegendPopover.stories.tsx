import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "@/components/ui/badge";
import { UrgencyDot } from "@/components/urgency-dot";
import { LegendPopover, type LegendSection } from "./LegendPopover";

const meta: Meta<typeof LegendPopover> = {
  title: "Platform/LegendPopover",
  component: LegendPopover,
  parameters: { a11y: { disable: false }, layout: "centered" },
};

export default meta;
type Story = StoryObj<typeof LegendPopover>;

const amroSections: LegendSection[] = [
  {
    title: "Status",
    items: [
      {
        id: "planning",
        swatch: <Badge variant="outline">Planning</Badge>,
        label: "Planning",
        description: "Scoping; not yet approved",
      },
      {
        id: "in_progress",
        swatch: <Badge>In Progress</Badge>,
        label: "In Progress",
        description: "Work is actively being performed",
      },
      {
        id: "on_hold",
        swatch: <Badge variant="destructive">On Hold</Badge>,
        label: "On Hold",
        description: "Paused; awaiting parts, approval, or input",
      },
    ],
  },
  {
    title: "Priority",
    items: [
      {
        id: "p1",
        swatch: <span className="font-bold text-red-600">P1</span>,
        label: "P1 — Critical",
        description: "Aircraft on-ground; immediate action",
      },
      {
        id: "p3",
        swatch: <span className="font-bold text-yellow-600">P3</span>,
        label: "P3 — Medium",
        description: "Scheduled within the planning horizon",
      },
      {
        id: "p5",
        swatch: <span className="font-bold text-slate-500">P5</span>,
        label: "P5 — Routine",
        description: "Plan opportunistically",
      },
    ],
  },
  {
    title: "Urgency dot",
    items: [
      {
        id: "overdue",
        swatch: <UrgencyDot urgency="overdue" />,
        label: "Overdue",
        description: "Past the planned end-date",
      },
      {
        id: "today",
        swatch: <UrgencyDot urgency="today" />,
        label: "Due today",
      },
      {
        id: "upcoming",
        swatch: <UrgencyDot urgency="upcoming" />,
        label: "Upcoming",
        description: "Within the next 7 days",
      },
      {
        id: "none",
        swatch: <UrgencyDot urgency="none" />,
        label: "No date / beyond window",
      },
    ],
  },
];

export const AmroStatusPriority: Story = {
  render: () => (
    <LegendPopover sections={amroSections} triggerLabel="Status & priority" />
  ),
};

export const SingleSection: Story = {
  render: () => (
    <LegendPopover
      sections={[amroSections[2]]}
      triggerLabel="What do the dots mean?"
    />
  ),
};

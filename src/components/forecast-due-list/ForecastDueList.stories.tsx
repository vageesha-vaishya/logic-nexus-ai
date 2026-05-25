import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  ForecastDueList,
  type ForecastHorizon,
  type ForecastItem,
} from "./ForecastDueList";

const meta: Meta<typeof ForecastDueList> = {
  title: "Platform/ForecastDueList",
  component: ForecastDueList,
  parameters: { a11y: { disable: false }, layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof ForecastDueList>;

const NOW = new Date(2026, 4, 25, 10, 0, 0);

const items: ForecastItem[] = [
  {
    id: "wo-1",
    label: "WO-2026-0182 — Engine A inspection",
    sublabel: "VT-ABC · ATA 72",
    dueDate: new Date(2026, 4, 22, 10, 0, 0),
    groupKey: "VT-ABC",
    groupLabel: "VT-ABC",
    badge: <Badge variant="destructive">P1</Badge>,
  },
  {
    id: "wo-2",
    label: "WO-2026-0184 — Fuel cell check",
    sublabel: "VT-XYZ · ATA 28",
    dueDate: new Date(2026, 4, 25, 10, 0, 0),
    groupKey: "VT-XYZ",
    groupLabel: "VT-XYZ",
    badge: <Badge>P2</Badge>,
  },
  {
    id: "wo-3",
    label: "WO-2026-0191 — Avionics audit",
    sublabel: "VT-ABC · ATA 31",
    dueDate: new Date(2026, 4, 28, 10, 0, 0),
    groupKey: "VT-ABC",
    groupLabel: "VT-ABC",
    badge: <Badge variant="secondary">P3</Badge>,
  },
  {
    id: "wo-4",
    label: "WO-2026-0203 — Cabin refit",
    sublabel: "VT-XYZ · ATA 25",
    dueDate: new Date(2026, 5, 18, 10, 0, 0),
    groupKey: "VT-XYZ",
    groupLabel: "VT-XYZ",
    badge: <Badge variant="secondary">P3</Badge>,
  },
];

export const Default: Story = {
  render: () => <ForecastDueList items={items} horizon="30d" now={NOW} />,
};

export const Interactive: Story = {
  render: () => {
    const [horizon, setHorizon] = useState<ForecastHorizon>("30d");
    return (
      <ForecastDueList
        items={items}
        horizon={horizon}
        onHorizonChange={setHorizon}
        onItemClick={(item) => alert(`Open ${item.id}`)}
        now={NOW}
      />
    );
  },
};

export const GroupedByAircraft: Story = {
  render: () => (
    <ForecastDueList
      items={items}
      horizon="90d"
      groupBy="group"
      now={NOW}
    />
  ),
};

export const Empty: Story = {
  render: () => (
    <ForecastDueList
      items={[]}
      horizon="7d"
      now={NOW}
      emptyMessage="All compliance items clear for the next 7 days."
    />
  ),
};

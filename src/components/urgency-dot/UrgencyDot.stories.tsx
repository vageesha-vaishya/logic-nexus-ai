import type { Meta, StoryObj } from "@storybook/react-vite";
import { UrgencyDot, computeUrgency } from "./UrgencyDot";

const meta: Meta<typeof UrgencyDot> = {
  title: "Platform/UrgencyDot",
  component: UrgencyDot,
  parameters: { a11y: { disable: false } },
};

export default meta;
type Story = StoryObj<typeof UrgencyDot>;

export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex items-center gap-2">
        <UrgencyDot urgency="overdue" />
        <span>Overdue</span>
      </div>
      <div className="flex items-center gap-2">
        <UrgencyDot urgency="today" />
        <span>Due today</span>
      </div>
      <div className="flex items-center gap-2">
        <UrgencyDot urgency="upcoming" />
        <span>Upcoming</span>
      </div>
      <div className="flex items-center gap-2">
        <UrgencyDot urgency="none" />
        <span>No activity</span>
      </div>
    </div>
  ),
};

export const InListRows: Story = {
  render: () => {
    const rows = [
      { id: 1, name: "WO-001 — Engine inspection", due: "2026-05-20" },
      { id: 2, name: "WO-002 — Fuel cell check", due: "2026-05-25" },
      { id: 3, name: "WO-003 — Avionics audit", due: "2026-05-28" },
      { id: 4, name: "WO-004 — Cabin refit", due: null },
    ] as const;
    const now = new Date("2026-05-25T10:00:00Z");
    return (
      <table className="w-full text-sm">
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b">
              <td className="py-2 pr-3">
                <UrgencyDot urgency={computeUrgency(row.due, { now })} />
              </td>
              <td className="py-2 pr-3">{row.name}</td>
              <td className="py-2 text-muted-foreground">{row.due ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  },
};

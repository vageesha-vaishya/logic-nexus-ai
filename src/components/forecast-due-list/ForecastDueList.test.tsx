import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ForecastDueList, type ForecastItem } from "./ForecastDueList";

const NOW = new Date(2026, 4, 25, 10, 0, 0); // 2026-05-25 10:00 local

const items: ForecastItem[] = [
  {
    id: "wo-1",
    label: "WO-001 — Engine inspection",
    sublabel: "VT-ABC",
    dueDate: new Date(2026, 4, 20, 10, 0, 0), // 5d overdue
    groupKey: "72",
    groupLabel: "ATA 72 — Engine",
  },
  {
    id: "wo-2",
    label: "WO-002 — Fuel cell check",
    sublabel: "VT-XYZ",
    dueDate: new Date(2026, 4, 25, 14, 0, 0), // today
    groupKey: "28",
    groupLabel: "ATA 28 — Fuel",
  },
  {
    id: "wo-3",
    label: "WO-003 — Avionics audit",
    sublabel: "VT-ABC",
    dueDate: new Date(2026, 4, 28, 10, 0, 0), // 3d
    groupKey: "31",
    groupLabel: "ATA 31 — Avionics",
  },
  {
    id: "wo-4",
    label: "WO-004 — Cabin refit",
    sublabel: "VT-XYZ",
    dueDate: new Date(2026, 5, 30, 10, 0, 0), // ~36d
    groupKey: "25",
    groupLabel: "ATA 25 — Cabin",
  },
  {
    id: "wo-5",
    label: "WO-005 — Painting",
    sublabel: "VT-XYZ",
    dueDate: new Date(2026, 8, 15, 10, 0, 0), // ~113d
    groupKey: "11",
    groupLabel: "ATA 11 — Placards",
  },
];

describe("ForecastDueList", () => {
  it("renders only overdue + within-horizon items, sorted ascending by due-date", () => {
    render(<ForecastDueList items={items} horizon="7d" now={NOW} />);
    const labels = screen
      .getAllByText(/^WO-\d+/)
      .map((el) => el.textContent ?? "");
    expect(labels).toHaveLength(3);
    expect(labels[0]).toContain("WO-001");
    expect(labels[1]).toContain("WO-002");
    expect(labels[2]).toContain("WO-003");
  });

  it("always shows overdue items even when they pre-date the horizon window", () => {
    render(<ForecastDueList items={items} horizon="7d" now={NOW} />);
    expect(screen.getByText("WO-001 — Engine inspection")).toBeInTheDocument();
    expect(screen.getByText(/5d overdue/i)).toBeInTheDocument();
  });

  it("expands results when horizon widens", () => {
    render(<ForecastDueList items={items} horizon="90d" now={NOW} />);
    expect(screen.getByText("WO-004 — Cabin refit")).toBeInTheDocument();
    expect(screen.queryByText("WO-005 — Painting")).toBeNull();
  });

  it("respects horizon='all' and renders everything sorted", () => {
    render(<ForecastDueList items={items} horizon="all" now={NOW} />);
    expect(screen.getByText("WO-005 — Painting")).toBeInTheDocument();
  });

  it("renders group headers when groupBy='group'", () => {
    render(
      <ForecastDueList items={items} horizon="all" groupBy="group" now={NOW} />,
    );
    expect(screen.getByText(/ATA 72 — Engine/)).toBeInTheDocument();
    expect(screen.getByText(/ATA 28 — Fuel/)).toBeInTheDocument();
  });

  it("invokes onItemClick when a row is clicked", async () => {
    const onItemClick = vi.fn();
    render(
      <ForecastDueList
        items={items}
        horizon="7d"
        now={NOW}
        onItemClick={onItemClick}
      />,
    );
    await userEvent.click(screen.getByText("WO-001 — Engine inspection"));
    expect(onItemClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: "wo-1" }),
    );
  });

  it("renders the empty state when no items match the window", () => {
    render(<ForecastDueList items={[]} horizon="7d" now={NOW} />);
    expect(
      screen.getByText("Nothing coming due in this window."),
    ).toBeInTheDocument();
  });

  it("uses a custom emptyMessage when provided", () => {
    render(
      <ForecastDueList
        items={[]}
        horizon="7d"
        now={NOW}
        emptyMessage="All compliance items clear."
      />,
    );
    expect(
      screen.getByText("All compliance items clear."),
    ).toBeInTheDocument();
  });

  it("surfaces overdue count in the header", () => {
    render(<ForecastDueList items={items} horizon="30d" now={NOW} />);
    expect(screen.getByText(/1 overdue/)).toBeInTheDocument();
  });
});

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LegendPopover, type LegendSection } from "./LegendPopover";

const sections: LegendSection[] = [
  {
    title: "Status",
    items: [
      {
        id: "in_progress",
        swatch: <span data-testid="swatch-in-progress" />,
        label: "In Progress",
        description: "Work has started but is not complete",
      },
      {
        id: "on_hold",
        swatch: <span data-testid="swatch-on-hold" />,
        label: "On Hold",
      },
    ],
  },
  {
    title: "Priority",
    items: [
      {
        id: "p1",
        swatch: <span data-testid="swatch-p1" />,
        label: "P1 — Critical",
        description: "Aircraft on-ground; immediate action",
      },
    ],
  },
];

describe("LegendPopover", () => {
  it("renders the default trigger and is closed initially", () => {
    render(<LegendPopover sections={sections} />);
    expect(
      screen.getByRole("button", { name: /Legend — open guide/i }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("legend-popover")).toBeNull();
  });

  it("opens the popover on click and shows section titles + items", async () => {
    render(<LegendPopover sections={sections} />);
    await userEvent.click(
      screen.getByRole("button", { name: /Legend — open guide/i }),
    );
    expect(await screen.findByTestId("legend-popover")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Priority")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(
      screen.getByText("Work has started but is not complete"),
    ).toBeInTheDocument();
    expect(screen.getByText("P1 — Critical")).toBeInTheDocument();
  });

  it("honours a custom triggerLabel", () => {
    render(<LegendPopover sections={sections} triggerLabel="Status guide" />);
    expect(
      screen.getByRole("button", { name: /Status guide — open guide/i }),
    ).toBeInTheDocument();
  });

  it("accepts a custom trigger element", async () => {
    render(
      <LegendPopover
        sections={sections}
        trigger={<button type="button">Custom trigger</button>}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Custom trigger" }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Custom trigger" }),
    );
    expect(await screen.findByTestId("legend-popover")).toBeInTheDocument();
  });

  it("hides items without a description gracefully (no empty p element)", async () => {
    render(<LegendPopover sections={sections} />);
    await userEvent.click(
      screen.getByRole("button", { name: /Legend — open guide/i }),
    );
    const onHoldRow = await screen.findByText("On Hold");
    // "On Hold" should be present; no description paragraph should be its sibling
    const parent = onHoldRow.closest("div");
    expect(parent).not.toBeNull();
    expect(parent!.querySelectorAll("p").length).toBe(1);
  });
});

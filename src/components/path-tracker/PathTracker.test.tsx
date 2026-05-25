import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PathTracker, type PathTrackerStage } from "./PathTracker";

const stages: PathTrackerStage[] = [
  { id: "draft", label: "Draft" },
  {
    id: "review",
    label: "In Review",
    fields: [
      { label: "Owner", value: "Alice" },
      { label: "Due", value: "Jun 1" },
    ],
    guidance: "Confirm pricing with finance before moving forward.",
  },
  { id: "approved", label: "Approved" },
  { id: "won", label: "Won" },
];

describe("PathTracker", () => {
  it("marks the current stage with aria-current=step", () => {
    render(<PathTracker stages={stages} currentStageId="review" />);
    const currentLi = screen
      .getByRole("list", { name: /stage progression/i })
      .querySelector('[aria-current="step"]');
    expect(currentLi).not.toBeNull();
    expect(currentLi?.textContent).toContain("In Review");
  });

  it("renders the key-fields panel for the current stage", () => {
    render(<PathTracker stages={stages} currentStageId="review" />);
    const panel = screen.getByTestId("path-tracker-key-fields");
    expect(panel).toBeInTheDocument();
    expect(panel.textContent).toContain("Owner");
    expect(panel.textContent).toContain("Alice");
    expect(panel.textContent).toContain("Confirm pricing");
  });

  it("does not render the key-fields panel when current stage has no fields or guidance", () => {
    render(<PathTracker stages={stages} currentStageId="draft" />);
    expect(screen.queryByTestId("path-tracker-key-fields")).toBeNull();
  });

  it("invokes onStageClick when a stage is interactive and clicked", async () => {
    const onStageClick = vi.fn();
    render(
      <PathTracker
        stages={stages}
        currentStageId="review"
        onStageClick={onStageClick}
      />,
    );
    const draftButton = screen.getByRole("button", {
      name: /Stage 1 of 4: Draft/i,
    });
    await userEvent.click(draftButton);
    expect(onStageClick).toHaveBeenCalledWith("draft");
  });

  it("treats stages in completedStageIds as completed", () => {
    render(
      <PathTracker
        stages={stages}
        currentStageId="approved"
        completedStageIds={["draft", "review"]}
      />,
    );
    const draftEl = screen.getByLabelText(/Stage 1 of 4: Draft \(completed\)/i);
    expect(draftEl).toBeInTheDocument();
  });
});

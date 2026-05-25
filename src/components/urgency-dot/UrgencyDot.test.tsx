import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { UrgencyDot, computeUrgency } from "./UrgencyDot";

describe("UrgencyDot", () => {
  it("renders with a default screen-reader label per urgency state", () => {
    render(<UrgencyDot urgency="overdue" />);
    expect(screen.getByLabelText("Overdue")).toBeInTheDocument();
  });

  it("accepts a custom srLabel that overrides the default", () => {
    render(<UrgencyDot urgency="today" srLabel="Renewal due today" />);
    expect(screen.getByLabelText("Renewal due today")).toBeInTheDocument();
  });

  it("exposes the urgency via data-urgency for downstream styling/testing", () => {
    const { container } = render(<UrgencyDot urgency="upcoming" />);
    expect(
      container.querySelector('[data-urgency="upcoming"]'),
    ).not.toBeNull();
  });
});

describe("computeUrgency", () => {
  // "today" is computed against the user's LOCAL calendar day, so all
  // fixtures use the local-time Date constructor — keeps tests stable
  // regardless of the runner's TZ.
  const now = new Date(2026, 4, 25, 10, 0, 0); // 2026-05-25 10:00 local

  it("returns 'none' for null/undefined/invalid input", () => {
    expect(computeUrgency(null, { now })).toBe("none");
    expect(computeUrgency(undefined, { now })).toBe("none");
    expect(computeUrgency("not-a-date", { now })).toBe("none");
  });

  it("classifies past dates (different calendar day) as 'overdue'", () => {
    expect(computeUrgency(new Date(2026, 4, 20, 10, 0, 0), { now })).toBe(
      "overdue",
    );
  });

  it("classifies same local calendar day as 'today' regardless of hour", () => {
    expect(computeUrgency(new Date(2026, 4, 25, 8, 0, 0), { now })).toBe(
      "today",
    );
    expect(computeUrgency(new Date(2026, 4, 25, 20, 0, 0), { now })).toBe(
      "today",
    );
  });

  it("classifies within window as 'upcoming'", () => {
    expect(computeUrgency(new Date(2026, 4, 28, 10, 0, 0), { now })).toBe(
      "upcoming",
    );
  });

  it("classifies beyond window as 'none'", () => {
    expect(computeUrgency(new Date(2026, 5, 25, 10, 0, 0), { now })).toBe(
      "none",
    );
  });

  it("honours a custom upcomingWindowDays", () => {
    expect(
      computeUrgency(new Date(2026, 5, 1, 10, 0, 0), {
        now,
        upcomingWindowDays: 14,
      }),
    ).toBe("upcoming");
  });
});

import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PreviewSlideOver } from "./PreviewSlideOver";

describe("PreviewSlideOver", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders title, subtitle, and fields when open", () => {
    render(
      <PreviewSlideOver
        open
        onOpenChange={() => {}}
        title="Part PN-1234"
        subtitle="Aircraft VT-ABC"
        fields={[
          { label: "Manufacturer", value: "Honeywell" },
          { label: "Quantity", value: 3 },
        ]}
      />,
    );
    expect(screen.getByText("Part PN-1234")).toBeInTheDocument();
    expect(screen.getByText("Aircraft VT-ABC")).toBeInTheDocument();
    expect(screen.getByText("Manufacturer")).toBeInTheDocument();
    expect(screen.getByText("Honeywell")).toBeInTheDocument();
  });

  it("invokes onOpenChange when the user closes via Escape", async () => {
    const onOpenChange = vi.fn();
    render(
      <PreviewSlideOver
        open
        onOpenChange={onOpenChange}
        title="Part PN-1234"
        fields={[{ label: "Manufacturer", value: "Honeywell" }]}
      />,
    );
    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("warns in development when the field count exceeds the soft cap", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tooMany = Array.from({ length: 8 }).map((_, i) => ({
      label: `Field ${i}`,
      value: `Value ${i}`,
    }));
    render(
      <PreviewSlideOver
        open
        onOpenChange={() => {}}
        title="Oversized"
        fields={tooMany}
      />,
    );
    expect(warn).toHaveBeenCalled();
    expect(warn.mock.calls[0][0]).toContain("recommended cap is 6");
  });

  it("renders action footer when provided", () => {
    render(
      <PreviewSlideOver
        open
        onOpenChange={() => {}}
        title="Part PN-1234"
        fields={[{ label: "Manufacturer", value: "Honeywell" }]}
        actions={<button type="button">Open full record</button>}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Open full record" }),
    ).toBeInTheDocument();
  });
});

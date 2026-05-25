import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { RiskPill } from "./RiskPill";

const wrap = (ui: React.ReactNode) => (
  <MemoryRouter>{ui}</MemoryRouter>
);

describe("RiskPill", () => {
  it("renders the default label for each risk level", () => {
    render(wrap(<RiskPill risk="low" />));
    expect(screen.getByText("Low risk")).toBeInTheDocument();
  });

  it("accepts a custom label", () => {
    render(wrap(<RiskPill risk="high" label="High volatility" />));
    expect(screen.getByText("High volatility")).toBeInTheDocument();
  });

  it("exposes the level via data-risk for downstream styling", () => {
    const { container } = render(wrap(<RiskPill risk="medium" />));
    expect(container.querySelector('[data-risk="medium"]')).not.toBeNull();
  });

  it("links to the methodology page by default", () => {
    render(wrap(<RiskPill risk="low" />));
    const link = screen.getByLabelText("How is this risk calculated?");
    expect(link).toHaveAttribute("href", "/methodology/volatility");
  });

  it("honours an explicit methodologyHref", () => {
    render(
      wrap(<RiskPill risk="low" methodologyHref="/methodology/sthira-basket" />),
    );
    expect(screen.getByLabelText("How is this risk calculated?")).toHaveAttribute(
      "href",
      "/methodology/sthira-basket",
    );
  });

  it("hides the methodology link when showMethodologyLink is false", () => {
    render(wrap(<RiskPill risk="high" showMethodologyLink={false} />));
    expect(
      screen.queryByLabelText("How is this risk calculated?"),
    ).toBeNull();
  });
});

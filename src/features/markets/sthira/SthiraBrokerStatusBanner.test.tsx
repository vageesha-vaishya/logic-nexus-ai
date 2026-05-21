import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/features/markets/hooks/useBrokerConnections", () => ({
  useBrokerConnections: vi.fn(),
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: vi.fn(() => false) },
}));

import { useBrokerConnections } from "@/features/markets/hooks/useBrokerConnections";
import { SthiraBrokerStatusBanner } from "./SthiraBrokerStatusBanner";

const renderBanner = () =>
  render(
    <MemoryRouter>
      <SthiraBrokerStatusBanner />
    </MemoryRouter>,
  );

beforeEach(() => vi.clearAllMocks());

describe("SthiraBrokerStatusBanner", () => {
  it("renders nothing when all brokers are active", () => {
    vi.mocked(useBrokerConnections).mockReturnValue({
      data: [{ id: "1", broker: "groww", status: "active", display_name: "Groww" }],
    } as any);
    const { container } = renderBanner();
    expect(container.firstChild).toBeNull();
  });

  it("shows the Groww re-approve CTA when Groww is in error", () => {
    vi.mocked(useBrokerConnections).mockReturnValue({
      data: [{ id: "1", broker: "groww", status: "error", display_name: "Sarvesh Groww" }],
    } as any);
    renderBanner();
    expect(screen.getByText(/Groww needs your approval/i)).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: /Re-approve on Groww/i });
    expect(btn).toBeInTheDocument();
  });

  it("opens the Groww approve URL when the CTA is clicked", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    vi.mocked(useBrokerConnections).mockReturnValue({
      data: [{ id: "1", broker: "groww", status: "expired", display_name: "Sarvesh Groww" }],
    } as any);
    renderBanner();
    fireEvent.click(screen.getByRole("button", { name: /Re-approve on Groww/i }));
    expect(openSpy).toHaveBeenCalledWith(
      "https://groww.in/trade-api/api-keys",
      "_blank",
      "noopener,noreferrer",
    );
    openSpy.mockRestore();
  });

  it("falls back to a generic 'Reconnect' link for non-Groww errors", () => {
    vi.mocked(useBrokerConnections).mockReturnValue({
      data: [{ id: "1", broker: "zerodha", status: "error", display_name: "My Kite" }],
    } as any);
    renderBanner();
    expect(screen.getByText(/My Kite needs reconnecting/i)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Reconnect/i });
    expect(link).toHaveAttribute("href", "/dashboard/markets/settings/brokers");
  });
});

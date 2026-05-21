import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MobileShell } from "./MobileShell";

function renderAt(pathname: string, props: Parameters<typeof MobileShell>[0] = { children: <div>body</div> }) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <MobileShell {...props}>{props.children ?? <div>body</div>}</MobileShell>
    </MemoryRouter>,
  );
}

describe("MobileShell", () => {
  it("renders the page body inside the shell", () => {
    renderAt("/dashboard/markets/retail/home", { children: <div data-testid="body">hello</div> });
    expect(screen.getByTestId("body")).toHaveTextContent("hello");
  });

  it("renders all four primary tabs", () => {
    renderAt("/dashboard/markets/retail/home");
    expect(screen.getByRole("link", { name: /home/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /markets/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /goals/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /you/i })).toBeInTheDocument();
  });

  it("marks the Markets tab active when on /markets/signals", () => {
    renderAt("/dashboard/markets/signals");
    expect(screen.getByRole("link", { name: /markets/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /home/i })).not.toHaveAttribute("aria-current");
  });

  it("marks the You tab active when on /settings/profile", () => {
    renderAt("/dashboard/settings/profile");
    expect(screen.getByRole("link", { name: /you/i })).toHaveAttribute("aria-current", "page");
  });

  it("respects an explicit activeTab prop over the derived path", () => {
    renderAt("/dashboard/markets/retail/home", { children: <div />, activeTab: "goals" });
    expect(screen.getByRole("link", { name: /goals/i })).toHaveAttribute("aria-current", "page");
  });

  it("hides the Trade FAB by default", () => {
    renderAt("/dashboard/markets/signals");
    expect(screen.queryByRole("button", { name: /place a trade/i })).not.toBeInTheDocument();
  });

  it("shows the Trade FAB when showTradeFab is set and fires onTradePress", () => {
    const onTradePress = vi.fn();
    renderAt("/dashboard/markets/signals", {
      children: <div />,
      showTradeFab: true,
      onTradePress,
    });
    const fab = screen.getByRole("button", { name: /place a trade/i });
    fireEvent.click(fab);
    expect(onTradePress).toHaveBeenCalledTimes(1);
  });
});

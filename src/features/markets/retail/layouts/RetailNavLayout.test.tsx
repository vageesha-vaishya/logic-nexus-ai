import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";

import { RetailNavLayout, RETAIL_TABS } from "./RetailNavLayout";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/dashboard/markets/retail" element={<RetailNavLayout />}>
          <Route path="home"      element={<div>HOME_BODY</div>} />
          <Route path="portfolio" element={<div>PORT_BODY</div>} />
          <Route path="signals"   element={<div>SIG_BODY</div>} />
          <Route path="goals"     element={<div>GOAL_BODY</div>} />
          <Route path="more"      element={<div>MORE_BODY</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("RetailNavLayout", () => {
  it("exports exactly the 5 tabs the addendum requires, in order", () => {
    expect(RETAIL_TABS.map((t) => t.label)).toEqual([
      "Home",
      "Portfolio",
      "Signals",
      "Goals",
      "More",
    ]);
  });

  it("renders each tab as a navigation link on both mobile and desktop nav", () => {
    renderAt("/dashboard/markets/retail/home");
    // Two navs are rendered (mobile bottom + desktop sidebar); each has 5 links.
    for (const tab of RETAIL_TABS) {
      const links = screen.getAllByRole("link", { name: tab.label });
      expect(links.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("renders the matched child route inside the layout outlet", () => {
    renderAt("/dashboard/markets/retail/signals");
    expect(screen.getByText("SIG_BODY")).toBeInTheDocument();
  });

  it("applies the active NavLink class to the current tab", () => {
    renderAt("/dashboard/markets/retail/portfolio");
    // Pick the desktop sidebar link (first match). NavLink applies the
    // active class derived from the URL; we assert by checking the
    // text-primary class is on the active tab's link element.
    const links = screen.getAllByRole("link", { name: "Portfolio" });
    expect(links[0].className).toMatch(/text-primary/);
    const homeLink = screen.getAllByRole("link", { name: "Home" })[0];
    expect(homeLink.className).not.toMatch(/text-primary/);
  });
});

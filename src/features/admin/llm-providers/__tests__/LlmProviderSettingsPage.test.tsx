import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import LlmProviderSettingsPage from "../pages/LlmProviderSettingsPage";
import type { LlmProviderConfig } from "../types";

vi.mock("@/components/layout/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const tenantDefault: LlmProviderConfig = {
  id: "c1",
  tenant_id: "t1",
  provider: "anthropic",
  display_name: "Primary",
  base_url: null,
  default_model: "claude-sonnet-4-5",
  domain: null,
  is_active: true,
  is_default: true,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
  last_used_at: null,
};

vi.mock("../hooks/useLlmConfigs", () => ({
  useLlmConfigs: () => ({
    data: [tenantDefault],
    isPending: false,
    isError: false,
    isSuccess: true,
    error: null,
    refetch: vi.fn(),
  }),
  useSaveLlmConfig: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteLlmConfig: () => ({ mutate: vi.fn(), isPending: false }),
  defaultModelFor: () => "claude-sonnet-4-5",
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <LlmProviderSettingsPage />
    </QueryClientProvider>,
  );
}

describe("LlmProviderSettingsPage", () => {
  it("renders the platform default first, then the five domains in order", () => {
    renderPage();
    // DomainSection renders its own h3 title via CardTitle, but so does each
    // nested ProviderCard (e.g. "Anthropic ClaudeDefault" for the fixture's
    // tenant-default config) — both are role "heading" level 3. Match on the
    // exact accessible name of the section titles so the ProviderCard's
    // heading (an implementation detail unrelated to this assertion) isn't
    // picked up. Verified against the actual render via screen.debug().
    const sectionTitles = new Set([
      "Platform default",
      "Markets",
      "Logistics",
      "Communications",
      "Automation & Agents",
      "Security",
    ]);
    const headings = screen
      .getAllByRole("heading", { level: 3, name: (name) => sectionTitles.has(name) })
      .map((h) => h.textContent);
    expect(headings).toEqual([
      "Platform default",
      "Markets",
      "Logistics",
      "Communications",
      "Automation & Agents",
      "Security",
    ]);
  });

  it("shows every domain inheriting the tenant default", () => {
    renderPage();
    expect(screen.getAllByText(/Inherits platform default/i)).toHaveLength(5);
  });

  it("does not describe the page as markets-specific", () => {
    renderPage();
    expect(screen.queryByText(/markets domain/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Markets-domain/i)).not.toBeInTheDocument();
  });
});

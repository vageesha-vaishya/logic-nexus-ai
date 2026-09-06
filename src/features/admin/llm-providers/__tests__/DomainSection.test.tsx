import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { DomainSection } from "../components/DomainSection";
import type { LlmProviderConfig } from "../types";

// ProviderCard (rendered by DomainSection for non-empty `configs`) calls
// useSaveLlmConfig()/useDeleteLlmConfig(), which need a QueryClientProvider —
// the global test setup (test/setup.ts) doesn't provide one, so each test
// wraps render() with a fresh, isolated QueryClient.
function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function cfg(over: Partial<LlmProviderConfig> = {}): LlmProviderConfig {
  return {
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
    ...over,
  };
}

describe("DomainSection", () => {
  it("names the inherited provider when the domain has no config of its own", () => {
    renderWithClient(
      <DomainSection
        domain="logistics"
        configs={[]}
        inheritedFrom={cfg()}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
      />,
    );
    expect(screen.getByText("Logistics")).toBeInTheDocument();
    expect(screen.getByText(/Inherits platform default/i)).toBeInTheDocument();
    expect(screen.getByText(/claude-sonnet-4-5/)).toBeInTheDocument();
  });

  it("renders the domain's own config instead of the inherited state", () => {
    renderWithClient(
      <DomainSection
        domain="markets"
        configs={[cfg({ id: "c2", domain: "markets", provider: "openai", default_model: "gpt-4o-mini" })]}
        inheritedFrom={cfg()}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
      />,
    );
    expect(screen.getByText(/gpt-4o-mini/)).toBeInTheDocument();
    expect(screen.queryByText(/Inherits platform default/i)).not.toBeInTheDocument();
  });

  it("tells the user nothing is configured when there is no inherited default either", () => {
    renderWithClient(
      <DomainSection
        domain="ops"
        configs={[]}
        inheritedFrom={null}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
      />,
    );
    expect(screen.getByText(/No provider configured/i)).toBeInTheDocument();
  });

  it("still shows inherited when a row exists but is not active+default", () => {
    renderWithClient(
      <DomainSection
        domain="markets"
        configs={[
          cfg({
            id: "c3",
            domain: "markets",
            provider: "openai",
            default_model: "gpt-4o-mini",
            is_default: false,
          }),
        ]}
        inheritedFrom={cfg()}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
      />,
    );
    // The row itself is still rendered — nothing disappears from the UI.
    expect(screen.getByText(/gpt-4o-mini/)).toBeInTheDocument();
    // But since no row is both active and default, resolution falls back to
    // the platform default, so the inherited line must still be shown.
    expect(screen.getByText(/Inherits platform default/i)).toBeInTheDocument();
  });
});

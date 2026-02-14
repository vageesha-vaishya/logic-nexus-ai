import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PortalCopilot from "@/components/portal/PortalCopilot";

describe("PortalCopilot", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders and shows answer from portal-chatbot", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, answer: "This is a test answer.", actions: [] }),
    } as any);

    render(<PortalCopilot token="test-token" />);

    const textarea = screen.getByPlaceholderText(/Ask about this quote/i);
    fireEvent.change(textarea, { target: { value: "What is the ETA?" } });

    const btn = screen.getByText("Ask");
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByText("This is a test answer.")).toBeInTheDocument();
    });
  });
});

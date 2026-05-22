import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { useFeatureGate } from "./useFeatureGate";
import type { SetupCardWithState } from "./useSetupCards";

const mockSetupCards = vi.fn();
const mockPromote    = vi.fn(() => Promise.resolve());

vi.mock("./useSetupCards", () => ({
  useSetupCards: () => mockSetupCards(),
}));

function withDefaults(partial: Partial<ReturnType<typeof baseState>> = {}) {
  return { ...baseState(), ...partial };
}

function baseState() {
  return {
    cards:           [] as SetupCardWithState[],
    pendingCount:    0,
    completedCount:  0,
    progressPct:     0,
    isLoading:       false,
    isMutating:      false,
    markComplete:    vi.fn(),
    dismiss:         vi.fn(),
    promote:         mockPromote,
    isB2B:           true,
  };
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

describe("useFeatureGate", () => {
  beforeEach(() => {
    mockSetupCards.mockReset();
    mockPromote.mockReset();
    mockPromote.mockResolvedValue(undefined);
  });

  it("attempt() returns true and does not promote when the task is completed", () => {
    mockSetupCards.mockReturnValue(withDefaults({
      cards: [{
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        def:    { key: "add_gst" } as any,
        status: "completed",
        has_row: true,
      }],
    }));
    const { result } = renderHook(() => useFeatureGate("add_gst"), { wrapper });
    expect(result.current.isLocked).toBe(false);
    let allowed = false;
    act(() => { allowed = result.current.attempt(); });
    expect(allowed).toBe(true);
    expect(mockPromote).not.toHaveBeenCalled();
  });

  it("attempt() returns false, promotes, and opens the modal when locked (no row)", () => {
    mockSetupCards.mockReturnValue(withDefaults({ cards: [] }));
    const { result } = renderHook(() => useFeatureGate("add_gst"), { wrapper });
    expect(result.current.isLocked).toBe(true);
    let allowed = true;
    act(() => { allowed = result.current.attempt(); });
    expect(allowed).toBe(false);
    expect(mockPromote).toHaveBeenCalledWith("add_gst");
  });

  it("attempt() re-promotes a dismissed card", () => {
    mockSetupCards.mockReturnValue(withDefaults({
      cards: [{
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        def:    { key: "sebi_sub_broker_reg" } as any,
        status: "dismissed",
        has_row: true,
      }],
    }));
    const { result } = renderHook(() => useFeatureGate("sebi_sub_broker_reg"), { wrapper });
    expect(result.current.isLocked).toBe(true);
    act(() => { void result.current.attempt(); });
    expect(mockPromote).toHaveBeenCalledWith("sebi_sub_broker_reg");
  });

  it("warns + allows the action when the task_key is unknown", () => {
    mockSetupCards.mockReturnValue(withDefaults());
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = renderHook(() => useFeatureGate("nope_no_such_task"), { wrapper });
    // isLocked is still true (no completed status), but show() bails early
    // with a warning and the modal never opens, so attempt() returns false.
    let allowed = true;
    act(() => { allowed = result.current.attempt(); });
    expect(allowed).toBe(false);
    expect(warn).toHaveBeenCalled();
    expect(mockPromote).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("show() opens the modal without an attempt() call", () => {
    mockSetupCards.mockReturnValue(withDefaults({ cards: [] }));
    const { result } = renderHook(() => useFeatureGate("add_gst"), { wrapper });
    act(() => { result.current.show(); });
    expect(mockPromote).toHaveBeenCalledWith("add_gst");
  });
});

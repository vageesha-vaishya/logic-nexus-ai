import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock Capacitor before importing the hook so the in-module check sees our mock.
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: vi.fn(() => false) },
}));

import { Capacitor } from "@capacitor/core";
import { useSthiraShell } from "./use-sthira-shell";

function setViewport(width: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  window.dispatchEvent(new Event("resize"));
}

afterEach(() => {
  vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
  setViewport(1280);
});

describe("useSthiraShell", () => {
  it("returns true when the viewport is narrower than the mobile breakpoint", () => {
    setViewport(420);
    const { result } = renderHook(() => useSthiraShell());
    expect(result.current).toBe(true);
  });

  it("returns false when the viewport is wide and not native", () => {
    setViewport(1280);
    const { result } = renderHook(() => useSthiraShell());
    expect(result.current).toBe(false);
  });

  it("returns true on Capacitor native even when viewport is wide", () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    setViewport(1280);
    const { result } = renderHook(() => useSthiraShell());
    expect(result.current).toBe(true);
  });

  it("reacts to a window resize crossing the breakpoint", () => {
    setViewport(1024);
    const { result } = renderHook(() => useSthiraShell());
    expect(result.current).toBe(false);
    act(() => setViewport(500));
    expect(result.current).toBe(true);
  });
});

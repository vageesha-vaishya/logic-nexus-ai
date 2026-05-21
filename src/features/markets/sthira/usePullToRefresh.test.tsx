import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Capacitor.isNativePlatform is read once at module init; mock it stable false.
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: vi.fn(() => false) },
}));

import { usePullToRefresh } from "./usePullToRefresh";

function mockTouchEvent(clientY: number, scrollTop = 0): any {
  return {
    currentTarget: { scrollTop } as HTMLElement,
    touches: [{ clientY }],
  };
}

// Skip the rAF-driven snap-back animation so tests don't have to wait.
beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    return setTimeout(() => cb(performance.now() + 10_000), 0) as unknown as number;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id as unknown as NodeJS.Timeout));
});

describe("usePullToRefresh", () => {
  it("commits refresh when pulled past the threshold", async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => usePullToRefresh({ onRefresh }));

    act(() => result.current.containerProps.onTouchStart(mockTouchEvent(100)));
    act(() => result.current.containerProps.onTouchMove(mockTouchEvent(400)));
    expect(result.current.pullProgress).toBe(1); // clamped at threshold

    await act(async () => {
      await result.current.containerProps.onTouchEnd();
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("does NOT commit when pulled less than the threshold", async () => {
    const onRefresh = vi.fn();
    const { result } = renderHook(() => usePullToRefresh({ onRefresh }));

    act(() => result.current.containerProps.onTouchStart(mockTouchEvent(100)));
    act(() => result.current.containerProps.onTouchMove(mockTouchEvent(140))); // dy=40, 40*0.5=20 < 80
    await act(async () => {
      await result.current.containerProps.onTouchEnd();
    });
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("ignores the gesture when scrollTop > 0", async () => {
    const onRefresh = vi.fn();
    const { result } = renderHook(() => usePullToRefresh({ onRefresh }));

    act(() => result.current.containerProps.onTouchStart(mockTouchEvent(100, 50)));
    act(() => result.current.containerProps.onTouchMove(mockTouchEvent(400)));
    expect(result.current.pullProgress).toBe(0); // never started
    await act(async () => {
      await result.current.containerProps.onTouchEnd();
    });
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("disabled flag suppresses the gesture entirely", async () => {
    const onRefresh = vi.fn();
    const { result } = renderHook(() => usePullToRefresh({ onRefresh, disabled: true }));

    act(() => result.current.containerProps.onTouchStart(mockTouchEvent(100)));
    act(() => result.current.containerProps.onTouchMove(mockTouchEvent(400)));
    await act(async () => {
      await result.current.containerProps.onTouchEnd();
    });
    expect(onRefresh).not.toHaveBeenCalled();
  });
});

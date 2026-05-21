import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePullToRefresh } from "./usePullToRefresh";

function mockTouchEvent(clientY: number, scrollTop = 0): any {
  return {
    currentTarget: { scrollTop } as HTMLElement,
    touches: [{ clientY }],
  };
}

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

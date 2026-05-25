import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import {
  SebiDisclaimer,
  DEFAULT_SEBI_DISCLAIMER,
  useSebiDisclaimerTimer,
} from "./SebiDisclaimer";
import { renderHook } from "@testing-library/react";

describe("SebiDisclaimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the default SEBI text when none is provided", () => {
    render(<SebiDisclaimer />);
    expect(screen.getByText(DEFAULT_SEBI_DISCLAIMER)).toBeInTheDocument();
  });

  it("renders a custom text when provided", () => {
    render(<SebiDisclaimer text="Custom regulatory notice." />);
    expect(screen.getByText("Custom regulatory notice.")).toBeInTheDocument();
  });

  it("does not render the timer line when minVisibleMs is not set", () => {
    render(<SebiDisclaimer />);
    expect(screen.queryByText(/Please review for/)).toBeNull();
  });

  it("renders the timer line and counts down when minVisibleMs is set", () => {
    render(<SebiDisclaimer minVisibleMs={5000} />);
    expect(screen.getByText(/Please review for 5s/)).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText(/Please review for 3s/)).toBeInTheDocument();
  });

  it("removes the timer line and fires onTimerComplete once elapsed", () => {
    const onTimerComplete = vi.fn();
    render(
      <SebiDisclaimer minVisibleMs={1000} onTimerComplete={onTimerComplete} />,
    );
    expect(screen.getByText(/Please review for 1s/)).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(screen.queryByText(/Please review for/)).toBeNull();
    expect(onTimerComplete).toHaveBeenCalledTimes(1);
  });

  it("invokes the render-prop with canProceed=false before timer, true after", () => {
    const childSpy = vi.fn(() => <span>child</span>);
    render(<SebiDisclaimer minVisibleMs={500}>{childSpy}</SebiDisclaimer>);
    const initialCall = childSpy.mock.calls[0][0];
    expect(initialCall.canProceed).toBe(false);
    expect(initialCall.secondsRemaining).toBe(1);
    act(() => {
      vi.advanceTimersByTime(600);
    });
    const finalCall = childSpy.mock.calls[childSpy.mock.calls.length - 1][0];
    expect(finalCall.canProceed).toBe(true);
    expect(finalCall.secondsRemaining).toBe(0);
  });
});

describe("useSebiDisclaimerTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns canProceed=true immediately when minVisibleMs is omitted", () => {
    const { result } = renderHook(() => useSebiDisclaimerTimer({}));
    expect(result.current.canProceed).toBe(true);
    expect(result.current.secondsRemaining).toBe(0);
  });

  it("returns canProceed=false until the timer elapses", () => {
    const { result } = renderHook(() =>
      useSebiDisclaimerTimer({ minVisibleMs: 3000 }),
    );
    expect(result.current.canProceed).toBe(false);
    expect(result.current.secondsRemaining).toBe(3);
    act(() => {
      vi.advanceTimersByTime(3100);
    });
    expect(result.current.canProceed).toBe(true);
    expect(result.current.secondsRemaining).toBe(0);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { useColumnResizing } from './useColumnResizing';

type Column = 'name' | 'email';

function fireWindowMouseEvent(type: 'mousemove' | 'mouseup', clientX = 0) {
  act(() => {
    window.dispatchEvent(new MouseEvent(type, { clientX }));
  });
}

function useHarness(minWidth: number, maxWidth: number) {
  const [widths, setWidths] = useState<Partial<Record<Column, number>>>({});
  const resizing = useColumnResizing<Column>(minWidth, maxWidth, setWidths);
  return { widths, ...resizing };
}

function makeMouseDownEvent(clientX: number) {
  return {
    clientX,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as React.MouseEvent<HTMLDivElement>;
}

describe('useColumnResizing', () => {
  it('sets the active column and captures start position on resize start', () => {
    const { result } = renderHook(() => useHarness(90, 520));
    const event = makeMouseDownEvent(100);

    act(() => {
      result.current.startResize(event, 'name', 220);
    });

    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(result.current.activeColumn).toBe('name');
  });

  it('updates the column width by the mouse delta while dragging', () => {
    const { result } = renderHook(() => useHarness(90, 520));

    act(() => {
      result.current.startResize(makeMouseDownEvent(100), 'name', 220);
    });
    fireWindowMouseEvent('mousemove', 140);

    expect(result.current.widths.name).toBe(260);
  });

  it('clamps the resulting width to the provided minimum', () => {
    const { result } = renderHook(() => useHarness(90, 520));

    act(() => {
      result.current.startResize(makeMouseDownEvent(100), 'name', 100);
    });
    fireWindowMouseEvent('mousemove', -500);

    expect(result.current.widths.name).toBe(90);
  });

  it('clamps the resulting width to the provided maximum', () => {
    const { result } = renderHook(() => useHarness(90, 520));

    act(() => {
      result.current.startResize(makeMouseDownEvent(100), 'name', 220);
    });
    fireWindowMouseEvent('mousemove', 5000);

    expect(result.current.widths.name).toBe(520);
  });

  it('ignores mousemove for a column that is not the active one', () => {
    const { result } = renderHook(() => useHarness(90, 520));

    act(() => {
      result.current.startResize(makeMouseDownEvent(100), 'name', 220);
    });
    fireWindowMouseEvent('mousemove', 140);
    expect(result.current.widths.email).toBeUndefined();
  });

  it('clears the active column on mouseup and stops responding to further drags', () => {
    const { result } = renderHook(() => useHarness(90, 520));

    act(() => {
      result.current.startResize(makeMouseDownEvent(100), 'name', 220);
    });
    fireWindowMouseEvent('mousemove', 140);
    expect(result.current.widths.name).toBe(260);

    fireWindowMouseEvent('mouseup');
    expect(result.current.activeColumn).toBeNull();

    fireWindowMouseEvent('mousemove', 400);
    expect(result.current.widths.name).toBe(260);
  });
});

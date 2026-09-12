import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, MouseEvent as ReactMouseEvent, SetStateAction } from 'react';

type ColumnWidths<TColumn extends string> = Partial<Record<TColumn, number>>;

/**
 * Drag-to-resize mechanics shared by the leads list table and the lead
 * activities table, which each maintain their own width map/localStorage
 * persistence but need identical mousedown->mousemove->mouseup handling.
 */
export function useColumnResizing<TColumn extends string>(
  minWidth: number,
  maxWidth: number,
  setWidths: Dispatch<SetStateAction<ColumnWidths<TColumn>>>,
) {
  const [activeColumn, setActiveColumn] = useState<TColumn | null>(null);
  const resizeMetaRef = useRef<{ key: TColumn; startX: number; startWidth: number } | null>(null);

  const startResize = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>, column: TColumn, currentWidth: number) => {
      event.preventDefault();
      event.stopPropagation();
      resizeMetaRef.current = { key: column, startX: event.clientX, startWidth: currentWidth };
      setActiveColumn(column);
    },
    [],
  );

  useEffect(() => {
    if (!activeColumn) return;
    const handleMouseMove = (event: MouseEvent) => {
      const meta = resizeMetaRef.current;
      if (!meta || meta.key !== activeColumn) return;
      const delta = event.clientX - meta.startX;
      const nextWidth = Math.max(minWidth, Math.min(maxWidth, Math.round(meta.startWidth + delta)));
      setWidths((prev) => {
        if (prev[meta.key] === nextWidth) return prev;
        return { ...prev, [meta.key]: nextWidth };
      });
    };
    const handleMouseUp = () => {
      setActiveColumn(null);
      resizeMetaRef.current = null;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeColumn, minWidth, maxWidth, setWidths]);

  return { activeColumn, startResize };
}

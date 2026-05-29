// Scroll-position persistence hook extracted from LeadWorkspaceSections.tsx
// (Phase 4 Sales Step 6 split). Owns the three section refs, hydrates from
// localStorage on mount, and persists scroll positions on a rAF-batched
// schedule. Returns the refs + a scheduler the parent passes to onScroll.

import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ScrollSectionKey } from './types';

export function useLeadWorkspaceScroll(leadId: string | undefined) {
  const mainSectionRef = useRef<HTMLDivElement | null>(null);
  const bottomSectionRef = useRef<HTMLDivElement | null>(null);
  const communicationSectionRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollRef = useRef<Partial<Record<ScrollSectionKey, number>>>({});
  const scrollWriteFrameRef = useRef<number | null>(null);

  const scrollStorageKey = useMemo(
    () => (leadId ? `lead.workspace.scroll.${leadId}` : 'lead.workspace.scroll.new'),
    [leadId],
  );

  const flushScrollPositions = useCallback(() => {
    scrollWriteFrameRef.current = null;
    const hasPending =
      typeof pendingScrollRef.current.main === 'number' ||
      typeof pendingScrollRef.current.bottom === 'number' ||
      typeof pendingScrollRef.current.communication === 'number';
    if (!hasPending) return;
    try {
      const raw = localStorage.getItem(scrollStorageKey);
      const parsed = raw ? (JSON.parse(raw) as Partial<Record<ScrollSectionKey, number>>) : {};
      localStorage.setItem(
        scrollStorageKey,
        JSON.stringify({
          ...parsed,
          ...pendingScrollRef.current,
        }),
      );
      pendingScrollRef.current = {};
    } catch {
      return;
    }
  }, [scrollStorageKey]);

  const scheduleScrollPersist = useCallback(
    (section: ScrollSectionKey, scrollTop: number) => {
      pendingScrollRef.current[section] = scrollTop;
      if (typeof window === 'undefined') return;
      if (scrollWriteFrameRef.current !== null) return;
      scrollWriteFrameRef.current = window.requestAnimationFrame(flushScrollPositions);
    },
    [flushScrollPositions],
  );

  // Hydrate scroll positions from localStorage on mount / key change.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(scrollStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<Record<ScrollSectionKey, number>>;
      if (mainSectionRef.current && typeof parsed.main === 'number') {
        mainSectionRef.current.scrollTop = parsed.main;
      }
      if (bottomSectionRef.current && typeof parsed.bottom === 'number') {
        bottomSectionRef.current.scrollTop = parsed.bottom;
      }
      if (communicationSectionRef.current && typeof parsed.communication === 'number') {
        communicationSectionRef.current.scrollTop = parsed.communication;
      }
    } catch {
      return;
    }
  }, [scrollStorageKey]);

  // Cancel any pending rAF + flush remaining writes on unmount.
  useEffect(
    () => () => {
      if (scrollWriteFrameRef.current !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(scrollWriteFrameRef.current);
        scrollWriteFrameRef.current = null;
      }
      flushScrollPositions();
    },
    [flushScrollPositions],
  );

  return {
    mainSectionRef,
    bottomSectionRef,
    communicationSectionRef,
    scheduleScrollPersist,
  };
}

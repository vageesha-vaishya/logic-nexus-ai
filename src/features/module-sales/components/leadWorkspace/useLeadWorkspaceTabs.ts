// Bottom + communication tab state with lazy-load tracking.
// Each "loaded" set memoises which tabs have been visited so heavy
// children only mount once.

import { useEffect, useState } from 'react';
import type { BottomTabKey, CommunicationTabKey } from './types';

export function useLeadWorkspaceTabs(enhancementsEnabled: boolean) {
  const [bottomTab, setBottomTab] = useState<BottomTabKey>('account');
  const [communicationTab, setCommunicationTab] = useState<CommunicationTabKey>('send_message');
  const [loadedBottomTabs, setLoadedBottomTabs] = useState<Set<BottomTabKey>>(new Set(['account']));
  const [loadedCommunicationTabs, setLoadedCommunicationTabs] = useState<Set<CommunicationTabKey>>(
    new Set(['send_message']),
  );

  // When enhancements are off, fall back to the legacy default tab.
  useEffect(() => {
    if (!enhancementsEnabled) {
      setBottomTab('internal_notes');
      setLoadedBottomTabs(new Set(['internal_notes']));
      return;
    }
    setBottomTab('account');
    setLoadedBottomTabs(new Set(['account']));
  }, [enhancementsEnabled]);

  useEffect(() => {
    setLoadedBottomTabs((prev) => {
      if (prev.has(bottomTab)) return prev;
      const next = new Set(prev);
      next.add(bottomTab);
      return next;
    });
  }, [bottomTab]);

  useEffect(() => {
    setLoadedCommunicationTabs((prev) => {
      if (prev.has(communicationTab)) return prev;
      const next = new Set(prev);
      next.add(communicationTab);
      return next;
    });
  }, [communicationTab]);

  return {
    bottomTab,
    setBottomTab,
    communicationTab,
    setCommunicationTab,
    loadedBottomTabs,
    loadedCommunicationTabs,
  };
}

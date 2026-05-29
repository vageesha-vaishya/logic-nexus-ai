// Arrow/PageUp/Down/Home/End scroll-control handler for the three
// scrollable section containers. Returned as a stable callback to
// avoid rebinding event listeners on every render.

import { useCallback, type KeyboardEvent } from 'react';

export function useScrollableKeyDown() {
  return useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    const pageOffset = Math.max(120, Math.floor(container.clientHeight * 0.8));
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      container.scrollBy({ top: 48, behavior: 'smooth' });
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      container.scrollBy({ top: -48, behavior: 'smooth' });
      return;
    }
    if (event.key === 'PageDown') {
      event.preventDefault();
      container.scrollBy({ top: pageOffset, behavior: 'smooth' });
      return;
    }
    if (event.key === 'PageUp') {
      event.preventDefault();
      container.scrollBy({ top: -pageOffset, behavior: 'smooth' });
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      container.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  }, []);
}

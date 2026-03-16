export type LeadWorkspaceEventMap = {
  'activities:filter': { type: string };
  'activities:refresh': { source: string };
  'notes:refresh': { source: string };
};

type EventKey = keyof LeadWorkspaceEventMap;

export interface LeadWorkspaceEventBus {
  emit<K extends EventKey>(type: K, payload: LeadWorkspaceEventMap[K]): void;
  on<K extends EventKey>(type: K, handler: (payload: LeadWorkspaceEventMap[K]) => void): () => void;
}

export function createLeadWorkspaceEventBus(): LeadWorkspaceEventBus {
  const target = new EventTarget();
  return {
    emit(type, payload) {
      target.dispatchEvent(new CustomEvent(type, { detail: payload }));
    },
    on(type, handler) {
      const listener = (event: Event) => {
        const detail = (event as CustomEvent).detail;
        handler(detail);
      };
      target.addEventListener(type, listener);
      return () => target.removeEventListener(type, listener);
    },
  };
}

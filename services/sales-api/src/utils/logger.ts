// shared with crm-api — keep in sync (Phase 4 Sales Step 4 duplication; see [[phase4-implementation-state]])
export const logger = {
  info: (msg: string, meta?: unknown): void => {
    console.log(`[INFO] ${msg}`, meta || '');
  },
  warn: (msg: string, meta?: unknown): void => {
    console.warn(`[WARN] ${msg}`, meta || '');
  },
  error: (msg: string, meta?: unknown): void => {
    console.error(`[ERROR] ${msg}`, meta || '');
  }
};

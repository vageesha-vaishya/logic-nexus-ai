// shared with crm-api + sales-api — keep in sync (Phase 5 finance-api extraction; see [[phase5-implementation-state]])
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

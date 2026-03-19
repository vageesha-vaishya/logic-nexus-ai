/**
 * Logger Utility
 * Structured logging wrapper around console for consistent log output
 */

export const logger = {
  info: (msg: string, meta?: any): void => {
    console.log(`[INFO] ${msg}`, meta || '');
  },
  warn: (msg: string, meta?: any): void => {
    console.warn(`[WARN] ${msg}`, meta || '');
  },
  error: (msg: string, meta?: any): void => {
    console.error(`[ERROR] ${msg}`, meta || '');
  },
  debug: (msg: string, meta?: any): void => {
    if (process.env.DEBUG) {
      console.log(`[DEBUG] ${msg}`, meta || '');
    }
  },
};

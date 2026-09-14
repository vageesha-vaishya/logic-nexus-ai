// Hand-written declarations for the exports tests/design-system/*.unit.test.ts import.
export const PAGE_KEYS: string[];
export const KEYBOARD_ENGINES: string[];
export function stripAnsi(s: unknown): string;
export function errorSummary(error: unknown): string;
export function expectedCellIds(): string[];
export function buildReport(cells: Record<string, unknown>[], meta: Record<string, unknown>): string;

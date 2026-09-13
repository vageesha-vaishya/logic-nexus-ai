import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { APIRequestContext } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type Mode = 'light' | 'dark';
export type Engine = 'chromium' | 'firefox' | 'webkit' | 'msedge';

export interface Viewport { width: number; height: number }
export const VIEWPORTS: Viewport[] = [
  { width: 360, height: 800 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 },
];
export const MODES: Mode[] = ['light', 'dark'];

/** Viewport used by the 1280-only specs (keyboard, aria). */
export const DESKTOP: Viewport = VIEWPORTS[2];

export interface PageDef {
  key: string;
  /** Route, or a function that resolves a dynamic route (e.g. first lead id). */
  route: string | ((ctx: ResolveContext) => Promise<string>);
  authenticated: boolean;
  why: string;
  /** axe rule ids disabled for this page, each with a reason (listed in the report). */
  disabledAxeRules?: { id: string; reason: string }[];
}

export interface ResolveContext {
  request: APIRequestContext;
  supabaseUrl: string;
  anonKey: string;
  accessToken: string;
}

export const PAGES: PageDef[] = [
  { key: 'auth', route: '/auth', authenticated: false, why: 'Unauthenticated entry; form' },
  { key: 'dashboard', route: '/dashboard', authenticated: true, why: 'KPI grids, widgets' },
  { key: 'leads-list', route: '/dashboard/leads', authenticated: true, why: 'Dense table + title strip' },
  { key: 'lead-detail', route: resolveFirstLead, authenticated: true, why: 'Sticky action bar, tabs' },
  { key: 'leads-kanban', route: '/dashboard/leads/pipeline', authenticated: true, why: 'Horizontal scroll, drag targets' },
  { key: 'contacts-list', route: '/dashboard/contacts', authenticated: true, why: 'Table variant' },
  { key: 'accounts-list', route: '/dashboard/accounts', authenticated: true, why: 'Table variant' },
  { key: 'opportunities-list', route: '/dashboard/opportunities', authenticated: true, why: 'Table with stage badges' },
  { key: 'opportunity-new', route: '/dashboard/opportunities/new', authenticated: true, why: 'Long form, validation' },
  { key: 'themes', route: '/dashboard/themes', authenticated: true, why: 'Runtime preset switching' },
];

/**
 * The leads list navigates on double-click with `openEdit` state, which is not
 * the plain detail view — so the id is resolved through the REST API instead.
 */
async function resolveFirstLead(ctx: ResolveContext): Promise<string> {
  const res = await ctx.request.get(
    `${ctx.supabaseUrl}/rest/v1/leads?select=id&order=created_at.desc&limit=1`,
    { headers: { apikey: ctx.anonKey, Authorization: `Bearer ${ctx.accessToken}` } },
  );
  if (!res.ok()) throw new Error(`leads lookup failed: HTTP ${res.status()} ${await res.text()}`);
  const rows = (await res.json()) as { id: string }[];
  if (!rows.length) throw new Error('No leads visible to the E2E admin; seed one before running lead-detail.');
  return `/dashboard/leads/${rows[0].id}`;
}

export async function resolveRoute(def: PageDef, ctx: ResolveContext): Promise<string> {
  return typeof def.route === 'string' ? def.route : def.route(ctx);
}

/** Absolute dirs. Everything committed lives under VERIFICATION_DIR. */
export const REPO_ROOT = path.resolve(__dirname, '..', '..');
export const VERIFICATION_DIR = path.join(REPO_ROOT, 'docs', 'design-system', 'verification');
export const DATA_DIR = path.join(REPO_ROOT, 'test-results', 'design-system', 'data');
export const AUTH_STATE = path.join(REPO_ROOT, 'tests', 'design-system', '.auth', 'user.json');
/** `{ [pageKey]: route }` for every dynamic route, resolved once by auth.setup.ts. */
export const ROUTES_FILE = path.join(REPO_ROOT, 'tests', 'design-system', '.auth', 'routes.json');

export function screenshotRelPath(pageKey: string, engine: string, width: number, mode: Mode): string {
  return `screenshots/${pageKey}/${engine}-${width}-${mode}.png`;
}
export function ariaRelPath(pageKey: string, engine: string): string {
  return `aria/${pageKey}-${engine}.yaml`;
}

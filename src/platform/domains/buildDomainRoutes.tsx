/**
 * buildDomainRoutes — emit <Route> JSX from a DomainManifest.
 *
 * Phase 2.2 of the multi-domain independence sequence. Replaces 30+
 * hand-declared <Route> lines per domain in App.tsx with a single
 * `{buildDomainRoutes(marketsManifest)}` call that walks the manifest's
 * routes array, lazy-loads each component, wraps in ProtectedRoute
 * (using the domain code + per-route permissions), and emits a JSX
 * subtree compatible with React Router v6.
 *
 * Gated by the VITE_USE_DOMAIN_MANIFESTS env flag — production stays on
 * the hand-declared routes until we've verified the manifest-driven
 * output is byte-for-byte equivalent.
 *
 * See:
 *   docs/plans/2026-05-21-path-a-per-domain-spa-bundles-design.md
 *   src/platform/domains/types.ts
 */
import { ComponentType, lazy, Suspense, type LazyExoticComponent } from "react";
import { Route } from "react-router-dom";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import type { DomainManifest, DomainRoute } from "./types";

/**
 * Stable cache of `lazy()` results keyed by the import-function identity.
 * Without this, every render would create a fresh LazyExoticComponent and
 * React would unmount + remount the route's tree every time.
 *
 * `Map<importFn, lazyComponent>`. Import functions are stable across
 * renders because they're declared once in the manifest at module-init.
 */
const LAZY_CACHE = new WeakMap<DomainRoute["component"], LazyExoticComponent<ComponentType<unknown>>>();

function memoLazy(component: DomainRoute["component"]): LazyExoticComponent<ComponentType<unknown>> {
  let cached = LAZY_CACHE.get(component);
  if (!cached) {
    cached = lazy(component);
    LAZY_CACHE.set(component, cached);
  }
  return cached;
}

export interface BuildDomainRoutesOptions {
  /**
   * If true, only routes flagged `mobile: true` (and their mobile-flagged
   * children) are emitted. This is what Sthira's manifest-driven build will
   * pass once Phase 2.3 lands. Defaults to false (emit everything).
   */
  mobile?: boolean;
  /**
   * Fallback element rendered while a lazy chunk is loading. Defaults to a
   * minimal centered spinner. Callers can override per domain (e.g. Sthira
   * uses a cream-coloured placeholder so the splash → home transition
   * doesn't flash white).
   */
  suspenseFallback?: React.ReactNode;
}

const DEFAULT_FALLBACK = (
  <div className="flex items-center justify-center h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

function wrapInProtected(
  element: React.ReactNode,
  manifestCode: string,
  perms: readonly string[] | undefined,
): React.ReactNode {
  return (
    <ProtectedRoute requiredDomainCode={manifestCode} requiredPermissions={perms as string[] | undefined}>
      {element}
    </ProtectedRoute>
  );
}

function buildOneRoute(
  route: DomainRoute,
  manifest: DomainManifest,
  opts: BuildDomainRoutesOptions,
  fallback: React.ReactNode,
): React.ReactElement | null {
  // Filter mobile-only routes when requested.
  if (opts.mobile && !route.mobile) return null;

  const Lazy = memoLazy(route.component);
  const inner = (
    <Suspense fallback={fallback}>
      <Lazy />
    </Suspense>
  );

  // Combine manifest-level and route-level permission requirements.
  const perms =
    route.requiredPermissions && route.requiredPermissions.length > 0
      ? route.requiredPermissions
      : manifest.requiredPermissions;

  const element = wrapInProtected(inner, manifest.code, perms);

  // Recurse into children. Filter mobile here too so a desktop-only child
  // of a mobile parent doesn't sneak through.
  const childRoutes = (route.children ?? [])
    .map((child) => buildOneRoute(child, manifest, opts, fallback))
    .filter((node): node is React.ReactElement => node !== null);

  return (
    <Route key={route.path} path={route.path} element={element}>
      {childRoutes}
    </Route>
  );
}

/**
 * Build a `<Route>` subtree from a manifest. Returns an array of
 * `<Route>` elements ready to splice into a `<Routes>` parent.
 *
 * Usage:
 *   <Routes>
 *     ...
 *     {buildDomainRoutes(marketsManifest)}
 *     ...
 *   </Routes>
 */
export function buildDomainRoutes(
  manifest: DomainManifest,
  options: BuildDomainRoutesOptions = {},
): React.ReactElement[] {
  const fallback = options.suspenseFallback ?? DEFAULT_FALLBACK;
  return manifest.routes
    .map((r) => buildOneRoute(r, manifest, options, fallback))
    .filter((node): node is React.ReactElement => node !== null);
}

/**
 * Build routes from many manifests. Used by Phase 2.3's per-domain Vite
 * entrypoint — Sthira will call this with [marketsManifest] only, the
 * unified web build will call it with all manifests.
 */
export function buildAllDomainRoutes(
  manifests: readonly DomainManifest[],
  options: BuildDomainRoutesOptions = {},
): React.ReactElement[] {
  return manifests.flatMap((m) => buildDomainRoutes(m, options));
}

/**
 * Read the feature flag once at module init. Avoids re-evaluating on every
 * render and keeps the gate cheap. The boolean is exported so tests +
 * callers don't have to parse the env string themselves.
 *
 * Phase 2.5 will remove this flag when the manifest-driven path is the
 * only path.
 */
export const USE_DOMAIN_MANIFESTS: boolean =
  String(import.meta.env.VITE_USE_DOMAIN_MANIFESTS ?? "").toLowerCase() === "true";

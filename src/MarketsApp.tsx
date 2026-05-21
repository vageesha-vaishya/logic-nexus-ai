/**
 * MarketsApp — Path A Phase 2.3 step 2.
 *
 * Domain-only React tree used when VITE_DOMAIN_ONLY is set (currently
 * only `markets`). Mirrors the provider stack from App.tsx but does NOT
 * eager-import any of the 250+ dashboard route components — the router
 * is built entirely from filterManifestsForBuild(DOMAIN_MANIFESTS),
 * which Vite tree-shakes down to just the selected domain's routes.
 *
 * The entry that mounts this file is src/entrypoints/markets.tsx; the
 * Vite plugin in vite.config.ts swaps the index.html `<script>` src to
 * that entry when VITE_DOMAIN_ONLY is set, so this whole tree replaces
 * App.tsx in the bundle graph.
 *
 * See docs/plans/2026-05-21-path-a-per-domain-spa-bundles-design.md
 */
import { Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";

import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { StickyActionsProvider } from "@/components/layout/StickyActionsContext";
import { queryPersister, shouldPersistQuery } from "@/lib/queryPersistence";

import { AuthProvider } from "./hooks/useAuth";
import { CRMProvider } from "./hooks/useCRM";
import { DomainContextProvider } from "./contexts/DomainContext";
import { TenantBrandingProvider } from "./contexts/TenantBrandingContext";
import { LeadsViewStateProvider } from "./hooks/useLeadsViewState";
import { ThemeProvider } from "./hooks/useTheme";
import { PipelineProvider } from "@/components/debug/pipeline/PipelineContext";

import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import OAuthCallback from "./pages/OAuthCallback";
import SetupAdmin from "./pages/SetupAdmin";
import Unauthorized from "./pages/Unauthorized";

import { buildAllDomainRoutes, filterManifestsForBuild } from "./platform/domains/buildDomainRoutes";
import { DOMAIN_MANIFESTS } from "./platform/domains/registry";
import DomainOnlyNotFound from "./platform/domains/DomainOnlyNotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 24 * 60 * 60 * 1000,
    },
  },
});

const SuspenseFallback = (
  <div className="flex items-center justify-center h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

const MarketsApp = () => (
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{
      persister: queryPersister,
      maxAge: 24 * 60 * 60 * 1000,
      buster: "v1",
      dehydrateOptions: {
        shouldDehydrateQuery: (query) => shouldPersistQuery(query.queryKey),
      },
    }}
  >
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <CRMProvider>
          <DomainContextProvider>
            <TenantBrandingProvider>
              <ThemeProvider>
                <TooltipProvider>
                  <SidebarProvider defaultOpen={false}>
                    <StickyActionsProvider>
                      <LeadsViewStateProvider>
                        <PipelineProvider>
                          <Sonner />
                          <Suspense fallback={SuspenseFallback}>
                            <Routes>
                              <Route path="/" element={<Landing />} />
                              <Route path="/auth" element={<Auth />} />
                              <Route path="/oauth/callback" element={<OAuthCallback />} />
                              <Route path="/setup-admin" element={<SetupAdmin />} />
                              <Route path="/unauthorized" element={<Unauthorized />} />
                              {buildAllDomainRoutes(filterManifestsForBuild(DOMAIN_MANIFESTS), { mobile: true })}
                              <Route path="*" element={<DomainOnlyNotFound />} />
                            </Routes>
                          </Suspense>
                        </PipelineProvider>
                      </LeadsViewStateProvider>
                    </StickyActionsProvider>
                  </SidebarProvider>
                </TooltipProvider>
              </ThemeProvider>
            </TenantBrandingProvider>
          </DomainContextProvider>
        </CRMProvider>
      </AuthProvider>
    </BrowserRouter>
  </PersistQueryClientProvider>
);

export default MarketsApp;

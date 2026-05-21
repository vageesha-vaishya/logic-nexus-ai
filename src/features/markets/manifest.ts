/**
 * Markets domain manifest — the first real DomainManifest implementation.
 *
 * Phase 0 of the multi-domain independence design. Routes are still
 * registered in App.tsx today; Phase 2.2 will migrate the route tree
 * to read from this manifest. For now this just declares the contract
 * and the per-route mobile/desktop split that Path A will key on.
 *
 * See docs/plans/2026-05-21-path-a-per-domain-spa-bundles-design.md
 */
import type { DomainManifest } from "@/platform/domains/types";

export const marketsManifest: DomainManifest = {
  code: "MARKETS",
  name: "Retail Investment Platform",
  description:
    "SEBI-compliant retail investment platform: portfolios, risk scoring, " +
    "rebalancing, behavioural events, push notifications. Powers the Sthira " +
    "mobile shell.",
  brand: {
    // Sthira "Calm Wealth" palette. Already declared in src/index.css; the
    // domain manifest re-asserts the bindings so the manifest-driven router
    // can apply them without depending on global CSS load order.
    cssVars: {
      "--primary": "var(--sthira-copper)",
      "--background": "var(--sthira-cream)",
      "--foreground": "var(--sthira-ink)",
      "--muted": "var(--sthira-fog)",
    },
    // Markets ships under the Sthira app brand on mobile but allows tenant
    // theming on partner-branded surfaces (e.g. an advisor's portfolio
    // detail view).
    hybridWithTenantBranding: true,
  },
  routes: [
    // Sthira shell entry points — mobile-only.
    {
      path: "/sthira/splash",
      component: () => import("./sthira/SthiraSplashRoute"),
      mobile: true,
    },
    {
      path: "/sthira/onboarding",
      component: () => import("./sthira/SthiraOnboardingRoute"),
      mobile: true,
    },
    {
      path: "/sthira/broker",
      component: () => import("./sthira/SthiraBrokerRoute"),
      mobile: true,
    },

    // Retail dashboard — primary mobile surface. The web variant exists at
    // the same path (currently `/dashboard/markets/retail`) and is wrapped
    // by SthiraMobileGuard. Phase 2.2 will fold the guard into the route
    // builder.
    {
      path: "/dashboard/markets/retail",
      component: () => import("./pages/RetailModePage"),
      mobile: true,
      children: [
        { path: "home", component: () => import("./retail/pages/RetailHomePage"), mobile: true },
        { path: "portfolio", component: () => import("./retail/pages/RetailPortfolioPage"), mobile: true },
        { path: "signals", component: () => import("./retail/pages/RetailSignalsPage"), mobile: true },
        { path: "goals", component: () => import("./retail/pages/RetailGoalsPage"), mobile: true },
        { path: "more", component: () => import("./retail/pages/RetailMorePage"), mobile: true },
        { path: "withdraw", component: () => import("./retail/pages/RetailWithdrawPage"), mobile: true },
      ],
    },

    // Broker connections — mobile-eligible (the user adds + manages
    // brokers from the phone).
    {
      path: "/dashboard/markets/settings/brokers",
      component: () => import("./pages/BrokerConnectionsPage"),
      mobile: true,
    },

    // Desktop-only Markets surfaces. Each was the source of one or more
    // crash bugs when accidentally rendered on a small viewport. Path A
    // makes them unreachable from the mobile bundle entirely.
    { path: "/dashboard/markets/terminal", component: () => import("./pages/TerminalPage"), mobile: false },
    { path: "/dashboard/markets/backtests", component: () => import("./pages/BacktestsPage"), mobile: false },
    { path: "/dashboard/markets/strategy-builder", component: () => import("./pages/StrategyBuilderPage"), mobile: false },
    { path: "/dashboard/markets/scanner", component: () => import("./pages/ScannerPage"), mobile: false },
    { path: "/dashboard/markets/fno", component: () => import("./pages/FnoPage"), mobile: false },
    { path: "/dashboard/markets/options-payoff", component: () => import("./pages/OptionsStrategyPage"), mobile: false },
    { path: "/dashboard/markets/span", component: () => import("./pages/SpanCalculatorPage"), mobile: false },
    { path: "/dashboard/markets/risk", component: () => import("./pages/RiskControlsPage"), mobile: false },
  ],
  defaultAssignmentPolicy: "opt-in",
  // Routes here use requiredDomainCode='MARKETS' (applied by
  // buildDomainRoutes), matching the hand-declared App.tsx gates which do
  // not require a granular `markets.view` permission — domain assignment
  // is the only check. Adding requiredPermissions here would be more
  // restrictive than the existing behaviour and break tenant_admins
  // whose tenant has the MARKETS domain but no explicit markets.view grant.
  seedMigration: "20260520150000_seed_markets_domain_and_assignments.sql",
  services: ["markets-worker"],
};

export default marketsManifest;

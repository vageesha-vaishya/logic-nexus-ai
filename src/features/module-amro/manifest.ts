/**
 * AMRO domain manifest (Aircraft Maintenance & Repair Operations).
 *
 * Owns the FAA / EASA / CAAC / SACAA-aware MRO surface — work orders,
 * MPD, parts, configured directives, templates, master data.
 *
 * Phase 8i (2026-06-03): populated `routes` with all 46 AMRO route
 * entries. App.tsx still declares the same routes for non-manifest
 * builds; the manifest is read by `buildDomainRoutes()` when
 * `VITE_USE_DOMAIN_MANIFESTS=true` is set, and when the platform
 * eventually flips the master switch (Phase 2.5 of multi-domain
 * independence), App.tsx duplicates get deleted.
 *
 * Permission strings match the existing ProtectedRoute requiredPermissions
 * in App.tsx exactly. Lazy imports point at the same modules the
 * `lazy(() => import(...))` declarations use.
 *
 * See docs/plans/2026-05-20-multi-domain-platform-sequence-design.md.
 */
import { Plane } from "lucide-react";

import type { DomainManifest, DomainRoute } from "@/platform/domains/types";

const editPerms = ["edit_aircraft_records"] as const;

const amroRoutes: DomainRoute[] = [
  // ── Top-level redirect ──
  {
    path: "/dashboard/amro",
    component: () =>
      import("./manifest-redirects").then((m) => ({ default: m.AmroIndexRedirect })),
  },

  // ── Overview + aircraft surfaces ──
  {
    path: "/dashboard/amro/overview",
    component: () => import(".").then((m) => ({ default: m.AmroOverviewPage })),
  },
  {
    path: "/dashboard/amro/aircraft",
    requiredPermissions: [...editPerms],
    component: () =>
      import("./settings/pages/AmroMasterDataEntityPages").then((m) => ({
        default: m.AircraftSubModulePage,
      })),
  },
  {
    path: "/dashboard/amro/aircraft/:view",
    requiredPermissions: [...editPerms],
    component: () =>
      import("./settings/pages/AmroMasterDataEntityPages").then((m) => ({
        default: m.AircraftSubModulePage,
      })),
  },

  // ── Plan / Directives / Bulletin tree ──
  {
    path: "/dashboard/amro/plan-directives-bulletin",
    requiredPermissions: [...editPerms],
    component: () => import(".").then((m) => ({ default: m.AmroPlanDirectivesBulletinPage })),
  },
  {
    path: "/dashboard/amro/plan-directives-bulletin/mpd",
    requiredPermissions: [...editPerms],
    component: () => import(".").then((m) => ({ default: m.AmroMpdManagementPage })),
  },
  {
    path: "/dashboard/amro/plan-directives-bulletin/configure_mpd",
    requiredPermissions: [...editPerms],
    component: () => import(".").then((m) => ({ default: m.AmroConfigureMpdPage })),
  },
  {
    path: "/dashboard/amro/plan-directives-bulletin/configure_directives",
    requiredPermissions: [...editPerms],
    component: () => import(".").then((m) => ({ default: m.AmroConfigureDirectivesPage })),
  },
  {
    path: "/dashboard/amro/plan-directives-bulletin/directives",
    requiredPermissions: [...editPerms],
    component: () => import(".").then((m) => ({ default: m.AmroDirectivesManagementPage })),
  },

  // ── Work orders ──
  {
    path: "/dashboard/amro/aircraft/work-orders",
    component: () => import(".").then((m) => ({ default: m.AmroWorkOrdersPage })),
  },
  {
    path: "/dashboard/amro/work-orders",
    component: () => import(".").then((m) => ({ default: m.AmroWorkOrdersPage })),
  },
  {
    path: "/dashboard/amro/work-orders/:id",
    component: () =>
      import("./components/work-orders").then((m) => ({
        default: m.AmroWorkOrderDetailPage,
      })),
  },

  // ── Operational surfaces ──
  {
    path: "/dashboard/amro/task-execution",
    component: () => import(".").then((m) => ({ default: m.AmroTaskExecutionPage })),
  },
  {
    path: "/dashboard/amro/scheduling",
    component: () => import(".").then((m) => ({ default: m.AmroSchedulingPage })),
  },
  {
    path: "/dashboard/amro/parts",
    component: () => import(".").then((m) => ({ default: m.AmroPartsPage })),
  },
  {
    path: "/dashboard/amro/compliance",
    component: () => import(".").then((m) => ({ default: m.AmroCompliancePage })),
  },
  {
    path: "/dashboard/amro/certification",
    component: () => import(".").then((m) => ({ default: m.AmroCertificationPage })),
  },
  {
    path: "/dashboard/amro/audit",
    component: () => import(".").then((m) => ({ default: m.AmroAuditPage })),
  },
  {
    path: "/dashboard/amro/integration",
    component: () => import(".").then((m) => ({ default: m.AmroIntegrationPage })),
  },
  {
    path: "/dashboard/amro/intelligence",
    component: () => import(".").then((m) => ({ default: m.AmroIntelligencePage })),
  },

  // ── Settings + master-data tree ──
  {
    path: "/dashboard/amro/settings",
    requiredPermissions: [...editPerms],
    component: () => import(".").then((m) => ({ default: m.AmroSettingsPage })),
  },
  {
    path: "/dashboard/amro/settings/master-data",
    requiredPermissions: [...editPerms],
    component: () =>
      import("./manifest-redirects").then((m) => ({ default: m.AmroMasterDataRedirect })),
  },
  {
    path: "/dashboard/amro/settings/master-data/aircraft",
    requiredPermissions: [...editPerms],
    component: () =>
      import("./settings/pages/AmroMasterDataEntityPages").then((m) => ({
        default: m.AircraftMasterDataPage,
      })),
  },
  {
    path: "/dashboard/amro/settings/master-data/ata-codes",
    requiredPermissions: [...editPerms],
    component: () =>
      import("./settings/pages/AmroMasterDataEntityPages").then((m) => ({
        default: m.AtaCodesMasterDataPage,
      })),
  },
  {
    path: "/dashboard/amro/settings/master-data/parts-inventory",
    requiredPermissions: [...editPerms],
    component: () =>
      import("./settings/pages/AmroMasterDataEntityPages").then((m) => ({
        default: m.PartsInventoryMasterDataPage,
      })),
  },
  {
    path: "/dashboard/amro/settings/master-data/suppliers",
    requiredPermissions: [...editPerms],
    component: () =>
      import("./settings/pages/AmroMasterDataEntityPages").then((m) => ({
        default: m.SuppliersMasterDataPage,
      })),
  },
  {
    path: "/dashboard/amro/settings/master-data/maintenance-facilities",
    requiredPermissions: [...editPerms],
    component: () =>
      import("./settings/pages/AmroMasterDataEntityPages").then((m) => ({
        default: m.MaintenanceFacilitiesMasterDataPage,
      })),
  },
  {
    path: "/dashboard/amro/settings/master-data/work-centers",
    requiredPermissions: [...editPerms],
    component: () =>
      import("./settings/pages/AmroMasterDataEntityPages").then((m) => ({
        default: m.WorkCentersMasterDataPage,
      })),
  },
  {
    path: "/dashboard/amro/settings/master-data/skill-codes",
    requiredPermissions: [...editPerms],
    component: () =>
      import("./settings/pages/AmroMasterDataEntityPages").then((m) => ({
        default: m.SkillCodesMasterDataPage,
      })),
  },
  {
    path: "/dashboard/amro/settings/master-data/manufacturers",
    requiredPermissions: [...editPerms],
    component: () =>
      import("./settings/pages/AmroMasterDataEntityPages").then((m) => ({
        default: m.ManufacturersMasterDataPage,
      })),
  },
  {
    path: "/dashboard/amro/settings/master-data/model",
    requiredPermissions: [...editPerms],
    component: () =>
      import("./settings/pages/AmroMasterDataEntityPages").then((m) => ({
        default: m.ModelMasterDataPage,
      })),
  },
  {
    path: "/dashboard/amro/settings/master-data/regulator-profiles",
    requiredPermissions: [...editPerms],
    component: () =>
      import("./settings/pages/AmroMasterDataEntityPages").then((m) => ({
        default: m.RegulatorProfilesMasterDataPage,
      })),
  },
  {
    path: "/dashboard/amro/settings/master-data/shift-calendars",
    requiredPermissions: [...editPerms],
    component: () =>
      import("./settings/pages/AmroMasterDataEntityPages").then((m) => ({
        default: m.ShiftCalendarsMasterDataPage,
      })),
  },
  {
    path: "/dashboard/amro/settings/master-data/work-orders",
    requiredPermissions: [...editPerms],
    component: () =>
      import("./settings/pages/AmroMasterDataEntityPages").then((m) => ({
        default: m.WorkOrdersMasterDataPage,
      })),
  },
  {
    path: "/dashboard/amro/settings/master-data/work-order-templates",
    requiredPermissions: [...editPerms],
    component: () =>
      import("./settings/pages/AmroMasterDataEntityPages").then((m) => ({
        default: m.WorkOrderTemplatesMasterDataPage,
      })),
  },
  // Generic catch-all for additional master-data entities introduced later.
  {
    path: "/dashboard/amro/settings/master-data/:entity",
    requiredPermissions: [...editPerms],
    component: () => import(".").then((m) => ({ default: m.AmroMasterDataPage })),
  },

  // ── Templates ──
  {
    path: "/dashboard/amro/settings/work-order-templates",
    requiredPermissions: [...editPerms],
    component: () =>
      import("./components/templates/AmroTemplateCatalogPage").then((m) => ({
        default: m.AmroTemplateCatalogPage,
      })),
  },
  {
    path: "/dashboard/amro/settings/work-order-templates/new",
    requiredPermissions: [...editPerms],
    component: () =>
      import("./settings/pages/AmroMasterDataEntityPages").then((m) => ({
        default: m.WorkOrderTemplatesMasterDataPage,
      })),
  },
  {
    path: "/dashboard/amro/settings/work-order-templates/:id",
    requiredPermissions: [...editPerms],
    component: () =>
      import("./settings/pages/AmroMasterDataEntityPages").then((m) => ({
        default: m.WorkOrderTemplatesMasterDataPage,
      })),
  },
  {
    path: "/dashboard/amro/templates",
    requiredPermissions: [...editPerms],
    component: () =>
      import("./templates/AmroWorkOrderTemplatesPage").then((m) => ({
        default: m.AmroWorkOrderTemplatesPage,
      })),
  },

  // ── Redirects + doc surfaces ──
  {
    path: "/dashboard/amro/master-data",
    component: () =>
      import("./manifest-redirects").then((m) => ({ default: m.AmroMasterDataLegacyRedirect })),
  },
  {
    path: "/dashboard/amro/workspace-documentation",
    component: () =>
      import(".").then((m) => ({ default: m.AmroWorkspaceDocumentationPage })),
  },
  {
    path: "/dashboard/amro/design-system-showcase",
    component: () =>
      import("./components/AmroDesignSystemShowcase").then((m) => ({
        default: m.AmroDesignSystemShowcase,
      })),
  },
  {
    path: "/dashboard/amro/changes",
    component: () =>
      import("./manifest-redirects").then((m) => ({ default: m.AmroChangesRedirect })),
  },
];

export const amroManifest: DomainManifest = {
  code: "AMRO",
  name: "AMRO",
  description:
    "FAA / EASA / CAAC / SACAA-aware work orders, MPD, parts, directives.",
  brand: {
    cssVars: {},
    hybridWithTenantBranding: true,
  },

  pathPrefixes: ["/dashboard/amro"],
  sidebar: {
    label: "AMRO",
    icon: Plane,
  },

  routes: amroRoutes,
  defaultAssignmentPolicy: "opt-in",
  requiredPermissions: ["amro.view"],
  seedMigration: "20260411000000_seed_amro_domain_and_assignments.sql",
  defaultRoute: "/dashboard/amro/overview",
  services: ["amro-api"],
};

export default amroManifest;

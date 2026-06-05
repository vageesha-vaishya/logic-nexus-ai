// Phase 8h.2 — UI constants extracted from AmroSettingsMasterDataPage.tsx.
// Module-level nav rails, sub-module enums, dashboard defaults, status
// filter options, and the i18n label tables. Pure data; no React deps.

import {
  CalendarDays,
  CheckSquare,
  FileCheck,
  FileSpreadsheet,
  FileText,
  TimerReset,
} from 'lucide-react';
import type { AircraftLeadsTab } from './components/AircraftLeadsManager';
import type {
  AircraftUnifiedFilterOption,
  AircraftUnifiedLayoutLabels,
} from './components/AircraftUnifiedLayout';

// ── Types ──────────────────────────────────────────────────────────────

export type AircraftSubModuleSegment =
  | 'list' | 'templates' | 'engine' | 'components'
  | 'documents' | 'ad-sb' | 'work-orders';

export type AircraftDashboardKpis = {
  fleet_size: number;
  open_work_orders: number;
  due_within_window: number;
  overdue_work_orders: number;
  open_defects: number;
  total_flight_hours: number;
  total_cycles: number;
  compliance_ready_pct: number;
};

// ── Aircraft module nav rail ──────────────────────────────────────────

export const AIRCRAFT_NAV_RAIL = [
  { label: 'Aircraft List', path: '/dashboard/amro/aircraft/list', view: 'list' as const, icon: TimerReset },
  { label: 'Templates', path: '/dashboard/amro/aircraft/templates', view: 'module' as const, icon: FileSpreadsheet },
  { label: 'Engine', path: '/dashboard/amro/aircraft/engine', view: 'analytics' as const, icon: CheckSquare },
  { label: 'Components', path: '/dashboard/amro/aircraft/components', view: 'grid' as const, icon: CheckSquare },
  { label: 'Documents', path: '/dashboard/amro/aircraft/documents', view: 'import_export' as const, icon: FileText },
  { label: 'AD/SB', path: '/dashboard/amro/aircraft/ad-sb', view: 'pipeline' as const, icon: FileCheck },
  { label: 'Operations', path: '/dashboard/amro/aircraft/work-orders', view: 'card' as const, icon: CalendarDays },
] as const;

export const AIRCRAFT_SUBMODULE_SEGMENTS: ReadonlyArray<AircraftSubModuleSegment> = [
  'list', 'templates', 'engine', 'components', 'documents', 'ad-sb', 'work-orders',
];

export const AIRCRAFT_SUBMODULE_VIEW_MAP: Record<string, 'module' | AircraftLeadsTab> = {
  list: 'module',
  templates: 'module',
  engine: 'analytics',
  components: 'grid',
  documents: 'import_export',
  'ad-sb': 'pipeline',
  'work-orders': 'card',
};

// ── Aircraft dashboard defaults ────────────────────────────────────────

export const DEFAULT_AIRCRAFT_DASHBOARD_KPIS: AircraftDashboardKpis = {
  fleet_size: 0,
  open_work_orders: 0,
  due_within_window: 0,
  overdue_work_orders: 0,
  open_defects: 0,
  total_flight_hours: 0,
  total_cycles: 0,
  compliance_ready_pct: 0,
};

export const AIRCRAFT_DASHBOARD_DUE_WINDOW_OPTIONS = ['7', '14', '30', '60'] as const;

// ── Unified module filter options ──────────────────────────────────────

export const AIRCRAFT_UNIFIED_STATUS_OPTIONS: AircraftUnifiedFilterOption[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'active', label: 'Active' },
  { value: 'critical', label: 'Critical' },
  { value: 'compliant', label: 'Compliant' },
];

// ── i18n label tables ──────────────────────────────────────────────────
// AIRCRAFT_UNIFIED_LAYOUT_I18N and MASTER_DATA_CONTROLS_I18N share the
// same label shape — they're separate constants because they're consumed
// by different control surfaces and may diverge in the future. Identical
// content today is by design, not duplication-by-accident.

const UNIFIED_LAYOUT_LABELS_BY_LOCALE: Record<string, AircraftUnifiedLayoutLabels> = {
  en: {
    searchPlaceholder: 'Search in active module',
    searchAriaLabel: 'Unified module search',
    statusAriaLabel: 'Unified module status filter',
    localeAriaLabel: 'Unified module locale selector',
    navAriaLabel: 'Unified module navigation',
    clearFilters: 'Clear filters',
    loadingMessage: 'Loading module data…',
    resultLabel: 'records',
  },
  es: {
    searchPlaceholder: 'Buscar en el módulo activo',
    searchAriaLabel: 'Búsqueda del módulo unificado',
    statusAriaLabel: 'Filtro de estado del módulo unificado',
    localeAriaLabel: 'Selector de idioma del módulo unificado',
    navAriaLabel: 'Navegación de módulos unificados',
    clearFilters: 'Limpiar filtros',
    loadingMessage: 'Cargando datos del módulo…',
    resultLabel: 'registros',
  },
  fr: {
    searchPlaceholder: 'Rechercher dans le module actif',
    searchAriaLabel: 'Recherche du module unifié',
    statusAriaLabel: 'Filtre de statut du module unifié',
    localeAriaLabel: 'Sélecteur de langue du module unifié',
    navAriaLabel: 'Navigation du module unifié',
    clearFilters: 'Réinitialiser les filtres',
    loadingMessage: 'Chargement des données du module…',
    resultLabel: 'enregistrements',
  },
};

export const AIRCRAFT_UNIFIED_LAYOUT_I18N: Record<string, AircraftUnifiedLayoutLabels> =
  UNIFIED_LAYOUT_LABELS_BY_LOCALE;

export const MASTER_DATA_CONTROLS_I18N: Record<string, AircraftUnifiedLayoutLabels> =
  UNIFIED_LAYOUT_LABELS_BY_LOCALE;

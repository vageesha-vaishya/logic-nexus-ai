export type AmroPartsUxRole = 'technician' | 'engineer' | 'inspector' | 'planner' | 'management';

export type PartsNavigationModuleId =
  | 'overview'
  | 'item-master'
  | 'stock-ledger'
  | 'reservations'
  | 'issue-consume'
  | 'restock'
  | 'locations'
  | 'analytics';

export type PartsNavigationGroup = 'Inventory Core' | 'Operations' | 'Insights';

export type PartsNavigationModuleDefinition = {
  id: PartsNavigationModuleId;
  label: string;
  group: PartsNavigationGroup;
  description: string;
  shortcut: string;
  allowedRoles: AmroPartsUxRole[];
};

export const AMRO_PARTS_NAV_MODULES: PartsNavigationModuleDefinition[] = [
  {
    id: 'overview',
    label: 'Overview',
    group: 'Inventory Core',
    description: 'Primary inventory workspace with quick actions and detail context.',
    shortcut: '1',
    allowedRoles: ['technician', 'engineer', 'inspector', 'planner', 'management'],
  },
  {
    id: 'item-master',
    label: 'Item Master',
    group: 'Inventory Core',
    description: 'Manage canonical part definitions, cross-references, and UOM mappings.',
    shortcut: '2',
    allowedRoles: ['engineer', 'planner', 'management'],
  },
  {
    id: 'stock-ledger',
    label: 'Stock Ledger',
    group: 'Inventory Core',
    description: 'Track real-time movements, valuation flows, and reconciliation controls.',
    shortcut: '3',
    allowedRoles: ['engineer', 'inspector', 'planner', 'management'],
  },
  {
    id: 'reservations',
    label: 'Reservations',
    group: 'Operations',
    description: 'Review reserved quantity allocations and work-order commitments.',
    shortcut: '4',
    allowedRoles: ['technician', 'engineer', 'planner', 'management'],
  },
  {
    id: 'issue-consume',
    label: 'Issue & Consume',
    group: 'Operations',
    description: 'Operational issue and consumption queue for active maintenance tasks.',
    shortcut: '5',
    allowedRoles: ['technician', 'engineer', 'planner', 'management'],
  },
  {
    id: 'restock',
    label: 'Restock',
    group: 'Operations',
    description: 'Prioritized replenishment view driven by low-stock thresholds.',
    shortcut: '6',
    allowedRoles: ['engineer', 'planner', 'management'],
  },
  {
    id: 'locations',
    label: 'Locations',
    group: 'Operations',
    description: 'Warehouse and bin-level distribution heatmap for stock balancing.',
    shortcut: '7',
    allowedRoles: ['technician', 'engineer', 'inspector', 'planner', 'management'],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    group: 'Insights',
    description: 'Inventory KPIs, value exposure, and criticality trend indicators.',
    shortcut: '8',
    allowedRoles: ['inspector', 'planner', 'management'],
  },
];

export function getAllowedPartsModules(role: AmroPartsUxRole): PartsNavigationModuleDefinition[] {
  return AMRO_PARTS_NAV_MODULES.filter((module) => module.allowedRoles.includes(role));
}

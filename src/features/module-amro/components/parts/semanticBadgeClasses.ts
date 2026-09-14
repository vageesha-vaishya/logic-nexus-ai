// Semantic badge utility classes for consistent status indicators
// Addresses Issue CL-02: Semantic Color Inconsistency

export const statusBadgeClasses = {
  // Inventory status
  'in_stock': 'bg-status-success text-status-success-foreground border-status-success-border',
  'low_stock': 'bg-status-warning text-status-warning-foreground border-status-warning-border',
  'out_of_stock': 'bg-status-danger text-status-danger-foreground border-status-danger-border',
  'quarantined': 'bg-status-special text-status-special-foreground border-status-special-border',
  'unserviceable': 'bg-status-neutral text-status-neutral-foreground border-status-neutral-border',

  // Criticality
  'critical': 'bg-status-danger text-status-danger-foreground border-status-danger-border',
  'high': 'bg-status-warning text-status-warning-foreground border-status-warning-border',
  'medium': 'bg-status-warning text-status-warning-foreground border-status-warning-border',
  'low': 'bg-status-success text-status-success-foreground border-status-success-border',

  // ABC Classification
  'A': 'bg-status-danger text-status-danger-foreground border-status-danger-border',
  'B': 'bg-status-warning text-status-warning-foreground border-status-warning-border',
  'C': 'bg-status-success text-status-success-foreground border-status-success-border',

  // Forecast Status
  'forecast_critical': 'bg-status-danger text-status-danger-foreground border-status-danger-border',
  'forecast_reorder_due': 'bg-status-warning text-status-warning-foreground border-status-warning-border',
  'forecast_watch': 'bg-status-warning text-status-warning-foreground border-status-warning-border',
  'forecast_healthy': 'bg-status-success text-status-success-foreground border-status-success-border',

  // Risk Band
  'risk_critical': 'bg-status-danger text-status-danger-foreground border-status-danger-border',
  'risk_watch': 'bg-status-warning text-status-warning-foreground border-status-warning-border',
  'risk_healthy': 'bg-status-success text-status-success-foreground border-status-success-border',
} as const;

/**
 * Get semantic badge classes for a given status
 */
export function getStatusBadgeClass(status: string): string {
  return statusBadgeClasses[status as keyof typeof statusBadgeClasses] || 
    'bg-status-neutral text-status-neutral-foreground border-status-neutral-border';
}

/**
 * Get KPI card styling based on urgency level
 * Addresses Issue VH-03: KPI Card Visual Weight Distribution
 */
export function getKpiCardStyles(urgency: 'critical' | 'warning' | 'healthy' | 'success') {
  switch (urgency) {
    case 'critical':
      return {
        card: 'border-destructive bg-destructive/5',
        text: 'text-destructive',
        label: 'text-destructive',
      };
    case 'warning':
      return {
        card: 'border-amber-300 bg-amber-50/50',
        text: 'text-amber-900',
        label: 'text-amber-700',
      };
    case 'success':
      return {
        card: 'border-emerald-300 bg-emerald-50/50',
        text: 'text-emerald-900',
        label: 'text-emerald-700',
      };
    default: // healthy
      return {
        card: 'border-border bg-card',
        text: 'text-foreground',
        label: 'text-muted-foreground',
      };
  }
}

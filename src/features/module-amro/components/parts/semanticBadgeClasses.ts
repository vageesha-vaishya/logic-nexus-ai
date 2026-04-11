// Semantic badge utility classes for consistent status indicators
// Addresses Issue CL-02: Semantic Color Inconsistency

export const statusBadgeClasses = {
  // Inventory status
  'in_stock': 'bg-green-100 text-green-800 border-green-300',
  'low_stock': 'bg-amber-100 text-amber-800 border-amber-300',
  'out_of_stock': 'bg-red-100 text-red-800 border-red-300',
  'quarantined': 'bg-purple-100 text-purple-800 border-purple-300',
  'unserviceable': 'bg-gray-100 text-gray-800 border-gray-300',

  // Criticality
  'critical': 'bg-red-100 text-red-800 border-red-300',
  'high': 'bg-orange-100 text-orange-800 border-orange-300',
  'medium': 'bg-amber-100 text-amber-800 border-amber-300',
  'low': 'bg-green-100 text-green-800 border-green-300',

  // ABC Classification
  'A': 'bg-red-100 text-red-800 border-red-300',
  'B': 'bg-amber-100 text-amber-800 border-amber-300',
  'C': 'bg-green-100 text-green-800 border-green-300',

  // Forecast Status
  'forecast_critical': 'bg-red-100 text-red-800 border-red-300',
  'forecast_reorder_due': 'bg-orange-100 text-orange-800 border-orange-300',
  'forecast_watch': 'bg-amber-100 text-amber-800 border-amber-300',
  'forecast_healthy': 'bg-green-100 text-green-800 border-green-300',

  // Risk Band
  'risk_critical': 'bg-red-100 text-red-800 border-red-300',
  'risk_watch': 'bg-amber-100 text-amber-800 border-amber-300',
  'risk_healthy': 'bg-green-100 text-green-800 border-green-300',
} as const;

/**
 * Get semantic badge classes for a given status
 */
export function getStatusBadgeClass(status: string): string {
  return statusBadgeClasses[status as keyof typeof statusBadgeClasses] || 
    'bg-gray-100 text-gray-800 border-gray-300';
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

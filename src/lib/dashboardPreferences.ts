import { UserDashboardPreferences, WidgetInstance, UserRole } from '@/types/dashboardTemplates';

/**
 * Merge custom widgets with default widgets
 * Custom widgets override defaults; defaults fill in missing items
 */
export function mergeWidgets(
  defaultWidgets: WidgetInstance[],
  customWidgets?: WidgetInstance[]
): WidgetInstance[] {
  if (!customWidgets || customWidgets.length === 0) {
    return defaultWidgets;
  }

  // Keep custom widgets and add missing defaults
  const customIds = new Set(customWidgets.map(w => w.id));
  return [
    ...customWidgets,
    ...defaultWidgets.filter(w => !customIds.has(w.id))
  ];
}

/**
 * Check if user has applied customization
 */
export function hasCustomization(preferences?: UserDashboardPreferences): boolean {
  return preferences?.customizationApplied ?? false;
}

/**
 * Create a default empty preferences object
 */
export function createDefaultPreferences(userRole: UserRole): UserDashboardPreferences {
  return {
    userId: '',
    role: userRole,
    customWidgets: [],
    customizationApplied: false,
    lastModified: new Date(),
  };
}

/**
 * Export preferences as JSON (for backup/sharing)
 */
export function exportPreferences(preferences: UserDashboardPreferences): string {
  return JSON.stringify(preferences, null, 2);
}

/**
 * Import preferences from JSON
 */
export function importPreferences(json: string): UserDashboardPreferences | null {
  try {
    const data = JSON.parse(json);
    return {
      userId: data.userId,
      role: data.role,
      customWidgets: data.customWidgets || [],
      customizationApplied: data.customizationApplied || false,
      lastModified: new Date(data.lastModified),
    };
  } catch (error) {
    console.error('Failed to import preferences:', error);
    return null;
  }
}

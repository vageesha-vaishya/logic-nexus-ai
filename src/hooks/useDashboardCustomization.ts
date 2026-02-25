import { useState, useEffect } from 'react';
import { UserDashboardPreferences, WidgetInstance, UserRole } from '@/types/dashboardTemplates';
import { useCRM } from '@/hooks/useCRM';

export function useDashboardCustomization(userRole: UserRole) {
  const { scopedDb } = useCRM();
  const [preferences, setPreferences] = useState<UserDashboardPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const { data } = await scopedDb
          .from('user_preferences')
          .select('*')
          .eq('role', userRole)
          .maybeSingle();

        if (data) {
          setPreferences({
            userId: data.user_id,
            role: data.role,
            customWidgets: data.custom_widgets || [],
            customizationApplied: data.customization_applied || false,
            lastModified: new Date(data.last_modified),
          });
        }
      } catch (error) {
        console.error('Failed to load dashboard preferences:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, [userRole, scopedDb]);

  const savePreferences = async (widgets: WidgetInstance[]) => {
    try {
      const { error } = await scopedDb
        .from('user_preferences')
        .upsert({
          role: userRole,
          custom_widgets: widgets,
          customization_applied: true,
          last_modified: new Date(),
        }, { onConflict: 'role' });

      if (error) throw error;
      setPreferences({
        userId: '',
        role: userRole,
        customWidgets: widgets,
        customizationApplied: true,
        lastModified: new Date(),
      });
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
  };

  return { preferences, loading, savePreferences };
}

import { useState, useEffect } from 'react';
import { UserDashboardPreferences, WidgetInstance, UserRole } from '@/types/dashboardTemplates';
import { useCRM } from '@/hooks/useCRM';

export function useDashboardCustomization(userRole: UserRole) {
  const { scopedDb, context } = useCRM();
  const [preferences, setPreferences] = useState<UserDashboardPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user preferences on mount
  useEffect(() => {
    if (!context?.userId) {
      setLoading(false);
      return;
    }

    const loadPreferences = async () => {
      try {
        const { data, error } = await scopedDb
          .from('user_preferences')
          .select('*')
          .eq('user_id', context.userId)
          .eq('role', userRole)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') throw error;

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
  }, [userRole, context?.userId, scopedDb, context]);

  const savePreferences = async (widgets: WidgetInstance[]) => {
    if (!context?.userId) {
      console.error('Cannot save preferences: user ID not available');
      return;
    }

    try {
      const { data, error } = await scopedDb
        .from('user_preferences')
        .upsert(
          {
            user_id: context.userId,
            role: userRole,
            custom_widgets: widgets,
            customization_applied: true,
            last_modified: new Date().toISOString(),
          },
          { onConflict: 'user_id,role' }
        )
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setPreferences({
          userId: data.user_id,
          role: data.role,
          customWidgets: data.custom_widgets || [],
          customizationApplied: true,
          lastModified: new Date(data.last_modified),
        });
      }
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
  };

  return { preferences, loading, savePreferences };
}

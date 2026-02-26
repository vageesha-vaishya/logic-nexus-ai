import { useState, useEffect, useCallback } from 'react';
import { useCRM } from './useCRM';
import { WidgetInstance } from '@/types/dashboardTemplates';

export function useDashboardPreferences(defaultWidgets: WidgetInstance[]) {
  const { scopedDb, user, context } = useCRM();
  const [widgets, setWidgets] = useState<WidgetInstance[]>(defaultWidgets);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    const fetchPreferences = async () => {
      try {
        setLoading(true);
        const { data, error } = await scopedDb
          .from('dashboard_preferences')
          .select('widgets')
          .eq('user_id', user.id)
          .maybeSingle();

        if (data?.widgets && Array.isArray(data.widgets)) {
          // Deduplicate widgets by both ID and Type to prevent display issues if DB has duplicates
          // We prioritize the first occurrence of each type to maintain cleaner dashboards
          const uniqueWidgets: WidgetInstance[] = [];
          const seenTypes = new Set<string>();
          const seenIds = new Set<string>();

          for (const w of (data.widgets as WidgetInstance[])) {
            if (!seenTypes.has(w.type) && !seenIds.has(w.id)) {
              seenTypes.add(w.type);
              seenIds.add(w.id);
              uniqueWidgets.push(w);
            }
          }
          
          setWidgets(uniqueWidgets);
        } else if (!error) {
          // No preferences found, use defaults
          setWidgets(defaultWidgets);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard preferences:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPreferences();
  }, [user?.id, scopedDb, defaultWidgets]);

  const savePreferences = useCallback(async (newWidgets: WidgetInstance[]) => {
    if (!user?.id) return;

    try {
      // Optimistic update
      setWidgets(newWidgets);

      const { error } = await scopedDb
        .from('dashboard_preferences')
        .upsert({
          user_id: user.id,
          tenant_id: context?.tenantId,
          franchise_id: context?.franchiseId,
          widgets: newWidgets,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
    } catch (error) {
      console.error('Failed to save dashboard preferences:', error);
      // Revert on error? Or show toast?
    }
  }, [user?.id, scopedDb, context?.tenantId, context?.franchiseId]);

  return {
    widgets,
    loading,
    savePreferences,
  };
}

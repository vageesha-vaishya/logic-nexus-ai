import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useTheme } from '@/hooks/useTheme';
import { PrototypeLayout } from '@/stories/crm/prototypes/Layout';
import { useCrmWorkspaceData } from '@/features/module-crm/hooks/useCrmWorkspaceData';
import { Loader2 } from 'lucide-react';

export default function CRMWorkspace() {
  const { activeThemeName } = useTheme();
  const { loading, error, leads, users, tasks } = useCrmWorkspaceData();

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex h-[60vh] items-center justify-center text-sm text-destructive">
          Failed to load CRM workspace data. Please refresh the page.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PrototypeLayout themePreset={activeThemeName ?? undefined} leads={leads} users={users} tasks={tasks} />
    </DashboardLayout>
  );
}

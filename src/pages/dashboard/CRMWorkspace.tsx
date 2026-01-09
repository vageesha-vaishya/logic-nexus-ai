import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useTheme } from '@/hooks/useTheme';
import { PrototypeLayout } from '@/stories/crm/prototypes/Layout';
 
export default function CRMWorkspace() {
  const { activeThemeName } = useTheme();
  return (
    <DashboardLayout>
      <PrototypeLayout themePreset={activeThemeName ?? undefined} />
    </DashboardLayout>
  );
}

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useSthiraShell } from '@/hooks/use-sthira-shell';
import { RetailMode } from '../retail/RetailMode';

/**
 * Sthira shell (native APK or narrow viewport) gets RetailMode raw —
 * RetailNavLayout already provides its own 5-tab chrome + FAB. Wrapping in
 * DashboardLayout would leak the CRM header (hamburger + Search +
 * notification bell) above the mobile UI. Desktop callers still get the
 * full dashboard chrome.
 */
export default function RetailModePage() {
  const isSthiraShell = useSthiraShell();
  if (isSthiraShell) return <RetailMode />;
  return (
    <DashboardLayout>
      <RetailMode />
    </DashboardLayout>
  );
}

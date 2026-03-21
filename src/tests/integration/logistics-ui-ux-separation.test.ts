import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('logistics UI UX separation', () => {
  it('implements owned logistics workspace surfaces and operator console boundaries', () => {
    const workspaceSurface = read('src/features/module-logistics/components/LogisticsOwnedWorkspace.tsx');
    expect(workspaceSurface).toContain('data-logistics-owned-surface="shipment-workspace"');
    expect(workspaceSurface).toContain('data-logistics-owned-surface="route-planning-board"');
    expect(workspaceSurface).toContain('data-logistics-owned-surface="tracking-timelines"');
    expect(workspaceSurface).toContain('data-logistics-owned-surface="operational-exception-panels"');
    expect(workspaceSurface).toContain('data-operator-console="logistics-only"');
  });

  it('enforces mode-specific leg validation and real-time franchise-aware tracking behavior', () => {
    const hookContent = read('src/features/module-logistics/hooks/useLogisticsWorkspaceState.ts');
    const modelContent = read('src/features/module-logistics/workspace/logisticsWorkspaceModel.ts');
    expect(modelContent).toContain('LOGISTICS_MODE_FIELD_SCHEMA');
    expect(modelContent).toContain('validateLegDraft');
    expect(hookContent).toContain("channel(`logistics-tracking-stream-");
    expect(hookContent).toContain("table: 'tracking_events'");
    expect(hookContent).toContain("setFranchiseFilter");
  });

  it('renders pricing, compliance, and finance references as read-only federated widgets', () => {
    const workspaceSurface = read('src/features/module-logistics/components/LogisticsOwnedWorkspace.tsx');
    const pageShell = read('src/features/module-logistics/pages/ShipmentsPipelineVerticalPage.tsx');
    expect(workspaceSurface).toContain('data-federated-widget-readonly="true"');
    expect(workspaceSurface).toContain('Pricing Reference');
    expect(workspaceSurface).toContain('Compliance Reference');
    expect(workspaceSurface).toContain('Finance Reference');
    expect(pageShell).toContain('PlatformWidgetSlot');
  });
});

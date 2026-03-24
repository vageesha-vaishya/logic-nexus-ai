import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  AircraftMasterDataPage,
  MaintenanceFacilitiesMasterDataPage,
  ManufacturersMasterDataPage,
  PartsInventoryMasterDataPage,
  RegulatorProfilesMasterDataPage,
  ShiftCalendarsMasterDataPage,
  SkillCodesMasterDataPage,
  SuppliersMasterDataPage,
  WorkCentersMasterDataPage,
  WorkPackageTemplatesMasterDataPage,
} from './AmroMasterDataEntityPages';

vi.mock('./AmroSettingsMasterDataPage', () => ({
  AmroSettingsMasterDataPage: ({ entityOverride }: { entityOverride?: string }) => (
    <div data-testid="entity-override">{entityOverride}</div>
  ),
}));

describe('AmroMasterDataEntityPages', () => {
  it('maps each wrapper page to the correct master data entity override', () => {
    const matrix: Array<{ component: () => JSX.Element; expected: string }> = [
      { component: AircraftMasterDataPage, expected: 'aircraft' },
      { component: PartsInventoryMasterDataPage, expected: 'parts_inventory' },
      { component: SuppliersMasterDataPage, expected: 'suppliers' },
      { component: MaintenanceFacilitiesMasterDataPage, expected: 'maintenance_facilities' },
      { component: WorkCentersMasterDataPage, expected: 'work_centers' },
      { component: SkillCodesMasterDataPage, expected: 'skill_codes' },
      { component: ManufacturersMasterDataPage, expected: 'manufacturers' },
      { component: RegulatorProfilesMasterDataPage, expected: 'regulator_profiles' },
      { component: ShiftCalendarsMasterDataPage, expected: 'shift_calendars' },
      { component: WorkPackageTemplatesMasterDataPage, expected: 'work_package_templates' },
    ];

    matrix.forEach(({ component: Component, expected }) => {
      const { unmount } = render(<Component />);
      expect(screen.getByTestId('entity-override')).toHaveTextContent(expected);
      unmount();
    });
  });
});

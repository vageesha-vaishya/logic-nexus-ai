import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  AircraftMasterDataPage,
  AircraftSubModulePage,
  MaintenanceFacilitiesMasterDataPage,
  ManufacturersMasterDataPage,
  PartsInventoryMasterDataPage,
  RegulatorProfilesMasterDataPage,
  ShiftCalendarsMasterDataPage,
  SkillCodesMasterDataPage,
  SuppliersMasterDataPage,
  WorkPackagesMasterDataPage,
  WorkCentersMasterDataPage,
  WorkPackageTemplatesMasterDataPage,
} from './AmroMasterDataEntityPages';

vi.mock('./AmroSettingsMasterDataPage', () => ({
  AmroSettingsMasterDataPage: ({
    entityOverride,
    variant,
  }: {
    entityOverride?: string;
    variant?: string;
  }) => (
    <div data-testid="entity-override">{`${entityOverride || ''}:${variant || 'master-data'}`}</div>
  ),
}));

describe('AmroMasterDataEntityPages', () => {
  it('maps each wrapper page to the correct master data entity override', () => {
    const matrix: Array<{ component: () => JSX.Element; expected: string }> = [
      { component: AircraftMasterDataPage, expected: 'aircraft:master-data' },
      { component: AircraftSubModulePage, expected: 'aircraft:aircraft-sub-module' },
      { component: PartsInventoryMasterDataPage, expected: 'parts_inventory:master-data' },
      { component: SuppliersMasterDataPage, expected: 'suppliers:master-data' },
      { component: MaintenanceFacilitiesMasterDataPage, expected: 'maintenance_facilities:master-data' },
      { component: WorkCentersMasterDataPage, expected: 'work_centers:master-data' },
      { component: SkillCodesMasterDataPage, expected: 'skill_codes:master-data' },
      { component: ManufacturersMasterDataPage, expected: 'manufacturers:master-data' },
      { component: RegulatorProfilesMasterDataPage, expected: 'regulator_profiles:master-data' },
      { component: ShiftCalendarsMasterDataPage, expected: 'shift_calendars:master-data' },
      { component: WorkPackagesMasterDataPage, expected: 'work_package_templates:master-data' },
      { component: WorkPackageTemplatesMasterDataPage, expected: 'work_package_templates:master-data' },
    ];

    matrix.forEach(({ component: Component, expected }) => {
      const { unmount } = render(<Component />);
      expect(screen.getByTestId('entity-override')).toHaveTextContent(expected);
      unmount();
    });
  });
});

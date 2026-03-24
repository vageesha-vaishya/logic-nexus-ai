import { AmroSettingsMasterDataPage } from './AmroSettingsMasterDataPage';

export function AircraftMasterDataPage() {
  return <AmroSettingsMasterDataPage entityOverride="aircraft" />;
}

export function PartsInventoryMasterDataPage() {
  return <AmroSettingsMasterDataPage entityOverride="parts_inventory" />;
}

export function SuppliersMasterDataPage() {
  return <AmroSettingsMasterDataPage entityOverride="suppliers" />;
}

export function MaintenanceFacilitiesMasterDataPage() {
  return <AmroSettingsMasterDataPage entityOverride="maintenance_facilities" />;
}

export function WorkCentersMasterDataPage() {
  return <AmroSettingsMasterDataPage entityOverride="work_centers" />;
}

export function SkillCodesMasterDataPage() {
  return <AmroSettingsMasterDataPage entityOverride="skill_codes" />;
}

export function RegulatorProfilesMasterDataPage() {
  return <AmroSettingsMasterDataPage entityOverride="regulator_profiles" />;
}

export function ShiftCalendarsMasterDataPage() {
  return <AmroSettingsMasterDataPage entityOverride="shift_calendars" />;
}

export function WorkPackageTemplatesMasterDataPage() {
  return <AmroSettingsMasterDataPage entityOverride="work_package_templates" />;
}

import { AmroSettingsMasterDataPage } from './AmroSettingsMasterDataPage';

export function AircraftMasterDataPage() {
  return <AmroSettingsMasterDataPage entityOverride="aircraft" />;
}

export function AircraftSubModulePage() {
  return <AmroSettingsMasterDataPage entityOverride="aircraft" variant="aircraft-sub-module" />;
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

export function ManufacturersMasterDataPage() {
  return <AmroSettingsMasterDataPage entityOverride="manufacturers" />;
}

export function ModelMasterDataPage() {
  return <AmroSettingsMasterDataPage entityOverride="assembly_models" />;
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

export function WorkPackagesMasterDataPage() {
  return <AmroSettingsMasterDataPage entityOverride="work_package_templates" />;
}

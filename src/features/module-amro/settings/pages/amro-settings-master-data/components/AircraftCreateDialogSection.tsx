import type { RefObject } from 'react';
import { CalendarDays, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type AircraftTemplateModelOption = {
  id: string;
  name: string;
  tenantId?: string;
  franchiseId?: string;
  assemblyModelId?: string;
  maintenanceProgram?: string;
  revisionNumber?: string;
  amendmentNumber?: string;
};

type AircraftCounterRow = {
  key: string;
  name: string;
  serialNumber: string;
  model: string;
  initialValue: string;
  initialDate: string;
  unit: string;
};

type AircraftAuditTimelineItem = {
  label: string;
  value: string;
};

const AIRCRAFT_WEIGHT_UNIT_OPTIONS = ['KG', 'Pounds', 'Litre', 'Gallon (US)', 'Gallon (UK)', 'Quarters'];

type AircraftCreateDialogSectionProps = {
  aircraftRequiredProgress: { completed: number; total: number; percent: number };
  collaborationIndicator: { status: string; activeEditors: number; lastSeen: string };
  aircraftValidationSummary: { errorCount: number };
  aircraftTemplateModel: string;
  aircraftTenantValue: string;
  aircraftFranchiseValue: string;
  aircraftListboxOptionsLoading: boolean;
  aircraftTenantOptionsLoading: boolean;
  aircraftFranchiseOptionsLoading: boolean;
  aircraftTemplateOptionsLoading: boolean;
  aircraftTenantOptionsError: string;
  aircraftFranchiseOptionsError: string;
  setAircraftTemplateModel: (value: string) => void;
  setAircraftTenantValue: (value: string) => void;
  setAircraftFranchiseValue: (value: string) => void;
  setAircraftAuxField: (field: string, value: string) => void;
  systemTemplateModelOptions: AircraftTemplateModelOption[];
  franchiseAssemblyModelOptions: AircraftTemplateModelOption[];
  setFieldValue: (field: string, value: unknown) => void;
  aircraftTemplateSelectOptions: SelectOption[];
  aircraftTenantSelectOptions: SelectOption[];
  aircraftFranchiseSelectOptions: SelectOption[];
  disableAircraftFranchiseSelection: boolean;
  disableAircraftModelSelection: boolean;
  formValues: Record<string, unknown>;
  formErrors: Record<string, string>;
  firstFieldRef: RefObject<HTMLInputElement>;
  // Assembly model details (populated from selected template)
  selectedTemplateModelName: string;
  selectedTemplateManufacturerName: string;
  selectedTemplateAircraftType: string;
  aircraftNoSerialNumber: boolean;
  handleAircraftNoSerialChange: (value: boolean) => void;
  aircraftManufacturingDate: string;
  setAircraftManufacturingDate: (value: string) => void;
  aircraftBase: string;
  setAircraftBase: (value: string) => void;
  aircraftBaseSelectOptions: SelectOption[];
  aircraftOwner: string;
  setAircraftOwner: (value: string) => void;
  aircraftOwnerSelectOptions: SelectOption[];
  aircraftLineNumber: string;
  setAircraftLineNumber: (value: string) => void;
  aircraftVariableNumber: string;
  setAircraftVariableNumber: (value: string) => void;
  aircraftCounterRows: AircraftCounterRow[];
  setAircraftCounterValue: (rowKey: string, field: 'initialValue' | 'initialDate', value: string) => void;
  aircraftMaintenanceRevisionNumber: string;
  setAircraftMaintenanceRevisionNumber: (value: string) => void;
  aircraftAmendmentNumber: string;
  setAircraftAmendmentNumber: (value: string) => void;
  aircraftMaintenanceRevisionDate: string;
  setAircraftMaintenanceRevisionDate: (value: string) => void;
  aircraftAmendmentDate: string;
  setAircraftAmendmentDate: (value: string) => void;
  aircraftAuditTimeline: AircraftAuditTimelineItem[];
};

export function AircraftCreateDialogSection({
  aircraftRequiredProgress,
  collaborationIndicator,
  aircraftValidationSummary,
  aircraftTemplateModel,
  aircraftTenantValue,
  aircraftFranchiseValue,
  aircraftListboxOptionsLoading,
  aircraftTenantOptionsLoading,
  aircraftFranchiseOptionsLoading,
  aircraftTemplateOptionsLoading,
  aircraftTenantOptionsError,
  aircraftFranchiseOptionsError,
  setAircraftTemplateModel,
  setAircraftTenantValue,
  setAircraftFranchiseValue,
  setAircraftAuxField,
  systemTemplateModelOptions,
  franchiseAssemblyModelOptions,
  setFieldValue,
  aircraftTemplateSelectOptions,
  aircraftTenantSelectOptions,
  aircraftFranchiseSelectOptions,
  disableAircraftFranchiseSelection,
  disableAircraftModelSelection,
  formValues,
  formErrors,
  firstFieldRef,
  selectedTemplateModelName,
  selectedTemplateManufacturerName,
  selectedTemplateAircraftType,
  aircraftNoSerialNumber,
  handleAircraftNoSerialChange,
  aircraftManufacturingDate,
  setAircraftManufacturingDate,
  aircraftBase,
  setAircraftBase,
  aircraftBaseSelectOptions,
  aircraftOwner,
  setAircraftOwner,
  aircraftOwnerSelectOptions,
  aircraftLineNumber,
  setAircraftLineNumber,
  aircraftVariableNumber,
  setAircraftVariableNumber,
  aircraftCounterRows,
  setAircraftCounterValue,
  aircraftMaintenanceRevisionNumber,
  setAircraftMaintenanceRevisionNumber,
  aircraftAmendmentNumber,
  setAircraftAmendmentNumber,
  aircraftMaintenanceRevisionDate,
  setAircraftMaintenanceRevisionDate,
  aircraftAmendmentDate,
  setAircraftAmendmentDate,
  aircraftAuditTimeline,
}: AircraftCreateDialogSectionProps) {
  const sectionClassName = 'rounded border border-[#7aa4d6] bg-white p-3';
  const sectionTitleClassName = 'mb-2 border-b border-[#7aa4d6] pb-1 text-[13px] font-semibold text-slate-900';
  const controlClassName = 'h-8 rounded border border-[#7aa4d6] bg-white px-2 text-[12px] text-slate-800';
  const validationMessages = Object.entries(formErrors)
    .filter(([, message]) => String(message || '').trim().length > 0)
    .map(([field, message]) => ({ field, message: String(message) }));

  return (
    <div className="space-y-3 bg-[#f4f7fb] p-3 text-[12px]">
      <div className="flex flex-wrap gap-1">
        {['Aircraft Status', 'Assembly(s)', 'Maintenance Prog'].map((tabLabel, index) => (
          <button
            key={tabLabel}
            type="button"
            className={cn(
              'rounded-sm border px-3 py-1 text-[12px] font-medium',
              index === 0
                ? 'border-[#5b7fb0] bg-gradient-to-b from-[#dce7f7] to-[#c8d9f2] text-[#1f3d68]'
                : 'border-[#9fb8db] bg-gradient-to-b from-[#eef3fb] to-[#dde7f7] text-[#304f7a]',
            )}
          >
            {tabLabel}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between rounded border border-[#7aa4d6] bg-white px-3 py-2 text-[11px] text-slate-700">
        <span className="font-semibold text-[#1f3d68]">
          Required Completion {aircraftRequiredProgress.completed}/{aircraftRequiredProgress.total} ({aircraftRequiredProgress.percent}%)
        </span>
        <span className="flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-[#1f3d68]" />
          {collaborationIndicator.status} · {collaborationIndicator.activeEditors} active · Errors {aircraftValidationSummary.errorCount}
        </span>
      </div>
      {validationMessages.length > 0 ? (
        <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-[11px] text-red-700">
          <p className="font-semibold">Please resolve the highlighted fields:</p>
          <p>{validationMessages.map((entry) => entry.message).join(' | ')}</p>
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-3">
          <section className={sectionClassName}>
            <h3 className={sectionTitleClassName}>Aircraft Registration Details</h3>
            <div className="grid gap-2 sm:grid-cols-[120px_1fr] sm:items-center">
              <Label htmlFor="aircraft-registration" className="font-semibold">* Reg No.</Label>
              <Input
                id="aircraft-registration"
                ref={firstFieldRef}
                value={String(formValues.registration ?? '')}
                onChange={(event) => {
                  const value = event.target.value.toUpperCase();
                  setFieldValue('registration', value);
                  setFieldValue('tail_number', value);
                }}
                className={cn(controlClassName, (formErrors.registration || formErrors.tail_number) && 'border-destructive')}
              />

              <Label htmlFor="aircraft-franchise-id" className="font-semibold">* Franchise</Label>
              <select
                id="aircraft-franchise-id"
                value={aircraftFranchiseValue}
                disabled={disableAircraftFranchiseSelection || aircraftFranchiseOptionsLoading}
                onChange={(event) => setAircraftFranchiseValue(event.target.value)}
                className={cn(controlClassName, formErrors.franchise_id && 'border-destructive')}
              >
                {aircraftFranchiseSelectOptions.map((option) => (
                  <option key={option.value} value={option.value} disabled={Boolean(option.disabled)}>
                    {option.label}
                  </option>
                ))}
              </select>

              <Label htmlFor="aircraft-owner-select" className="font-semibold">* Operator Owner</Label>
              <select
                id="aircraft-owner-select"
                value={aircraftOwner}
                disabled={aircraftListboxOptionsLoading}
                onChange={(event) => {
                  const value = event.target.value;
                  setAircraftOwner(value);
                  setAircraftAuxField('owner_name', value);
                }}
                className={controlClassName}
              >
                {aircraftOwnerSelectOptions.map((option) => (
                  <option key={option.value} value={option.value} disabled={option.disabled}>
                    {option.label}
                  </option>
                ))}
              </select>

              <Label htmlFor="aircraft-tenant-id" className="font-semibold">Tenant</Label>
              <select
                id="aircraft-tenant-id"
                value={aircraftTenantValue}
                disabled={aircraftTenantOptionsLoading}
                onChange={(event) => setAircraftTenantValue(event.target.value)}
                className={cn(controlClassName, formErrors.tenant_id && 'border-destructive')}
              >
                {aircraftTenantSelectOptions.map((option) => (
                  <option key={option.value} value={option.value} disabled={Boolean(option.disabled)}>
                    {option.label}
                  </option>
                ))}
              </select>

              <Label htmlFor="aircraft-serial" className="font-semibold">* Serial No.</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="aircraft-serial"
                  value={String(formValues.serial_number ?? '')}
                  onChange={(event) => setFieldValue('serial_number', event.target.value.toUpperCase())}
                  disabled={aircraftNoSerialNumber}
                  className={cn(controlClassName, 'flex-1', formErrors.serial_number && 'border-destructive')}
                />
                <div className="flex items-center gap-1 text-[11px]">
                  <Checkbox id="aircraft-no-serial" checked={aircraftNoSerialNumber} onCheckedChange={(value) => handleAircraftNoSerialChange(Boolean(value))} />
                  <Label htmlFor="aircraft-no-serial" className="font-normal">No Serial</Label>
                </div>
              </div>

              <Label htmlFor="aircraft-tail-number" className="font-semibold">* Tail No.</Label>
              <Input
                id="aircraft-tail-number"
                value={String(formValues.registration ?? '')}
                readOnly
                aria-readonly="true"
                tabIndex={-1}
                className={cn(controlClassName, 'bg-slate-100', formErrors.tail_number && 'border-destructive')}
              />
            </div>
            {formErrors.tenant_id ? <p className="mt-1 text-[10px] text-red-600">{formErrors.tenant_id}</p> : aircraftTenantOptionsError ? <p className="mt-1 text-[10px] text-red-600">{aircraftTenantOptionsError}</p> : null}
            {formErrors.franchise_id ? <p className="mt-1 text-[10px] text-red-600">{formErrors.franchise_id}</p> : aircraftFranchiseOptionsError ? <p className="mt-1 text-[10px] text-red-600">{aircraftFranchiseOptionsError}</p> : null}
          </section>

          <section className={sectionClassName}>
            <h3 className={sectionTitleClassName}>Airframe Details</h3>
            <div className="grid gap-2 sm:grid-cols-[160px_1fr_auto] sm:items-center">
              <Label htmlFor="aircraft-template-select" className="font-semibold">* Aircraft Template</Label>
              <select
                id="aircraft-template-select"
                value={aircraftTemplateModel}
                disabled={aircraftTemplateOptionsLoading || disableAircraftModelSelection}
                onChange={(event) => {
                  const selectedTemplateId = event.target.value;
                  setAircraftTemplateModel(selectedTemplateId);
                  setFieldValue('aircraft_template', selectedTemplateId);
                }}
                className={cn(controlClassName, formErrors.aircraft_template && 'border-destructive')}
              >
                {aircraftTemplateSelectOptions.map((option) => (
                  <option key={option.value} value={option.value} disabled={option.disabled}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span />

              <Label htmlFor="aircraft-manufacturer-readonly" className="font-semibold">* Manufacturer</Label>
              <Input
                id="aircraft-manufacturer-readonly"
                value={selectedTemplateManufacturerName || '-'}
                readOnly
                aria-readonly="true"
                className={cn(controlClassName, 'bg-slate-100', formErrors.manufacturer_id && 'border-destructive')}
              />
              <span />

              <Label htmlFor="aircraft-model-name-readonly" className="font-semibold">* Model</Label>
              <Input
                id="aircraft-model-name-readonly"
                value={selectedTemplateModelName || '-'}
                readOnly
                aria-readonly="true"
                className={cn(controlClassName, 'bg-slate-100', formErrors.aircraft_model && 'border-destructive')}
              />
              <span />

              <Label htmlFor="aircraft-type-readonly" className="font-semibold">* Category</Label>
              <Input
                id="aircraft-type-readonly"
                value={selectedTemplateAircraftType || '-'}
                readOnly
                aria-readonly="true"
                className={cn(controlClassName, 'bg-slate-100', formErrors.aircraft_type && 'border-destructive')}
              />
              <span />
            </div>
            <div className="mt-2 space-y-1">
              <Label htmlFor="aircraft-maintenance-program" className="font-semibold">Maintenance Service Program/Provider</Label>
              <Input
                id="aircraft-maintenance-program"
                value={String(formValues.maintenance_program ?? '')}
                onChange={(event) => setFieldValue('maintenance_program', event.target.value)}
                className={cn(controlClassName, formErrors.maintenance_program && 'border-destructive')}
              />
            </div>
          </section>

          <section className={sectionClassName}>
            <h3 className={sectionTitleClassName}>Warranty Details</h3>
            <div className="grid gap-2 sm:grid-cols-[160px_1fr] sm:items-center">
              <Label htmlFor="warranty-enabled" className="font-semibold">Is Aircraft Under Warranty?</Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="warranty-enabled"
                  checked={Boolean(formValues.is_under_warranty)}
                  onCheckedChange={(checked) => setAircraftAuxField('is_under_warranty', checked ? 'true' : 'false')}
                />
              </div>

              <Label htmlFor="warranty-start-date" className="font-semibold">Warranty Start Date</Label>
              <Input
                id="warranty-start-date"
                type="date"
                value={String(formValues.warranty_start_date ?? '')}
                onChange={(event) => setAircraftAuxField('warranty_start_date', event.target.value)}
                className={controlClassName}
              />

              <Label htmlFor="warranty-end-date" className="font-semibold">Warranty End Date</Label>
              <Input
                id="warranty-end-date"
                type="date"
                value={String(formValues.warranty_end_date ?? '')}
                onChange={(event) => setAircraftAuxField('warranty_end_date', event.target.value)}
                className={controlClassName}
              />
            </div>
          </section>
        </div>

        <div className="space-y-3">
          <section className={sectionClassName}>
            <h3 className={sectionTitleClassName}>Total Weight And Capacity</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                ['empty_weight', 'Empty Wt.'],
                ['all_up_weight', 'All Up Wt.'],
                ['gross_payload', 'Gross PayLoad'],
                ['taxi_weight', 'Taxi Wt.'],
                ['takeoff_weight', 'Take Off Wt.'],
                ['zero_fuel_weight', 'Zero Fuel Wt.'],
                ['landing_weight', 'Landing Wt.'],
                ['fuel_capacity', 'Fuel Cap.'],
              ].map(([field, label]) => (
                <div key={field} className="grid grid-cols-[120px_1fr_110px] items-center gap-2">
                  <Label htmlFor={`aircraft-${field}`}>{label}</Label>
                  <Input
                    id={`aircraft-${field}`}
                    value={String(formValues[field] ?? '')}
                    onChange={(event) => setAircraftAuxField(field, event.target.value)}
                    className={controlClassName}
                  />
                  <select
                    id={`aircraft-${field}-unit`}
                    value={String(formValues[`${field}_unit`] ?? '')}
                    onChange={(event) => setAircraftAuxField(`${field}_unit`, event.target.value)}
                    className={controlClassName}
                  >
                    <option value="">(SELECT)</option>
                    {AIRCRAFT_WEIGHT_UNIT_OPTIONS.map((unitOption) => (
                      <option key={`${field}-${unitOption}`} value={unitOption}>
                        {unitOption}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </section>

          <section className={sectionClassName}>
            <h3 className={sectionTitleClassName}>Times Since New Values of Aircraft (TSN)</h3>
            <div className="mb-2 grid grid-cols-[120px_1fr] items-center gap-2">
              <Label htmlFor="aircraft-manufacturing-date" className="font-semibold">* As On Date</Label>
              <div className="relative">
                <Input
                  id="aircraft-manufacturing-date"
                  type="date"
                  value={aircraftManufacturingDate}
                  onChange={(event) => {
                    setAircraftManufacturingDate(event.target.value);
                    setAircraftAuxField('manufacturing_date', event.target.value);
                  }}
                  className={cn(controlClassName, 'pr-8')}
                />
                <CalendarDays className="pointer-events-none absolute right-2 top-2 h-3.5 w-3.5 text-slate-400" />
              </div>
            </div>
            <div className="overflow-x-auto border border-[#7aa4d6]">
              <table className="w-full text-[12px]">
                <thead className="bg-[#3b5f8f] text-white">
                  <tr>
                    <th className="px-2 py-1 text-left font-semibold">Periods</th>
                    <th className="px-2 py-1 text-left font-semibold">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {aircraftCounterRows.map((row) => (
                    <tr key={row.key} className="border-t border-slate-200">
                      <td className="px-2 py-1">{row.name}</td>
                      <td className="px-2 py-1">
                        <Input
                          value={row.initialValue}
                          onChange={(event) => setAircraftCounterValue(row.key, 'initialValue', event.target.value)}
                          className={controlClassName}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={sectionClassName}>
            <h3 className={sectionTitleClassName}>Other Details</h3>
            <div className="grid gap-2 sm:grid-cols-[220px_1fr] sm:items-center">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="aircraft-not-in-use"
                  checked={Boolean(formValues.is_not_in_use)}
                  onCheckedChange={(checked) => setAircraftAuxField('is_not_in_use', checked ? 'true' : 'false')}
                />
                <Label htmlFor="aircraft-not-in-use" className="font-normal">Aircraft not in use</Label>
              </div>
              <Input
                id="aircraft-not-in-use-date"
                type="date"
                value={String(formValues.not_in_use_date ?? '')}
                onChange={(event) => setAircraftAuxField('not_in_use_date', event.target.value)}
                className={controlClassName}
              />

              <div className="flex items-center gap-2">
                <Checkbox
                  id="aircraft-readonly-flag"
                  checked={Boolean(formValues.is_readonly)}
                  onCheckedChange={(checked) => setAircraftAuxField('is_readonly', checked ? 'true' : 'false')}
                />
                <Label htmlFor="aircraft-readonly-flag" className="font-normal">Mark this Aircraft as ReadOnly</Label>
              </div>
              <Input
                id="aircraft-readonly-date"
                type="date"
                value={String(formValues.readonly_date ?? '')}
                onChange={(event) => setAircraftAuxField('readonly_date', event.target.value)}
                className={controlClassName}
              />

              <div className="flex items-center gap-2">
                <Checkbox
                  id="aircraft-utc-flag"
                  checked={Boolean(formValues.is_flight_log_under_utc)}
                  onCheckedChange={(checked) => setAircraftAuxField('is_flight_log_under_utc', checked ? 'true' : 'false')}
                />
                <Label htmlFor="aircraft-utc-flag" className="font-normal">Is Flight Log Under UTC?</Label>
              </div>
              <div className="flex gap-2">
                <button type="button" className="rounded border border-[#7aa4d6] bg-[#dbe8f9] px-3 py-1 font-medium text-[#1f3d68]">
                  Attach Dent and Buckle Chart
                </button>
                <button type="button" className="rounded border border-slate-300 bg-slate-100 px-3 py-1 text-slate-500">
                  Remove Attachment
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {aircraftAuditTimeline.map((item) => (
          <div key={item.label} className="rounded border border-[#c5d7ef] bg-white px-2 py-1 text-slate-700">
            <p className="text-[10px]">{item.label}</p>
            <p className="text-[11px] font-medium">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

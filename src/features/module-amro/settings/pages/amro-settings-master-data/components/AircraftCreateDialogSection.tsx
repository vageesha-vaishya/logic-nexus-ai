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

type FieldDescriptor = {
  key: string;
  label: string;
  type: string;
};

type AircraftTemplateModelOption = {
  id: string;
  aircraftType?: string;
  manufacturerId?: string;
  aircraftModel?: string;
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
  aircraftTenantOptionsError: string;
  aircraftFranchiseOptionsError: string;
  isSystemSelectValue: (value: string) => boolean;
  setAircraftTemplateModel: (value: string) => void;
  setAircraftTenantValue: (value: string) => void;
  setAircraftFranchiseValue: (value: string) => void;
  setAircraftAuxField: (field: string, value: string) => void;
  systemTemplateModelOptions: AircraftTemplateModelOption[];
  franchiseAssemblyModelOptions: AircraftTemplateModelOption[];
  setFieldValue: (field: string, value: unknown) => void;
  hydrateAircraftCountersFromTemplate: (templateId: string) => Promise<void>;
  systemTemplateModelSelectOptions: SelectOption[];
  franchiseAssemblyModelSelectOptions: SelectOption[];
  aircraftTenantSelectOptions: SelectOption[];
  aircraftFranchiseSelectOptions: SelectOption[];
  disableAircraftFranchiseSelection: boolean;
  disableAircraftModelSelection: boolean;
  formValues: Record<string, unknown>;
  formErrors: Record<string, string>;
  firstFieldRef: RefObject<HTMLInputElement>;
  aircraftModelNameValue: string;
  aircraftModelTypeValue: string;
  setSelectFieldValue: (field: string, value: string) => void;
  resolveSelectOptions: (field: FieldDescriptor) => SelectOption[];
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
  aircraftTenantOptionsError,
  aircraftFranchiseOptionsError,
  isSystemSelectValue,
  setAircraftTemplateModel,
  setAircraftTenantValue,
  setAircraftFranchiseValue,
  setAircraftAuxField,
  systemTemplateModelOptions,
  franchiseAssemblyModelOptions,
  setFieldValue,
  hydrateAircraftCountersFromTemplate,
  systemTemplateModelSelectOptions,
  franchiseAssemblyModelSelectOptions,
  aircraftTenantSelectOptions,
  aircraftFranchiseSelectOptions,
  disableAircraftFranchiseSelection,
  disableAircraftModelSelection,
  formValues,
  formErrors,
  firstFieldRef,
  aircraftModelNameValue,
  aircraftModelTypeValue,
  setSelectFieldValue,
  resolveSelectOptions,
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
  return (
    <div className="space-y-3 rounded-md bg-[#08a8bd] p-3 text-[12px]">
      <div className="flex flex-wrap items-center justify-between gap-2 text-white">
        <p className="font-semibold">
          Required Completion {aircraftRequiredProgress.completed}/{aircraftRequiredProgress.total} ({aircraftRequiredProgress.percent}%)
        </p>
        <div className="flex items-center gap-2 text-[11px]">
          <Users className="h-3.5 w-3.5" />
          <span>{collaborationIndicator.status} · {collaborationIndicator.activeEditors} active</span>
          <span>Last sync {collaborationIndicator.lastSeen}</span>
          <span>Errors {aircraftValidationSummary.errorCount}</span>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
        <section className="space-y-2 rounded bg-white p-3">
          <p className="text-[11px] text-slate-600">Aircraft Model</p>
          <Label htmlFor="aircraft-tenant-id" className="text-[12px] font-medium text-slate-800">Tenant</Label>
          <select
            id="aircraft-tenant-id"
            value={aircraftTenantValue}
            disabled={aircraftTenantOptionsLoading}
            onChange={(event) => setAircraftTenantValue(event.target.value)}
            className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-[12px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            {aircraftTenantSelectOptions.map((option) => (
              <option key={option.value} value={option.value} disabled={Boolean(option.disabled)}>
                {option.label}
              </option>
            ))}
          </select>
          {aircraftTenantOptionsError ? <p className="text-[10px] text-red-600">{aircraftTenantOptionsError}</p> : null}
          <Label htmlFor="aircraft-franchise-id" className="text-[12px] font-medium text-slate-800">Franchise</Label>
          <select
            id="aircraft-franchise-id"
            value={aircraftFranchiseValue}
            disabled={disableAircraftFranchiseSelection || aircraftFranchiseOptionsLoading}
            onChange={(event) => setAircraftFranchiseValue(event.target.value)}
            className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-[12px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            {aircraftFranchiseSelectOptions.map((option) => (
              <option key={option.value} value={option.value} disabled={Boolean(option.disabled)}>
                {option.label}
              </option>
            ))}
          </select>
          {aircraftFranchiseOptionsError ? <p className="text-[10px] text-red-600">{aircraftFranchiseOptionsError}</p> : null}
          <Label htmlFor="aircraft-manufacturer-select-left" className="text-[12px] font-medium text-slate-800">Manufacturer</Label>
          <select
            id="aircraft-manufacturer-select-left"
            value={String(formValues.manufacturer_id ?? '')}
            onChange={(event) => setSelectFieldValue('manufacturer_id', event.target.value)}
            className={cn(
              'h-8 w-full rounded-md border border-input bg-white px-2 text-[12px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              formErrors.manufacturer_id && 'border-destructive',
            )}
          >
            {resolveSelectOptions({ key: 'manufacturer_id', label: 'Manufacturer', type: 'select' }).map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>
          {formErrors.manufacturer_id ? <p className="mdm-template-danger">{formErrors.manufacturer_id}</p> : null}
        </section>
        <section className="rounded bg-white p-3">
          <p className="mb-2 text-[11px] text-slate-600">Aircraft Model Details</p>
          <div className="space-y-2 border border-slate-200 px-3 py-2 text-[12px]">
            <div className="space-y-1">
              <Label htmlFor="aircraft-model-select" className="text-[12px]">Aircraft Model:</Label>
              <select
                id="aircraft-model-select"
                value={String(formValues.aircraft_model ?? '')}
                onChange={(event) => setSelectFieldValue('aircraft_model', event.target.value)}
                className={cn(
                  'h-8 w-full rounded-md border border-input bg-white px-2 text-[12px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                  formErrors.aircraft_model && 'border-destructive',
                )}
              >
                {resolveSelectOptions({ key: 'aircraft_model', label: 'Aircraft Model', type: 'select' }).map((option) => (
                  <option key={option.value} value={option.value} disabled={option.disabled}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="aircraft-model-name-readonly" className="text-[12px]">Name:</Label>
              <Input id="aircraft-model-name-readonly" value={aircraftModelNameValue} readOnly disabled className="h-8 bg-slate-100 text-[12px] text-slate-800" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="aircraft-type-select" className="text-[12px]">Aircraft Type:</Label>
              <Input id="aircraft-type-select" value={aircraftModelTypeValue} readOnly disabled className="h-8 bg-slate-100 text-[12px] text-slate-800" />
            </div>
          </div>
        </section>
      </div>
      <div className="grid gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
        <section className="space-y-2 rounded bg-white p-3">
          <p className="text-[11px] text-slate-600">Aircraft definition</p>
          <div className="space-y-1">
            <Label htmlFor="aircraft-registration" className="text-[12px]">Registration</Label>
            <Input
              id="aircraft-registration"
              ref={firstFieldRef}
              value={String(formValues.registration ?? '')}
              onChange={(event) => {
                const value = event.target.value.toUpperCase();
                setFieldValue('registration', value);
                if (!String(formValues.tail_number ?? '').trim()) {
                  setFieldValue('tail_number', value);
                }
              }}
              className={cn('h-8 text-[12px]', formErrors.registration && 'border-destructive')}
            />
            {formErrors.registration ? <p className="mdm-template-danger">{formErrors.registration}</p> : null}
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="aircraft-no-serial" checked={aircraftNoSerialNumber} onCheckedChange={(value) => handleAircraftNoSerialChange(Boolean(value))} />
            <Label htmlFor="aircraft-no-serial" className="text-[12px] font-normal">No Serial number</Label>
          </div>
          <div className="space-y-1">
            <Label htmlFor="aircraft-serial" className="text-[12px]">Serial number</Label>
            <Input
              id="aircraft-serial"
              value={String(formValues.serial_number ?? '')}
              onChange={(event) => setFieldValue('serial_number', event.target.value.toUpperCase())}
              disabled={aircraftNoSerialNumber}
              className={cn('h-8 text-[12px]', formErrors.serial_number && 'border-destructive')}
            />
            {formErrors.serial_number ? <p className="mdm-template-danger">{formErrors.serial_number}</p> : null}
          </div>
          <div className="space-y-1">
            <Label htmlFor="aircraft-engine-type" className="text-[12px]">Engine Type</Label>
            <Input
              id="aircraft-engine-type"
              value={String(formValues.engine_type ?? '')}
              onChange={(event) => setAircraftAuxField('engine_type', event.target.value)}
              className={cn('h-8 text-[12px]', formErrors.engine_type && 'border-destructive')}
            />
            {formErrors.engine_type ? <p className="mdm-template-danger">{formErrors.engine_type}</p> : null}
          </div>
          <div className="space-y-1">
            <Label htmlFor="aircraft-manufacturing-date" className="text-[12px]">Manufacturing Date</Label>
            <div className="relative">
              <Input
                id="aircraft-manufacturing-date"
                type="date"
                value={aircraftManufacturingDate}
                onChange={(event) => {
                  setAircraftManufacturingDate(event.target.value);
                  setAircraftAuxField('manufacturing_date', event.target.value);
                }}
                className="h-8 pr-8 text-[12px]"
              />
              <CalendarDays className="pointer-events-none absolute right-2 top-2 h-3.5 w-3.5 text-slate-400" />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="aircraft-base-select" className="text-[12px]">Base</Label>
            <select
              id="aircraft-base-select"
              value={aircraftBase}
              disabled={aircraftListboxOptionsLoading}
              onChange={(event) => {
                const value = event.target.value;
                setAircraftBase(value);
                setAircraftAuxField('base_location', value);
              }}
              className="h-8 w-full rounded-md border border-input bg-white px-2 text-[12px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {aircraftBaseSelectOptions.map((option) => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="aircraft-owner-select" className="text-[12px]">Owner</Label>
            <select
              id="aircraft-owner-select"
              value={aircraftOwner}
              disabled={aircraftListboxOptionsLoading}
              onChange={(event) => {
                const value = event.target.value;
                setAircraftOwner(value);
                setAircraftAuxField('owner_name', value);
              }}
              className="h-8 w-full rounded-md border border-input bg-white px-2 text-[12px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {aircraftOwnerSelectOptions.map((option) => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="aircraft-line-number" className="text-[12px]">Line number</Label>
            <Input
              id="aircraft-line-number"
              value={aircraftLineNumber}
              onChange={(event) => {
                setAircraftLineNumber(event.target.value);
                setAircraftAuxField('line_number', event.target.value);
              }}
              className="h-8 text-[12px]"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="aircraft-variable-number" className="text-[12px]">Variable number</Label>
            <Input
              id="aircraft-variable-number"
              value={aircraftVariableNumber}
              onChange={(event) => {
                setAircraftVariableNumber(event.target.value);
                setAircraftAuxField('variable_number', event.target.value);
              }}
              className="h-8 text-[12px]"
            />
          </div>
        </section>
        <section className="rounded bg-white p-3">
          <p className="mb-2 text-[11px] text-slate-600">Counters</p>
          <div className="overflow-x-auto border border-slate-200">
            <table className="w-full text-[12px]">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-800">
                  <th className="px-2 py-2 font-semibold">Name</th>
                  <th className="px-2 py-2 font-semibold">Serial number</th>
                  <th className="px-2 py-2 font-semibold">Model</th>
                  <th className="px-2 py-2 font-semibold">Initial Value / Initial Date</th>
                  <th className="px-2 py-2 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {aircraftCounterRows.map((row) => (
                  <tr key={row.key} className="border-t border-slate-100 align-top">
                    <td className="px-2 py-2 text-slate-700">{row.name}</td>
                    <td className="px-2 py-2 text-slate-700">{row.serialNumber}</td>
                    <td className="px-2 py-2 text-slate-700">{row.model}</td>
                    <td className="px-2 py-1">
                      <div className="grid gap-1 sm:grid-cols-[130px_150px]">
                        <Input
                          value={row.initialValue}
                          onChange={(event) => setAircraftCounterValue(row.key, 'initialValue', event.target.value)}
                          className="h-8 text-[12px]"
                        />
                        <div className="relative">
                          <Input
                            type="date"
                            value={row.initialDate}
                            onChange={(event) => setAircraftCounterValue(row.key, 'initialDate', event.target.value)}
                            className="h-8 pr-8 text-[12px]"
                          />
                          <CalendarDays className="pointer-events-none absolute right-2 top-2 h-3.5 w-3.5 text-slate-400" />
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-slate-600">{row.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <section className="space-y-2 rounded bg-white p-3">
        <p className="text-[11px] text-slate-600">Approved maintenance program</p>
        <div className="space-y-1">
          <Label htmlFor="aircraft-maintenance-program" className="text-[12px]">Maintenance Program</Label>
          <Input
            id="aircraft-maintenance-program"
            value={String(formValues.maintenance_program ?? '')}
            onChange={(event) => setFieldValue('maintenance_program', event.target.value)}
            className={cn('h-8 text-[12px]', formErrors.maintenance_program && 'border-destructive')}
          />
          {formErrors.maintenance_program ? <p className="mdm-template-danger">{formErrors.maintenance_program}</p> : null}
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="aircraft-maintenance-revision-number" className="text-[12px]">Revision number</Label>
            <Input
              id="aircraft-maintenance-revision-number"
              value={aircraftMaintenanceRevisionNumber}
              onChange={(event) => {
                setAircraftMaintenanceRevisionNumber(event.target.value);
                setAircraftAuxField('maintenance_revision_number', event.target.value);
              }}
              className="h-8 text-[12px]"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="aircraft-maintenance-amendment-number" className="text-[12px]">Amendment number</Label>
            <Input
              id="aircraft-maintenance-amendment-number"
              value={aircraftAmendmentNumber}
              onChange={(event) => {
                setAircraftAmendmentNumber(event.target.value);
                setAircraftAuxField('amendment_number', event.target.value);
              }}
              className="h-8 text-[12px]"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="aircraft-maintenance-revision-date" className="text-[12px]">Revision date</Label>
            <Input
              id="aircraft-maintenance-revision-date"
              type="date"
              value={aircraftMaintenanceRevisionDate}
              onChange={(event) => {
                setAircraftMaintenanceRevisionDate(event.target.value);
                setAircraftAuxField('maintenance_revision_date', event.target.value);
              }}
              className="h-8 text-[12px]"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="aircraft-maintenance-amendment-date" className="text-[12px]">Amendment date</Label>
            <Input
              id="aircraft-maintenance-amendment-date"
              type="date"
              value={aircraftAmendmentDate}
              onChange={(event) => {
                setAircraftAmendmentDate(event.target.value);
                setAircraftAuxField('amendment_date', event.target.value);
              }}
              className="h-8 text-[12px]"
            />
          </div>
        </div>
      </section>
      <section className="space-y-2 rounded bg-white p-3">
        <p className="text-[11px] text-slate-600">Engine lifecycle records</p>
        <div className="grid gap-2 lg:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="aircraft-engine-install-history" className="text-[12px]">Engine Install History (JSON Array)</Label>
            <Textarea
              id="aircraft-engine-install-history"
              value={String(formValues.engine_install_history ?? '[]')}
              onChange={(event) => setAircraftAuxField('engine_install_history', event.target.value)}
              className={cn('min-h-[96px] text-[12px]', formErrors.engine_install_history && 'border-destructive')}
            />
            {formErrors.engine_install_history ? <p className="mdm-template-danger">{formErrors.engine_install_history}</p> : null}
          </div>
          <div className="space-y-1">
            <Label htmlFor="aircraft-thrust-rating-change-log" className="text-[12px]">Thrust Rating Change Log (JSON Array)</Label>
            <Textarea
              id="aircraft-thrust-rating-change-log"
              value={String(formValues.thrust_rating_change_log ?? '[]')}
              onChange={(event) => setAircraftAuxField('thrust_rating_change_log', event.target.value)}
              className={cn('min-h-[96px] text-[12px]', formErrors.thrust_rating_change_log && 'border-destructive')}
            />
            {formErrors.thrust_rating_change_log ? <p className="mdm-template-danger">{formErrors.thrust_rating_change_log}</p> : null}
          </div>
          <div className="space-y-1">
            <Label htmlFor="aircraft-on-wing-lifecycle-records" className="text-[12px]">On-Wing Lifecycle Records (JSON Array)</Label>
            <Textarea
              id="aircraft-on-wing-lifecycle-records"
              value={String(formValues.on_wing_lifecycle_records ?? '[]')}
              onChange={(event) => setAircraftAuxField('on_wing_lifecycle_records', event.target.value)}
              className={cn('min-h-[96px] text-[12px]', formErrors.on_wing_lifecycle_records && 'border-destructive')}
            />
            {formErrors.on_wing_lifecycle_records ? <p className="mdm-template-danger">{formErrors.on_wing_lifecycle_records}</p> : null}
          </div>
        </div>
      </section>
      <div className="grid gap-2 sm:grid-cols-3">
        {aircraftAuditTimeline.map((item) => (
          <div key={item.label} className="rounded border border-white/40 bg-white/90 px-2 py-1 text-slate-700">
            <p className="text-[10px]">{item.label}</p>
            <p className="text-[11px] font-medium">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

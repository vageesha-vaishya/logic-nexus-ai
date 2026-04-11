import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AircraftCreateDialogSection } from './AircraftCreateDialogSection';

describe('AircraftCreateDialogSection', () => {
  const createProps = () => ({
    aircraftRequiredProgress: { completed: 1, total: 3, percent: 33 },
    collaborationIndicator: { status: 'Live', activeEditors: 1, lastSeen: 'just now' },
    aircraftValidationSummary: { errorCount: 0 },
    aircraftTemplateModel: '',
    aircraftTenantValue: '',
    aircraftFranchiseValue: '',
    aircraftListboxOptionsLoading: false,
    aircraftTenantOptionsLoading: false,
    aircraftFranchiseOptionsLoading: false,
    aircraftTenantOptionsError: '',
    aircraftFranchiseOptionsError: '',
    isSystemSelectValue: (value: string) => value.startsWith('__'),
    setAircraftTemplateModel: vi.fn(),
    setAircraftTenantValue: vi.fn(),
    setAircraftFranchiseValue: vi.fn(),
    setAircraftAuxField: vi.fn(),
    systemTemplateModelOptions: [],
    franchiseAssemblyModelOptions: [],
    setFieldValue: vi.fn(),
    hydrateAircraftCountersFromTemplate: vi.fn(async () => {}),
    systemTemplateModelSelectOptions: [
      { value: '__empty__', label: 'No aircraft templates available', disabled: true },
    ],
    franchiseAssemblyModelSelectOptions: [
      { value: '__empty_assembly_models__', label: 'No models available for selected franchise', disabled: true },
    ],
    aircraftTenantSelectOptions: [
      { value: '', label: 'Select tenant', disabled: true },
      { value: 'tenant-1', label: 'Tenant One' },
    ],
    aircraftFranchiseSelectOptions: [
      { value: '', label: 'Select franchise', disabled: true },
      { value: 'fr-1', label: 'Franchise One' },
    ],
    disableAircraftFranchiseSelection: true,
    disableAircraftModelSelection: true,
    formValues: {},
    formErrors: {},
    firstFieldRef: { current: null },
    aircraftTypeSelectOptions: [{ value: 'NarrowBody', label: 'NarrowBody' }],
    aircraftModelNameValue: '',
    aircraftModelTypeValue: '',
    setSelectFieldValue: vi.fn(),
    resolveSelectOptions: vi.fn(() => [{ value: '', label: 'Select', disabled: true }]),
    aircraftNoSerialNumber: false,
    handleAircraftNoSerialChange: vi.fn(),
    aircraftManufacturingDate: '',
    setAircraftManufacturingDate: vi.fn(),
    aircraftBase: 'Nothing selected',
    setAircraftBase: vi.fn(),
    aircraftBaseSelectOptions: [{ value: 'Nothing selected', label: 'Nothing selected' }],
    aircraftOwner: 'Nothing selected',
    setAircraftOwner: vi.fn(),
    aircraftOwnerSelectOptions: [{ value: 'Nothing selected', label: 'Nothing selected' }],
    aircraftLineNumber: '',
    setAircraftLineNumber: vi.fn(),
    aircraftVariableNumber: '',
    setAircraftVariableNumber: vi.fn(),
    aircraftCounterRows: [],
    setAircraftCounterValue: vi.fn(),
    aircraftMaintenanceRevisionNumber: '',
    setAircraftMaintenanceRevisionNumber: vi.fn(),
    aircraftAmendmentNumber: '',
    setAircraftAmendmentNumber: vi.fn(),
    aircraftMaintenanceRevisionDate: '',
    setAircraftMaintenanceRevisionDate: vi.fn(),
    aircraftAmendmentDate: '',
    setAircraftAmendmentDate: vi.fn(),
    aircraftAuditTimeline: [],
  });

  it('renders Aircraft Model section labels and cascade controls', () => {
    render(<AircraftCreateDialogSection {...createProps()} />);
    expect(screen.getAllByText('Aircraft Model').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Tenant')).toBeInTheDocument();
    expect(screen.getByLabelText('Franchise')).toBeInTheDocument();
    expect(screen.getByLabelText('Manufacturer')).toBeInTheDocument();
  });

  it('disables franchise selector when tenant prerequisite is missing', () => {
    render(<AircraftCreateDialogSection {...createProps()} />);
    expect(screen.getByLabelText('Franchise')).toBeDisabled();
  });

  it('calls tenant and franchise setters on selection changes', async () => {
    const user = userEvent.setup();
    const props = createProps();
    props.disableAircraftFranchiseSelection = false;
    render(<AircraftCreateDialogSection {...props} />);
    await user.selectOptions(screen.getByLabelText('Tenant'), 'tenant-1');
    await user.selectOptions(screen.getByLabelText('Franchise'), 'fr-1');
    expect(props.setAircraftTenantValue).toHaveBeenCalledWith('tenant-1');
    expect(props.setAircraftFranchiseValue).toHaveBeenCalledWith('fr-1');
  });
});

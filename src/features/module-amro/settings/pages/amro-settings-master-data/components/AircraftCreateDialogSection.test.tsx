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
    aircraftTemplateOptionsLoading: false,
    aircraftTenantOptionsError: '',
    aircraftFranchiseOptionsError: '',
    setAircraftTemplateModel: vi.fn(),
    setAircraftTenantValue: vi.fn(),
    setAircraftFranchiseValue: vi.fn(),
    setAircraftAuxField: vi.fn(),
    systemTemplateModelOptions: [],
    franchiseAssemblyModelOptions: [],
    setFieldValue: vi.fn(),
    aircraftTemplateSelectOptions: [
      { value: '__empty__', label: 'No aircraft templates available', disabled: true },
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
    formValues: { registration: '', serial_number: '', aircraft_operators_id: '', aircraft_owners_id: '' },
    formErrors: {},
    firstFieldRef: { current: null },
    selectedTemplateModelName: '',
    selectedTemplateManufacturerName: '',
    selectedTemplateAircraftType: '',
    aircraftNoSerialNumber: false,
    handleAircraftNoSerialChange: vi.fn(),
    aircraftManufacturingDate: '',
    setAircraftManufacturingDate: vi.fn(),
    aircraftBase: 'Nothing selected',
    setAircraftBase: vi.fn(),
    aircraftBaseSelectOptions: [{ value: 'Nothing selected', label: 'Nothing selected' }],
    aircraftOperatorOwner: '',
    setAircraftOperatorOwner: vi.fn(),
    aircraftOperatorOwnerSelectOptions: [
      { value: '', label: 'Nothing selected' },
      { value: '157b8d12-c115-446e-a4dc-d12077751fe2', label: 'Deccan Charters Pvt Ltd (DECCAN)' },
    ],
    aircraftOwner: '',
    setAircraftOwner: vi.fn(),
    aircraftOwnerSelectOptions: [
      { value: '', label: 'Nothing selected' },
      { value: '257b8d12-c115-446e-a4dc-d12077751fe2', label: 'Global Ops Air (GLOBAL_OPS_AIR)' },
    ],
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

  it('renders optional ownership dropdowns', () => {
    render(<AircraftCreateDialogSection {...createProps()} />);
    expect(screen.getByLabelText('Operator Owner')).toBeInTheDocument();
    expect(screen.getByLabelText('Aircraft Owner')).toBeInTheDocument();
    expect(screen.queryByText('* Operator Owner')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Tenant')).toBeInTheDocument();
    expect(screen.getByLabelText(/Franchise/)).toBeInTheDocument();
  });

  it('disables franchise selector when tenant prerequisite is missing', () => {
    render(<AircraftCreateDialogSection {...createProps()} />);
    expect(screen.getByLabelText(/Franchise/)).toBeDisabled();
  });

  it('calls tenant and franchise setters on selection changes', async () => {
    const user = userEvent.setup();
    const props = createProps();
    props.disableAircraftFranchiseSelection = false;
    render(<AircraftCreateDialogSection {...props} />);
    await user.selectOptions(screen.getByLabelText('Tenant'), 'tenant-1');
    await user.selectOptions(screen.getByLabelText(/Franchise/), 'fr-1');
    expect(props.setAircraftTenantValue).toHaveBeenCalledWith('tenant-1');
    expect(props.setAircraftFranchiseValue).toHaveBeenCalledWith('fr-1');
  });

  it('binds owner dropdowns to UUID fields via aux setter', async () => {
    const user = userEvent.setup();
    const props = createProps();
    render(<AircraftCreateDialogSection {...props} />);

    await user.selectOptions(screen.getByLabelText('Operator Owner'), '157b8d12-c115-446e-a4dc-d12077751fe2');
    await user.selectOptions(screen.getByLabelText('Aircraft Owner'), '257b8d12-c115-446e-a4dc-d12077751fe2');

    expect(props.setAircraftOperatorOwner).toHaveBeenCalledWith('157b8d12-c115-446e-a4dc-d12077751fe2');
    expect(props.setAircraftAuxField).toHaveBeenCalledWith('aircraft_operators_id', '157b8d12-c115-446e-a4dc-d12077751fe2');
    expect(props.setAircraftOwner).toHaveBeenCalledWith('257b8d12-c115-446e-a4dc-d12077751fe2');
    expect(props.setAircraftAuxField).toHaveBeenCalledWith('aircraft_owners_id', '257b8d12-c115-446e-a4dc-d12077751fe2');
  });
});

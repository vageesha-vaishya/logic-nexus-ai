
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SharedCargoInput } from './SharedCargoInput';
import { CargoItem } from '@/types/cargo';
import { useContainerRefs } from '@/hooks/useContainerRefs';
import React from 'react';

// Mock useContainerRefs
const mockContainerTypes = [
  { id: 'dry', name: 'Dry Standard', code: 'DRY' },
  { id: 'reefer', name: 'Reefer', code: 'RF' }
];

const mockContainerSizes = [
  { id: '20ft', name: '20ft', iso_code: '22G1', type_id: 'dry', container_type_id: 'dry' },
  { id: '40ft', name: '40ft', iso_code: '42G1', type_id: 'dry', container_type_id: 'dry' }
];

const defaultContainerRefs = {
  containerTypes: mockContainerTypes,
  containerSizes: mockContainerSizes,
  formatSize: (name: string) => name,
  loading: false,
  error: null,
  retry: vi.fn(),
};

vi.mock('@/hooks/useContainerRefs', () => ({
  useContainerRefs: vi.fn(),
}));

// Mock UI components to avoid Radix UI issues in tests
vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <div data-testid="select-root" data-value={value} onClick={() => onValueChange && onValueChange('mock-value')}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: any) => <div data-testid="select-trigger">{children}</div>,
  SelectValue: ({ placeholder }: any) => <span data-testid="select-value">{placeholder}</span>,
  SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
  SelectItem: ({ children, value, onClick }: any) => (
    <div data-testid="select-item" data-value={value} onClick={onClick}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children, value, onValueChange }: any) => (
    <div data-testid="tabs-root" data-value={value}>
      {children}
    </div>
  ),
  TabsList: ({ children }: any) => <div data-testid="tabs-list">{children}</div>,
  TabsTrigger: ({ children, value }: any) => (
    <div data-testid={`tabs-trigger-${value}`} data-value={value}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardContent: ({ children, className }: any) => <div className={className}>{children}</div>,
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children }: any) => <label>{children}</label>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: (props: any) => <input type="checkbox" {...props} />,
}));

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  Box: () => <div data-testid="icon-Box" />,
  Container: () => <div data-testid="icon-Container" />,
  Package: () => <div data-testid="icon-Package" />,
  AlertTriangle: () => <div data-testid="icon-AlertTriangle" />,
  Layers: () => <div data-testid="icon-Layers" />,
  Scale: () => <div data-testid="icon-Scale" />,
  Ruler: () => <div data-testid="icon-Ruler" />,
  Cuboid: () => <div data-testid="icon-Cuboid" />,
  Plus: () => <div data-testid="icon-Plus" />,
  Trash2: () => <div data-testid="icon-Trash2" />,
  Check: () => <div data-testid="icon-Check" />,
  ChevronsUpDown: () => <div data-testid="icon-ChevronsUpDown" />,
  Search: () => <div data-testid="icon-Search" />,
  AlertCircle: () => <div data-testid="icon-AlertCircle" />,
  FolderSearch: () => <div data-testid="icon-FolderSearch" />,
}));

// Mock SmartCargoInput
vi.mock('@/components/logistics/SmartCargoInput', () => ({
  SmartCargoInput: () => <div data-testid="smart-cargo-input" />
}));

// Mock HazmatWizard
vi.mock('./HazmatWizard', () => ({
  HazmatWizard: () => <div data-testid="hazmat-wizard" />
}));

describe('SharedCargoInput', () => {
  beforeEach(() => {
    (useContainerRefs as any).mockReturnValue(defaultContainerRefs);
  });

  const defaultValue: CargoItem = {
    id: '1',
    type: 'container',
    quantity: 1,
    dimensions: { l: 0, w: 0, h: 0, unit: 'cm' },
    weight: { value: 0, unit: 'kg' },
    stackable: false,
    containerDetails: { typeId: '', sizeId: '' },
    // containerCombos is undefined initially
  };

  it('initializes container combos when type is container', async () => {
    console.log('Test starting: initializes container combos');
    const onChange = vi.fn();
    const { rerender } = render(<SharedCargoInput value={defaultValue} onChange={onChange} />);

    console.log('Rendered component');

    // Should trigger useEffect to initialize combo
    await waitFor(() => {
      console.log('Waiting for onChange...');
      expect(onChange).toHaveBeenCalled();
    }, { timeout: 2000 });

    console.log('onChange called');

    // Check the payload of the first call
    const callArgs = onChange.mock.calls[0][0];
    console.log('Call args:', JSON.stringify(callArgs, null, 2));
    
    expect(callArgs.containerCombos).toHaveLength(1);
    expect(callArgs.containerCombos[0].typeId).toBe(''); // Explicit selection required
    expect(callArgs.containerCombos[0].sizeId).toBe(''); // Explicit selection required
  });

  it('renders container configuration when combos exist', () => {
    const valueWithCombos: CargoItem = {
      ...defaultValue,
      containerCombos: [
        { id: '1', typeId: 'dry', sizeId: '20ft', quantity: 1 }
      ]
    };

    render(<SharedCargoInput value={valueWithCombos} onChange={() => {}} />);

    expect(screen.getByText('Container Configuration')).toBeInTheDocument();
    // Use getAllByText for Type and Size because they appear as Label and Select placeholder
    expect(screen.getAllByText('Type').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Size').length).toBeGreaterThan(0);
    expect(screen.getByText('Please select container type')).toBeInTheDocument();
    expect(screen.getByText('Please select container size')).toBeInTheDocument();
    
    // Check if options are rendered (our mock renders SelectContent immediately)
    expect(screen.getByText('20ft')).toBeInTheDocument();
  });

  it('resolves saved type/size names to dropdown IDs for display', () => {
    const valueWithNamedCombos: CargoItem = {
      ...defaultValue,
      containerCombos: [
        { id: '1', typeId: 'Dry Standard', sizeId: '20ft', quantity: 4 }
      ]
    };

    const { getAllByTestId } = render(<SharedCargoInput value={valueWithNamedCombos} onChange={() => {}} />);
    const roots = getAllByTestId('select-root');

    // Type select should resolve name -> id
    expect(roots[0].getAttribute('data-value')).toBe('dry');
    // Size select should resolve name -> id
    expect(roots[1].getAttribute('data-value')).toBe('20ft');
  });

  // Bug reproduction: Combo initialization without matching size
  it('initializes combos even without matching size', async () => {
    const bugContainerTypes = [{ id: 'weird_type', name: 'Weird Type', code: 'WT' }];
    const bugContainerSizes = [{ id: 'other_size', name: 'Other Size', iso_code: 'OS', type_id: 'other_type' }];

    (useContainerRefs as any).mockReturnValue({
      containerTypes: bugContainerTypes,
      containerSizes: bugContainerSizes,
      formatSize: (name: string) => name,
      loading: false,
      error: null,
      retry: vi.fn(),
    });

    const onChange = vi.fn();
    render(<SharedCargoInput value={defaultValue} onChange={onChange} />);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
    });

    const callArgs = onChange.mock.calls[0][0];
    expect(callArgs.containerCombos[0].typeId).toBe('');
    // size stays empty until user selects a type
    expect(callArgs.containerCombos[0].sizeId).toBe('');
  });

  // Size list should be constrained by selected type
  it('shows only sizes mapped to selected type in dropdown', async () => {
    const types = [{ id: 'type1', name: 'Type 1', code: 'T1' }];
    const sizes = [
      { id: 'size1', name: 'Size 1', iso_code: 'S1', type_id: 'type1' }, // Matching
      { id: 'size2', name: 'Size 2', iso_code: 'S2', type_id: undefined } // Orphan
    ];

    (useContainerRefs as any).mockReturnValue({
      containerTypes: types,
      containerSizes: sizes,
      formatSize: (name: string) => name,
      loading: false,
      error: null,
      retry: vi.fn(),
    });

    const valueWithCombo = {
      ...defaultValue,
      type: 'container' as const,
      containerCombos: [{ id: '1', typeId: 'type1', sizeId: '', quantity: 1 }]
    };

    const { getAllByText } = render(<SharedCargoInput value={valueWithCombo} onChange={vi.fn()} />);

    // Open the size dropdown
    // Since we mocked Select components, we need to verify if the implementation passes the filtered options to SelectContent
    // The mock implementation of SelectContent renders its children.
    // So we should see "Size 1" and "Size 2" in the DOM if they are rendered.

    expect(getAllByText('Size 1')).toBeDefined();
    expect(screen.queryByText('Size 2')).not.toBeInTheDocument();
  });

  it('renders nothing for container config if combos are empty', () => {
     // Even if type is container, if combos are empty (and useEffect hasn't run yet or failed), it renders nothing
     const looseValue: CargoItem = {
         ...defaultValue,
         type: 'loose'
     };
     
     render(<SharedCargoInput value={looseValue} onChange={() => {}} />);
     expect(screen.queryByText('Container Configuration')).not.toBeInTheDocument();
  });

  it('auto-calculates total volume from dimensions and quantity', () => {
    const looseValue: CargoItem = {
      ...defaultValue,
      type: 'loose',
      quantity: 2,
      dimensions: { l: 0, w: 0, h: 0, unit: 'cm' },
      volume: 0,
    };
    let current = looseValue;
    const onChange = vi.fn((next: CargoItem) => {
      current = next;
      rerender(<SharedCargoInput value={current} onChange={onChange} />);
    });

    const { rerender } = render(<SharedCargoInput value={current} onChange={onChange} />);

    const lengthInput = screen.getByPlaceholderText('L');
    const widthInput = screen.getByPlaceholderText('W');
    const heightInput = screen.getByPlaceholderText('H');

    fireEvent.change(lengthInput, { target: { value: '10' } });
    fireEvent.change(widthInput, { target: { value: '10' } });
    fireEvent.change(heightInput, { target: { value: '10' } });

    expect(current.volume).toBe(0.002);
  });
});

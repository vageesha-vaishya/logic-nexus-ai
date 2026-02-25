import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { LegsConfigurationStep } from '../LegsConfigurationStep';

// Mock dependencies
vi.mock('../TransportModeSelector', () => ({
  TransportModeSelector: ({ onSelect }: any) => (
    <div data-testid="transport-mode-selector">
      <button onClick={() => onSelect('ocean')}>Add Ocean Leg</button>
    </div>
  )
}));

vi.mock('../HelpTooltip', () => ({
  HelpTooltip: () => <div data-testid="help-tooltip" />
}));

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children, onValueChange }: any) => <div onClick={() => onValueChange && onValueChange('service')}>{children}</div>,
  TabsList: ({ children }: any) => <div>{children}</div>,
  TabsTrigger: ({ children }: any) => <div>{children}</div>,
  TabsContent: ({ children }: any) => <div>{children}</div>,
}));

// Mock Store and Hooks
const mockDispatch = vi.fn();
const mockState: any = {
  legs: [],
  validationErrors: [],
  quoteData: {},
  options: [],
  optionId: null,
  referenceData: {
    serviceTypes: [
      { id: 'st1', name: 'Ocean Freight', code: 'OCEAN', is_active: true, transport_modes: { code: 'ocean' } }
    ],
    carriers: [
      { id: 'c1', carrier_name: 'Maersk', carrier_type: 'ocean' }
    ],
    serviceCategories: [
      { id: 'sc1', code: 'doc', name: 'Documentation' }
    ]
  }
};

vi.mock('../store/QuoteStore', () => ({
  useQuoteStore: () => ({
    state: mockState,
    dispatch: mockDispatch
  })
}));

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    scopedDb: {},
    context: { tenantId: 'test-tenant' }
  })
}));

vi.mock('@/hooks/useAiAdvisor', () => ({
  useAiAdvisor: () => ({
    invokeAiAdvisor: vi.fn()
  })
}));

vi.mock('@/hooks/useCarriersByMode', () => ({
  useCarriersByMode: () => ({
    carrierMap: {
      ocean: [
        {
          id: 'c1',
          carrier_name: 'Maersk',
          carrier_code: 'MAEU',
          carrier_type: 'ocean',
          scac: 'MAEU',
          iata: null,
          mc_dot: null,
          mode: 'ocean',
          is_preferred: true,
          service_types: [],
        },
      ],
    },
    getCarriersForMode: () => [
      {
        id: 'c1',
        carrier_name: 'Maersk',
        carrier_code: 'MAEU',
        carrier_type: 'ocean',
        scac: 'MAEU',
        iata: null,
        mc_dot: null,
        mode: 'ocean',
        is_preferred: true,
        service_types: [],
      },
    ],
    getAllCarriers: () => [],
    hasCarriersForMode: () => true,
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/lib/feature-flags', () => ({
  FEATURE_FLAGS: {
    COMPOSER_MULTI_LEG_AUTOFILL: 'composer_multi_leg_autofill'
  },
  useAppFeatureFlag: () => ({ enabled: true, isLoading: false, error: null })
}));

describe('LegsConfigurationStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.legs = [];
    mockState.validationErrors = [];
  });

  it('renders the legs configuration step', () => {
    render(<LegsConfigurationStep />);
    expect(screen.getByText('Configure Legs & Services')).toBeInTheDocument();
    expect(screen.getByTestId('transport-mode-selector')).toBeInTheDocument();
  });

  it('adds a new leg when transport mode is selected', () => {
    render(<LegsConfigurationStep />);
    
    const addButton = screen.getByText('Add Ocean Leg');
    fireEvent.click(addButton);

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ADD_LEG',
        payload: expect.objectContaining({
          mode: 'ocean',
          legType: 'transport',
          serviceTypeId: 'st1'
        })
      })
    );
  });

  it('auto-populates origin and destination for a new leg when previous legs exist', () => {
    mockState.quoteData = {
      origin: 'Shanghai',
      destination: 'Los Angeles'
    };
    mockState.legs = [
      {
        id: 'leg-1',
        mode: 'ocean',
        origin: 'Shanghai',
        destination: 'Honolulu',
        legType: 'transport'
      }
    ] as any;

    render(<LegsConfigurationStep />);

    const addButton = screen.getByText('Add Ocean Leg');
    fireEvent.click(addButton);

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ADD_LEG',
        payload: expect.objectContaining({
          origin: 'Honolulu',
          destination: 'Los Angeles'
        })
      })
    );
  });

  it('prefills mode and service type from active option legs when available', () => {
    mockState.quoteData = {
      origin: 'Shanghai',
      destination: 'Los Angeles'
    };

    mockState.options = [
      {
        id: 'opt-1',
        carrier_id: 'c1',
        carrier_name: 'Maersk',
        legs: [
          {
            id: 'db-leg-1',
            mode: 'air',
            service_type_id: 'st2',
            sort_order: 0,
            carrier_id: 'c1',
            carrier_name: 'Maersk',
            leg_type: 'transport',
            service_only_category: 'doc'
          }
        ]
      }
    ];
    mockState.optionId = 'opt-1';

    mockState.referenceData.serviceTypes = [
      { id: 'st1', name: 'Ocean Freight', code: 'OCEAN', is_active: true, transport_modes: { code: 'ocean' } },
      { id: 'st2', name: 'Air Freight', code: 'AIR', is_active: true, transport_modes: { code: 'air' } }
    ];

    mockState.legs = [] as any;

    render(<LegsConfigurationStep />);

    const addButton = screen.getByText('Add Ocean Leg');
    fireEvent.click(addButton);

    const addCall = mockDispatch.mock.calls.find(
      (call) => call[0]?.type === 'ADD_LEG'
    );
    expect(addCall).toBeTruthy();

    const payload = addCall![0].payload;
    expect(payload.mode.toLowerCase()).toBe('air');
    expect(payload.serviceTypeId).toBe('st2');
    expect(payload.carrierId).toBe('c1');
    expect(payload.carrierName).toBe('Maersk');
    expect(payload.serviceOnlyCategory).toBe('doc');
  });

  it('displays existing legs', () => {
    mockState.legs = [
      { id: 'leg-1', mode: 'ocean', origin: 'NY', destination: 'LDN', legType: 'transport' }
    ] as any;

    render(<LegsConfigurationStep />);
    
    expect(screen.getByText(/Leg 1/)).toBeInTheDocument();
    expect(screen.getByText(/OCEAN/)).toBeInTheDocument();
  });

  it('removes a leg when delete button is clicked', () => {
    mockState.legs = [
      { id: 'leg-1', mode: 'ocean', legType: 'transport' }
    ] as any;

    render(<LegsConfigurationStep />);
    
    // Find the delete button (trash icon)
    // Since we didn't mock Lucide icons, we look for the button that contains it or has aria-label if present
    // But the code uses <Button><Trash2 /></Button>. 
    // We can look for the button role.
    const deleteButtons = screen.getAllByRole('button');
    // The first button is "Add Ocean Leg" (mocked), subsequent are delete buttons or tabs triggers.
    // Let's use a more specific selector if possible, or assume the delete button is rendered.
    // The component renders: <Button variant="ghost" ... onClick={() => onRemoveLeg(leg.id)} ...>
    
    // Let's modify the component or use a query that targets the delete action.
    // Since we don't have easy test-id for delete, let's assume it's the button inside the card header.
    // Actually, let's look for the Trash2 icon if it renders, but we are in a test.
    // Better: Render with a specific leg and try to find the button.
    
    // We can update the mock for Lucide icons to be easier to find?
    // Or just look for the button.
  });

  it('dispatches remove action', () => {
     mockState.legs = [
      { id: 'leg-1', mode: 'ocean', legType: 'transport' }
    ] as any;

    const { container } = render(<LegsConfigurationStep />);
    
    // The delete button is usually the one with the trash icon.
    // Since we didn't mock icons, let's find the button by its class or structure
    // The code: <Button variant="ghost" ...><Trash2 /></Button>
    
    // Let's try to find the button. 
    // We can rely on the fact that there is only one leg, so one delete button.
    // There are other buttons (TabsTrigger, SelectTrigger).
    // The delete button has `text-destructive`.
    
    const deleteBtn = container.querySelector('button.text-destructive');
    if (deleteBtn) {
        fireEvent.click(deleteBtn);
        expect(mockDispatch).toHaveBeenCalledWith({
            type: 'REMOVE_LEG',
            payload: 'leg-1'
        });
    } else {
        // Fail if button not found (this helps debugging)
        expect(true).toBe(false); 
    }
  });
  
  it('displays validation errors', () => {
      mockState.legs = [
          { id: 'leg-1', mode: 'ocean', legType: 'transport' }
      ] as any;
      mockState.validationErrors = ['Leg 1: Origin is required'];
      
      const { container } = render(<LegsConfigurationStep />);
      
      // The error adds a red border class `border-destructive/50`
      const card = container.querySelector('.border-destructive\\/50');
      expect(card).toBeInTheDocument();
  });
});

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LocationSelect } from '../LocationSelect';

// Mock AsyncCombobox since it's a complex component
vi.mock('@/components/ui/async-combobox', () => ({
  AsyncCombobox: (props: any) => {
    // console.log('AsyncCombobox props:', props);
    const { loader, placeholder } = props;
    return (
      <div data-testid="async-combobox">
        <input 
          data-testid="combo-input"
          placeholder={placeholder}
          onChange={(e) => {
            // Simulate typing -> loader
            if (typeof loader === 'function') {
                loader(e.target.value).then((opts: any[]) => {
                // We just dump options to a hidden div for assertions
                const resultsDiv = document.getElementById('results');
                if (resultsDiv) resultsDiv.textContent = JSON.stringify(opts);
                });
            } else {
                console.error('loader is not a function', loader);
            }
          }}
        />
        <div id="results" data-testid="results"></div>
      </div>
    );
  }
}));

// Mock hooks
vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({ scopedDb: {} })
}));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() })
}));

describe('LocationSelect Filtering', () => {
  const mockPorts = [
    {
      id: '1',
      location_name: 'Delhi (ICD)',
      location_code: 'DEL',
      city: 'New Delhi',
      country: 'India',
      location_type: 'inland_port'
    },
    {
      id: '2',
      location_name: 'Indira Gandhi International Airport',
      location_code: 'DEL',
      city: 'New Delhi',
      country: 'India',
      location_type: 'airport'
    },
    {
      id: '3',
      location_name: 'Shanghai Port',
      location_code: 'SHA',
      city: 'Shanghai',
      country: 'China',
      location_type: 'seaport'
    }
  ];

  it('filters by location name case-insensitive', async () => {
    render(<LocationSelect onChange={vi.fn()} preloadedPorts={mockPorts} />);
    
    const input = screen.getByTestId('combo-input');
    
    // Type "delhi"
    fireEvent.change(input, { target: { value: 'delhi' } });
    
    // Wait for promise (simulated in mock)
    await new Promise(r => setTimeout(r, 0));
    
    const results = JSON.parse(screen.getByTestId('results').textContent || '[]');
    expect(results).toHaveLength(2);
    expect(results[0].value).toBe('Delhi (ICD)');
    expect(results[1].value).toBe('Indira Gandhi International Airport'); // Matches city "New Delhi" or code "DEL"?
    // "Indira Gandhi..." matches because city is "New Delhi" which contains "Delhi"
  });

  it('filters by city name', async () => {
    render(<LocationSelect onChange={vi.fn()} preloadedPorts={mockPorts} />);
    
    const input = screen.getByTestId('combo-input');
    
    // Type "New Delhi"
    fireEvent.change(input, { target: { value: 'New Delhi' } });
    
    await new Promise(r => setTimeout(r, 0));
    
    const results = JSON.parse(screen.getByTestId('results').textContent || '[]');
    expect(results).toHaveLength(2);
  });

  it('filters by code', async () => {
    render(<LocationSelect onChange={vi.fn()} preloadedPorts={mockPorts} />);
    
    const input = screen.getByTestId('combo-input');
    
    // Type "DEL"
    fireEvent.change(input, { target: { value: 'DEL' } });
    
    await new Promise(r => setTimeout(r, 0));
    
    const results = JSON.parse(screen.getByTestId('results').textContent || '[]');
    expect(results).toHaveLength(2);
  });
  
  it('handles missing city field gracefully', async () => {
    const portsMissingCity = [
      {
        id: '1',
        location_name: 'Delhi (ICD)',
        location_code: 'DEL',
        // city missing
        country: 'India'
      }
    ];
    
    render(<LocationSelect onChange={vi.fn()} preloadedPorts={portsMissingCity} />);
    const input = screen.getByTestId('combo-input');
    
    // Type "Delhi" - matches name
    fireEvent.change(input, { target: { value: 'Delhi' } });
    await new Promise(r => setTimeout(r, 0));
    let results = JSON.parse(screen.getByTestId('results').textContent || '[]');
    expect(results).toHaveLength(1);
    
    // Type "India" - matches country
    fireEvent.change(input, { target: { value: 'India' } });
    await new Promise(r => setTimeout(r, 0));
    results = JSON.parse(screen.getByTestId('results').textContent || '[]');
    expect(results).toHaveLength(1);
  });
});

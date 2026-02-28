import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CarrierSelect } from '../CarrierSelect';
import { vi } from 'vitest';

// Mock useCarriersByMode
const mockGetCarriersForMode = vi.fn();
vi.mock('@/hooks/useCarriersByMode', () => ({
  useCarriersByMode: () => ({
    getCarriersForMode: mockGetCarriersForMode,
    isLoading: false,
    error: null,
  }),
}));

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();

const mockCarriers = [
  { id: '1', carrier_name: 'Ocean Express', is_preferred: true },
  { id: '2', carrier_name: 'Air Cargo Inc', is_preferred: false },
  { id: '3', carrier_name: 'Fast Track', is_preferred: true },
];

describe('CarrierSelect', () => {
  beforeEach(() => {
    mockGetCarriersForMode.mockReturnValue(mockCarriers);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders placeholder when no value is selected', () => {
    render(<CarrierSelect onChange={() => {}} mode="ocean" />);
    expect(screen.getByText('Select carrier...')).toBeInTheDocument();
  });

  it('renders selected carrier name', () => {
    render(<CarrierSelect onChange={() => {}} value="1" mode="ocean" />);
    expect(screen.getByText('Ocean Express')).toBeInTheDocument();
  });

  it('filters carriers by mode', () => {
    render(<CarrierSelect onChange={() => {}} mode="air" />);
    expect(mockGetCarriersForMode).toHaveBeenCalledWith('air');
  });

  it('opens combobox and displays carriers', async () => {
    render(<CarrierSelect onChange={() => {}} mode="ocean" />);
    
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    expect(screen.getByPlaceholderText('Search carrier...')).toBeInTheDocument();
    expect(screen.getByText('Ocean Express')).toBeInTheDocument();
    expect(screen.getByText('Air Cargo Inc')).toBeInTheDocument();
  });

  it('calls onChange when a carrier is selected', async () => {
    const handleChange = vi.fn();
    render(<CarrierSelect onChange={handleChange} mode="ocean" />);
    
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    const option = screen.getByText('Air Cargo Inc');
    fireEvent.click(option);

    expect(handleChange).toHaveBeenCalledWith('2', 'Air Cargo Inc');
  });

  it('displays preferred badge for preferred carriers', async () => {
    render(<CarrierSelect onChange={() => {}} mode="ocean" />);
    
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    // Check if the badge exists near Ocean Express
    const oceanExpress = screen.getByText('Ocean Express');
    // We expect the badge "Pref" to be visible
    expect(screen.getAllByText('Pref')[0]).toBeInTheDocument();
  });
});

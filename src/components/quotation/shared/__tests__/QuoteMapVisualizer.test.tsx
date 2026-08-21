import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QuoteMapVisualizer } from '../QuoteMapVisualizer';

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, bounds }: any) => (
    <div data-testid="mock-map-container" data-bounds={JSON.stringify(bounds)}>{children}</div>
  ),
  TileLayer: () => <div data-testid="mock-tile-layer" />,
  CircleMarker: ({ children, center }: any) => (
    <div data-testid="mock-circle-marker" data-center={JSON.stringify(center)}>{children}</div>
  ),
  Polyline: ({ pathOptions }: any) => (
    <div data-testid="mock-polyline" data-color={pathOptions?.color} />
  ),
  Tooltip: ({ children }: any) => <div data-testid="mock-tooltip">{children}</div>,
}));

const OCEAN_LEG_RESOLVED = {
  from: 'Shanghai',
  to: 'Los Angeles',
  origin: 'Shanghai',
  destination: 'Los Angeles',
  mode: 'ocean',
  transit_time: '21 days',
  carrier: 'Test Carrier',
  originCoordinates: { lat: 31.2, lng: 121.5 },
  destinationCoordinates: { lat: 33.7, lng: -118.2 },
};

const ROAD_LEG_RESOLVED = {
  from: 'Los Angeles',
  to: 'Chicago',
  origin: 'Los Angeles',
  destination: 'Chicago',
  mode: 'road',
  originCoordinates: { lat: 33.7, lng: -118.2 },
  destinationCoordinates: { lat: 41.8, lng: -87.6 },
};

const UNRESOLVED_LEG = {
  from: 'Nowhereville',
  to: 'Somewhereton',
  mode: 'road',
};

describe('QuoteMapVisualizer', () => {
  it('renders the real map when every leg has resolved coordinates', () => {
    render(<QuoteMapVisualizer origin="Shanghai" destination="Los Angeles" legs={[OCEAN_LEG_RESOLVED]} />);
    expect(screen.getByTestId('mock-map-container')).toBeInTheDocument();
    expect(screen.getAllByTestId('mock-circle-marker')).toHaveLength(2);
    expect(screen.getAllByTestId('mock-polyline')).toHaveLength(1);
    expect(screen.queryByText(/Schematic View/i)).not.toBeInTheDocument();
  });

  it('falls back to the schematic view when any leg is missing coordinates', () => {
    render(<QuoteMapVisualizer origin="Shanghai" destination="Somewhereton" legs={[OCEAN_LEG_RESOLVED, UNRESOLVED_LEG]} />);
    expect(screen.queryByTestId('mock-map-container')).not.toBeInTheDocument();
    expect(screen.getByText(/Schematic View/i)).toBeInTheDocument();
  });

  it('falls back to the schematic view when legs is empty', () => {
    render(<QuoteMapVisualizer origin="Shanghai" destination="Los Angeles" legs={[]} />);
    expect(screen.queryByTestId('mock-map-container')).not.toBeInTheDocument();
    expect(screen.getByText(/Schematic View/i)).toBeInTheDocument();
  });

  it('draws one polyline per leg, colored by mode, and one CircleMarker per stop', () => {
    render(<QuoteMapVisualizer origin="Shanghai" destination="Chicago" legs={[OCEAN_LEG_RESOLVED, ROAD_LEG_RESOLVED]} />);
    const polylines = screen.getAllByTestId('mock-polyline');
    expect(polylines).toHaveLength(2);
    expect(polylines[0]).toHaveAttribute('data-color', '#2563eb');
    expect(polylines[1]).toHaveAttribute('data-color', '#d97706');
    expect(screen.getAllByTestId('mock-circle-marker')).toHaveLength(3);
  });

  it('still shows the mode-count badges on the real-map branch', () => {
    render(<QuoteMapVisualizer origin="Shanghai" destination="Los Angeles" legs={[OCEAN_LEG_RESOLVED]} />);
    expect(screen.getByText('1 Ocean')).toBeInTheDocument();
  });

  it('still shows the mode-count badges on the schematic fallback branch (pre-existing behavior)', () => {
    render(<QuoteMapVisualizer origin="Shanghai" destination="Somewhereton" legs={[UNRESOLVED_LEG]} />);
    expect(screen.getByText('1 Road')).toBeInTheDocument();
  });
});

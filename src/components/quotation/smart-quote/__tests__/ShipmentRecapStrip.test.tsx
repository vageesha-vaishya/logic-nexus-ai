import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ShipmentRecapStrip } from '../ShipmentRecapStrip';

describe('ShipmentRecapStrip', () => {
  it('renders nothing when origin is empty', () => {
    const { container } = render(
      <ShipmentRecapStrip mode="ocean" origin="" destination="USLAX" cargoSummary="2 x 40HC" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when destination is empty', () => {
    const { container } = render(
      <ShipmentRecapStrip mode="ocean" origin="CNSHA" destination="" cargoSummary="2 x 40HC" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders mode, origin, destination, and cargo chips once both endpoints are set', () => {
    render(<ShipmentRecapStrip mode="ocean" origin="CNSHA" destination="USLAX" cargoSummary="2 x 40HC" />);
    expect(screen.getByText('ocean')).toBeInTheDocument();
    expect(screen.getByText('CNSHA')).toBeInTheDocument();
    expect(screen.getByText('USLAX')).toBeInTheDocument();
    expect(screen.getByText('2 x 40HC')).toBeInTheDocument();
  });

  it('omits the cargo chip when cargoSummary is empty', () => {
    render(<ShipmentRecapStrip mode="ocean" origin="CNSHA" destination="USLAX" cargoSummary="" />);
    expect(screen.getByText('CNSHA')).toBeInTheDocument();
    expect(screen.queryByText('2 x 40HC')).not.toBeInTheDocument();
  });
});

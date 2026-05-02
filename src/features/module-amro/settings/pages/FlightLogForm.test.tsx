import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FlightLogForm, type FlightLogFormSubmitInput, getDefaultFlightLogFormValues } from './FlightLogForm';
import { Dialog, DialogContent } from '@/components/ui/dialog';

describe('FlightLogForm PIC in Command dropdown', () => {
  it('renders pilot/co-pilot options and submits selected crew values', async () => {
    const onSubmit = vi.fn<(_input: FlightLogFormSubmitInput) => Promise<void>>().mockResolvedValue(undefined);
    render(
      <Dialog open>
        <DialogContent>
          <FlightLogForm
            config={{
              mode: 'add',
              title: 'Add Flight Logs',
              description: 'Test form',
              submitLabel: 'Save Flight Log',
              metadataSource: 'test.ui',
            }}
            initialValues={getDefaultFlightLogFormValues({
              aircraftId: 'ac-1',
              departureAirport: 'DEL',
              arrivalAirport: '',
              flightHours: '2.5',
              blockHours: '2.8',
              flightCycles: '1',
            })}
            departureAirportOptions={[
              { id: 'airport-del', name: 'Indira Gandhi International', icaoCode: 'VIDP' },
              { id: 'airport-ccu', name: 'Netaji Subhash Chandra Bose', icaoCode: 'VECC' },
            ]}
            pilotOptions={[
              { userId: 'pilot-1', displayName: 'Captain Rao', email: 'captain.rao@example.com' },
              { userId: 'pilot-2', displayName: 'Captain Iyer', email: 'captain.iyer@example.com' },
            ]}
            coPilotOptions={[
              { userId: 'co-pilot-1', displayName: 'First Officer Das', email: 'fo.das@example.com' },
            ]}
            onCancel={() => undefined}
            onSubmit={onSubmit}
          />
        </DialogContent>
      </Dialog>,
    );

    fireEvent.click(screen.getByLabelText('PIC In Command'));
    fireEvent.click(await screen.findByText('Captain Rao'));
    fireEvent.click(screen.getByLabelText('Co-Pilot'));
    fireEvent.click(await screen.findByText('First Officer Das'));
    fireEvent.click(screen.getByLabelText('Arrival Place'));
    fireEvent.click(await screen.findByText('Netaji Subhash Chandra Bose (VECC)'));
    fireEvent.click(screen.getByRole('button', { name: /Save Flight Log/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.payload.pic_in_command).toBe('Captain Rao');
    expect(submitted.payload.pilot_name).toBe('Captain Rao');
    expect(submitted.payload.co_pilot).toBe('First Officer Das');
    expect(submitted.payload.arrival_airport).toBe('VECC');
  });

  it('shows pilot lookup errors below the PIC dropdown', () => {
    render(
      <Dialog open>
        <DialogContent>
          <FlightLogForm
            config={{
              mode: 'add',
              title: 'Add Flight Logs',
              description: 'Test form',
              submitLabel: 'Save Flight Log',
              metadataSource: 'test.ui',
            }}
            initialValues={getDefaultFlightLogFormValues({
              aircraftId: 'ac-1',
              departureAirport: 'DEL',
              arrivalAirport: 'CCU',
            })}
            pilotOptions={[]}
            pilotOptionsError="Failed to load pilot users"
            onCancel={() => undefined}
            onSubmit={vi.fn().mockResolvedValue(undefined)}
          />
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByText('Failed to load pilot users')).toBeInTheDocument();
  });

  it('shows co-pilot lookup errors below the Co-Pilot dropdown', () => {
    render(
      <Dialog open>
        <DialogContent>
          <FlightLogForm
            config={{
              mode: 'add',
              title: 'Add Flight Logs',
              description: 'Test form',
              submitLabel: 'Save Flight Log',
              metadataSource: 'test.ui',
            }}
            initialValues={getDefaultFlightLogFormValues({
              aircraftId: 'ac-1',
              departureAirport: 'DEL',
              arrivalAirport: 'CCU',
            })}
            coPilotOptions={[]}
            coPilotOptionsError="Failed to load co-pilot users"
            onCancel={() => undefined}
            onSubmit={vi.fn().mockResolvedValue(undefined)}
          />
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByText('Failed to load co-pilot users')).toBeInTheDocument();
  });

  it('applies airport loading/error state to both Departure and Arrival dropdowns', () => {
    render(
      <Dialog open>
        <DialogContent>
          <FlightLogForm
            config={{
              mode: 'add',
              title: 'Add Flight Logs',
              description: 'Test form',
              submitLabel: 'Save Flight Log',
              metadataSource: 'test.ui',
            }}
            initialValues={getDefaultFlightLogFormValues({
              aircraftId: 'ac-1',
              departureAirport: '',
              arrivalAirport: '',
            })}
            departureAirportOptionsLoading
            departureAirportOptionsError="Failed to load airports"
            onCancel={() => undefined}
            onSubmit={vi.fn().mockResolvedValue(undefined)}
          />
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByLabelText('Departure Place')).toBeDisabled();
    expect(screen.getByLabelText('Arrival Place')).toBeDisabled();
    expect(screen.getAllByText('Failed to load airports').length).toBeGreaterThan(0);
  });
});

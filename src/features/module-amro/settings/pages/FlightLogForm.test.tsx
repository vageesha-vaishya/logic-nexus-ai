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

  it('auto-populates airframe periods and recalculates final values from entered deltas', () => {
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
              departureAirport: 'VIDP',
              arrivalAirport: 'VECC',
              airframePeriods: [{
                model: 'A320',
                serialNo: 'MSN-1001',
                hours: '0',
                finalHours: '1250',
                landings: '0',
                finalLandings: '950',
                baselineHours: '1250',
                baselineLandings: '950',
              }],
            })}
            onCancel={() => undefined}
            onSubmit={vi.fn().mockResolvedValue(undefined)}
          />
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByDisplayValue('A320')).toBeInTheDocument();
    expect(screen.getByDisplayValue('MSN-1001')).toBeInTheDocument();
    const firstRow = document.querySelector('tbody tr');
    expect(firstRow).toBeTruthy();
    const rowInputs = firstRow!.querySelectorAll('input');
    const hoursInput = rowInputs[2] as HTMLInputElement;
    const finalHoursInput = rowInputs[3] as HTMLInputElement;
    const landingsInput = rowInputs[4] as HTMLInputElement;
    const finalLandingsInput = rowInputs[5] as HTMLInputElement;
    expect(finalHoursInput).toHaveAttribute('readonly');
    expect(finalLandingsInput).toHaveAttribute('readonly');

    fireEvent.change(hoursInput, { target: { value: '2.5' } });
    fireEvent.change(landingsInput, { target: { value: '3' } });
    expect(finalHoursInput.value).toBe('1252.5');
    expect(finalLandingsInput.value).toBe('953');

    fireEvent.change(hoursInput, { target: { value: '' } });
    fireEvent.change(landingsInput, { target: { value: '' } });
    expect(finalHoursInput.value).toBe('1250');
    expect(finalLandingsInput.value).toBe('950');
  });

  it('shows airframe source error when airframe period data is unavailable', () => {
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
              departureAirport: 'VIDP',
              arrivalAirport: 'VECC',
            })}
            airframePeriodsSourceError="Airframe periods source data is unavailable for the selected aircraft."
            onCancel={() => undefined}
            onSubmit={vi.fn().mockResolvedValue(undefined)}
          />
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByText('Airframe periods source data is unavailable for the selected aircraft.')).toBeInTheDocument();
  });
});

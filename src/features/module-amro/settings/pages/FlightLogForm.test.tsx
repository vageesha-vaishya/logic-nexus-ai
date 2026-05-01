import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FlightLogForm, type FlightLogFormSubmitInput, getDefaultFlightLogFormValues } from './FlightLogForm';
import { Dialog, DialogContent } from '@/components/ui/dialog';

describe('FlightLogForm PIC in Command dropdown', () => {
  it('renders pilot options and submits selected pilot as PIC', async () => {
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
              arrivalAirport: 'CCU',
              flightHours: '2.5',
              blockHours: '2.8',
              flightCycles: '1',
            })}
            pilotOptions={[
              { userId: 'pilot-1', displayName: 'Captain Rao', email: 'captain.rao@example.com' },
              { userId: 'pilot-2', displayName: 'Captain Iyer', email: 'captain.iyer@example.com' },
            ]}
            onCancel={() => undefined}
            onSubmit={onSubmit}
          />
        </DialogContent>
      </Dialog>,
    );

    fireEvent.click(screen.getByLabelText('PIC In Command'));
    fireEvent.click(await screen.findByText('Captain Rao'));
    fireEvent.click(screen.getByRole('button', { name: /Save Flight Log/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.payload.pic_in_command).toBe('Captain Rao');
    expect(submitted.payload.pilot_name).toBe('Captain Rao');
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
});

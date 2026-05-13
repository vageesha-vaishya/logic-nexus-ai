import type { ComponentProps } from 'react';
import { AircraftWorkOrderCreateDialog } from './AircraftWorkOrderCreateDialog';

type AddWorkOrderDialogProps = ComponentProps<typeof AircraftWorkOrderCreateDialog>;

export function AddWorkOrderDialog(props: AddWorkOrderDialogProps) {
  return <AircraftWorkOrderCreateDialog {...props} />;
}

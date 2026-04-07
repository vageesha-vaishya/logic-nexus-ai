import type { ComponentProps } from 'react';
import { AircraftWorkPackageCreateDialog } from './AircraftWorkPackageCreateDialog';

type AddWorkPackageDialogProps = ComponentProps<typeof AircraftWorkPackageCreateDialog>;

export function AddWorkPackageDialog(props: AddWorkPackageDialogProps) {
  return <AircraftWorkPackageCreateDialog {...props} />;
}

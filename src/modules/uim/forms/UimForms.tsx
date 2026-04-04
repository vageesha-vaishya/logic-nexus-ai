import { UimNodeForm } from './UimNodeForm';

export type UimFormComponentProps = {
  existingEntity?: Record<string, unknown> | null;
};

export function UimOverviewForm({ existingEntity }: UimFormComponentProps) {
  return <UimNodeForm node="overview" existingEntity={existingEntity} />;
}

export function UimItemMasterForm({ existingEntity }: UimFormComponentProps) {
  return <UimNodeForm node="item-master" existingEntity={existingEntity} />;
}

export function UimStockLedgerForm({ existingEntity }: UimFormComponentProps) {
  return <UimNodeForm node="stock-ledger" existingEntity={existingEntity} />;
}

export function UimReservationsForm({ existingEntity }: UimFormComponentProps) {
  return <UimNodeForm node="reservations" existingEntity={existingEntity} />;
}

export function UimIssueConsumeForm({ existingEntity }: UimFormComponentProps) {
  return <UimNodeForm node="issue-consume" existingEntity={existingEntity} />;
}

export function UimRestockForm({ existingEntity }: UimFormComponentProps) {
  return <UimNodeForm node="restock" existingEntity={existingEntity} />;
}

export function UimLocationsForm({ existingEntity }: UimFormComponentProps) {
  return <UimNodeForm node="locations" existingEntity={existingEntity} />;
}

export function UimAnalyticsForm({ existingEntity }: UimFormComponentProps) {
  return <UimNodeForm node="analytics" existingEntity={existingEntity} />;
}

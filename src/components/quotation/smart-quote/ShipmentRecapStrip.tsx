export interface ShipmentRecapStripProps {
  mode: string;
  origin: string;
  destination: string;
  cargoSummary: string;
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs"
      style={{ borderColor: 'var(--sq-border)', background: 'var(--sq-bg)', color: 'var(--sq-ink)' }}
    >
      <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--sq-ink)', opacity: 0.6 }}>
        {label}
      </span>
      <span style={{ fontFamily: 'var(--sq-font-mono)' }}>{value}</span>
    </span>
  );
}

export function ShipmentRecapStrip({ mode, origin, destination, cargoSummary }: ShipmentRecapStripProps) {
  if (!origin || !destination) return null;

  return (
    <div className="flex flex-wrap gap-2" data-testid="shipment-recap-strip">
      <Chip label="Mode" value={mode} />
      <Chip label="Origin" value={origin} />
      <Chip label="Dest" value={destination} />
      {cargoSummary && <Chip label="Cargo" value={cargoSummary} />}
    </div>
  );
}

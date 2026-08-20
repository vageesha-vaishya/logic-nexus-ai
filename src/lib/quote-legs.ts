import { TransportLeg } from '@/types/quote-breakdown';

export interface VisualizerLeg {
  from: string;
  to: string;
  mode: string;
  carrier: string;
  transit_time?: string;
  origin: string;
  destination: string;
}

export const normalizePoint = (value: unknown): string => {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  if (normalized.toLowerCase() === 'origin') return '';
  if (normalized.toLowerCase() === 'destination') return '';
  return normalized;
};

export const mapLegsForVisualizer = (
  legs: TransportLeg[] | undefined,
  route?: { origin?: string; destination?: string }
): VisualizerLeg[] => {
  if (!legs) return [];
  const normalized = legs.map((leg) => ({
    ...leg,
    origin: normalizePoint((leg as any).origin || (leg as any).from),
    destination: normalizePoint((leg as any).destination || (leg as any).to),
  }));
  if (normalized.length > 0) {
    if (!normalized[0].origin) normalized[0].origin = normalizePoint(route?.origin);
    if (!normalized[normalized.length - 1].destination) {
      normalized[normalized.length - 1].destination = normalizePoint(route?.destination);
    }
  }
  for (let i = 1; i < normalized.length; i += 1) {
    if (!normalized[i].origin && normalized[i - 1].destination) {
      normalized[i].origin = normalized[i - 1].destination;
    }
  }
  for (let i = normalized.length - 2; i >= 0; i -= 1) {
    if (!normalized[i].destination && normalized[i + 1].origin) {
      normalized[i].destination = normalized[i + 1].origin;
    }
  }
  for (let i = 0; i < normalized.length; i += 1) {
    const previousDestination = i > 0 ? normalized[i - 1].destination : normalizePoint(route?.origin);
    const nextOrigin = i < normalized.length - 1 ? normalized[i + 1].origin : normalizePoint(route?.destination);
    if (!normalized[i].origin) normalized[i].origin = previousDestination || normalizePoint(route?.origin) || 'Origin';
    if (!normalized[i].destination) normalized[i].destination = nextOrigin || normalizePoint(route?.destination) || 'Destination';
  }
  return normalized.map((leg) => ({
    from: leg.origin,
    to: leg.destination,
    mode: leg.mode,
    carrier: leg.carrier || 'Unknown Carrier',
    transit_time: leg.transit_time,
    origin: leg.origin,
    destination: leg.destination,
  }));
};

import { TransportLeg } from '@/types/quote-breakdown';

const PLACEHOLDER_VALUES = new Set([
  '',
  'origin',
  'destination',
  'tbd',
  'tba',
  'tbc',
  'unknown',
  'na',
  'none',
  'unspecified',
  'not specified',
  'to be confirmed',
  'to be decided',
  'pending'
]);

export function normalizeLocationToken(value?: string | null): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u2013\u2014\u2015]/g, '')
    .replace(/[\u2192\u27A1]/g, ' ')
    .replace(/[[\].,/#!$%^&*;:{}=_`~()"_-]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isPlaceholderLocation(value?: string | null): boolean {
  const token = normalizeLocationToken(value);
  if (PLACEHOLDER_VALUES.has(token)) return true;
  return /^(origin|destination)( (port|location|city|terminal))?$/.test(token);
}

export function hasRouteContinuityGap(prevLeg?: TransportLeg | null, currentLeg?: TransportLeg | null): boolean {
  if (!prevLeg || !currentLeg) return false;

  const prevDestinationId = String(prevLeg.destination_location_id || '').trim();
  const currOriginId = String(currentLeg.origin_location_id || '').trim();

  if (prevDestinationId && currOriginId) {
    return prevDestinationId !== currOriginId;
  }

  const prevDestination = normalizeLocationToken(prevLeg.destination);
  const currOrigin = normalizeLocationToken(currentLeg.origin);

  if (!prevDestination || !currOrigin) return false;
  if (isPlaceholderLocation(prevDestination) || isPlaceholderLocation(currOrigin)) return false;

  return prevDestination !== currOrigin;
}

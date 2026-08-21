import { supabase } from '@/integrations/supabase/client';

export interface Coordinates {
  lat: number;
  lng: number;
}

const cache = new Map<string, Coordinates | null>();

function normalizeKey(name: string): string {
  return name.trim().toLowerCase();
}

function toCoordinates(lat: unknown, lng: unknown): Coordinates | null {
  if (lat === null || lat === undefined || lat === '') return null;
  if (lng === null || lng === undefined || lng === '') return null;
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return null;
  if (latNum < -90 || latNum > 90) return null;
  if (lngNum < -180 || lngNum > 180) return null;
  return { lat: latNum, lng: lngNum };
}

function parsePortCoordinates(value: unknown): Coordinates | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  // Real ports_locations.coordinates rows are shaped { lat, lng } (verified against production
  // data — 194/194 non-empty rows use this shape, 0 use { latitude, longitude }). The
  // latitude/longitude fallback is kept only as defensive support for any differently-shaped
  // seed/import data, not because it's the primary convention.
  return toCoordinates(record.lat, record.lng) ?? toCoordinates(record.latitude, record.longitude);
}

async function findPortCoordinates(name: string): Promise<Coordinates | null> {
  const byCode = await supabase
    .from('ports_locations')
    .select('coordinates')
    .ilike('location_code', name)
    .limit(1)
    .maybeSingle();
  const byCodeCoords = parsePortCoordinates(byCode.data?.coordinates);
  if (byCodeCoords) return byCodeCoords;

  const byName = await supabase
    .from('ports_locations')
    .select('coordinates')
    .ilike('location_name', `%${name}%`)
    .limit(1)
    .maybeSingle();
  return parsePortCoordinates(byName.data?.coordinates);
}

async function findAirportCoordinates(name: string): Promise<Coordinates | null> {
  const byCode = await supabase
    .from('airports')
    .select('latitude, longitude')
    .ilike('iata_code', name)
    .limit(1)
    .maybeSingle();
  const byCodeCoords = byCode.data ? toCoordinates(byCode.data.latitude, byCode.data.longitude) : null;
  if (byCodeCoords) return byCodeCoords;

  const byName = await supabase
    .from('airports')
    .select('latitude, longitude')
    .ilike('name', `%${name}%`)
    .limit(1)
    .maybeSingle();
  return byName.data ? toCoordinates(byName.data.latitude, byName.data.longitude) : null;
}

async function findCityCoordinates(name: string): Promise<Coordinates | null> {
  const byName = await supabase
    .from('cities')
    .select('latitude, longitude')
    .ilike('name', `%${name}%`)
    .limit(1)
    .maybeSingle();
  return byName.data ? toCoordinates(byName.data.latitude, byName.data.longitude) : null;
}

async function findTransferPointCoordinates(name: string): Promise<Coordinates | null> {
  const byCode = await supabase
    .from('transfer_points')
    .select('latitude, longitude')
    .ilike('code', name)
    .limit(1)
    .maybeSingle();
  const byCodeCoords = byCode.data ? toCoordinates(byCode.data.latitude, byCode.data.longitude) : null;
  if (byCodeCoords) return byCodeCoords;

  const byName = await supabase
    .from('transfer_points')
    .select('latitude, longitude')
    .ilike('name', `%${name}%`)
    .limit(1)
    .maybeSingle();
  return byName.data ? toCoordinates(byName.data.latitude, byName.data.longitude) : null;
}

export async function resolveCoordinates(name: string | null | undefined): Promise<Coordinates | null> {
  const trimmed = (name || '').trim();
  if (!trimmed) return null;

  const key = normalizeKey(trimmed);
  if (cache.has(key)) return cache.get(key) as Coordinates | null;

  try {
    let resolved: Coordinates | null = await findPortCoordinates(trimmed);
    if (!resolved) resolved = await findAirportCoordinates(trimmed);
    if (!resolved) resolved = await findCityCoordinates(trimmed);
    if (!resolved) resolved = await findTransferPointCoordinates(trimmed);
    cache.set(key, resolved);
    return resolved;
  } catch {
    return null; // do not cache — a transient error shouldn't permanently poison this name
  }
}

export function __clearCoordinatesCacheForTests(): void {
  cache.clear();
}

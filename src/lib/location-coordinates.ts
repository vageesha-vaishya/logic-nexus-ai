import { supabase } from '@/integrations/supabase/client';

export interface Coordinates {
  lat: number;
  lng: number;
}

const cache = new Map<string, Coordinates | null>();

function normalizeKey(name: string): string {
  return name.trim().toLowerCase();
}

function parsePortCoordinates(value: unknown): Coordinates | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const lat = Number(record.latitude);
  const lng = Number(record.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function toCoordinates(lat: unknown, lng: unknown): Coordinates | null {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return null;
  return { lat: latNum, lng: lngNum };
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

  let resolved: Coordinates | null = null;
  try {
    resolved = await findPortCoordinates(trimmed);
    if (!resolved) resolved = await findAirportCoordinates(trimmed);
    if (!resolved) resolved = await findCityCoordinates(trimmed);
    if (!resolved) resolved = await findTransferPointCoordinates(trimmed);
  } catch {
    resolved = null;
  }

  cache.set(key, resolved);
  return resolved;
}

export function __clearCoordinatesCacheForTests(): void {
  cache.clear();
}

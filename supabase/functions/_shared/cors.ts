
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').filter(Boolean);

// Fallback for development: allow localhost origins
const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5555',
  'http://localhost:8080',
];

function getAllowedOrigin(req: Request): string {
  const origin = req.headers.get('Origin') || '';

  // Check configured production origins first
  if (ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS.includes(origin)) {
    return origin;
  }

  // In development, allow localhost origins
  if (DEV_ORIGINS.includes(origin)) {
    return origin;
  }

  // No match — return empty (browser will block the request)
  return '';
}

export function getCorsHeaders(req: Request): Record<string, string> {
  const allowedOrigin = getAllowedOrigin(req);
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Vary': 'Origin',
  };
}
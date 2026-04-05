import { supabase } from '@/integrations/supabase/client';

export type UimHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export class UimApiError extends Error {
  public readonly status: number;
  public readonly payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = 'UimApiError';
    this.status = status;
    this.payload = payload;
  }
}

const FALLBACK_API_BASE = '/api/v2/uim';

function getApiBase(): string {
  return import.meta.env.VITE_UIM_API_BASE_URL || FALLBACK_API_BASE;
}

type RequestOptions<TBody> = {
  method: UimHttpMethod;
  path: string;
  body?: TBody;
  signal?: AbortSignal;
};

async function buildUimRequestHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Accept-Version': 'v1',
    'X-API-Version': 'v1',
  };

  const { data } = await supabase.auth.getSession();
  const accessToken = String(data?.session?.access_token || '').trim();
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return headers;
}

export async function uimApiRequest<TResponse, TBody = unknown>(options: RequestOptions<TBody>): Promise<TResponse> {
  const headers = await buildUimRequestHeaders();
  const requestInit: RequestInit = {
    method: options.method,
    credentials: 'include',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  };
  const apiBase = getApiBase();
  const primaryUrl = `${apiBase}${options.path}`;
  let response = await fetch(primaryUrl, requestInit);
  let payload = await response.json().catch(() => ({}));

  // If configured API base does not yet expose new analytics routes, retry same-origin UIM API.
  const shouldRetryAnalytics404 = !response.ok
    && response.status === 404
    && options.path.startsWith('/analytics/')
    && primaryUrl !== `${FALLBACK_API_BASE}${options.path}`;
  if (shouldRetryAnalytics404) {
    response = await fetch(`${FALLBACK_API_BASE}${options.path}`, requestInit);
    payload = await response.json().catch(() => ({}));
  }

  if (!response.ok) {
    const fallbackMessage = `UIM API request failed with status ${response.status}`;
    const message = typeof payload?.error === 'string' ? payload.error : fallbackMessage;
    throw new UimApiError(message, response.status, payload);
  }

  return payload as TResponse;
}

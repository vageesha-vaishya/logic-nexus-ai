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

const API_BASE = import.meta.env.VITE_UIM_API_BASE_URL || '/api/v2/uim';

type RequestOptions<TBody> = {
  method: UimHttpMethod;
  path: string;
  body?: TBody;
  signal?: AbortSignal;
};

export async function uimApiRequest<TResponse, TBody = unknown>(options: RequestOptions<TBody>): Promise<TResponse> {
  const response = await fetch(`${API_BASE}${options.path}`, {
    method: options.method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Version': 'v1',
      'X-API-Version': 'v1',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const fallbackMessage = `UIM API request failed with status ${response.status}`;
    const message = typeof payload?.error === 'string' ? payload.error : fallbackMessage;
    throw new UimApiError(message, response.status, payload);
  }

  return payload as TResponse;
}

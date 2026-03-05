export interface ApiRequest {
  method?: string;
  query: Record<string, unknown>;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
}

export interface ApiResponse {
  status: (code: number) => {
    json: (data: unknown) => void;
    end: (text?: string) => void;
  };
  setHeader: (name: string, value: string | string[]) => void;
}

export interface ApiErrorBody {
  error: string;
  code?: string;
}

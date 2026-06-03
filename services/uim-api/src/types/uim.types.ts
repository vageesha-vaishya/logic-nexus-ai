// Phase 7 UIM — shared types for the uim-api Express service.
//
// Mirrors the shape of compliance.types.ts / finance.types.ts / etc.
// All extension types of the uim.* schema live here so routes can
// import them without round-tripping through the auto-generated
// Supabase types.

export interface ErrorResponse {
  error: string;
  code: string;
  statusCode: number;
  path?: string;
  requestId?: string | null;
}

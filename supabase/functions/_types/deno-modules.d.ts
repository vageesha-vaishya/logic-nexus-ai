declare module "https://deno.land/std@0.190.0/http/server.ts" {
  export function serve(handler: (req: Request) => Response | Promise<Response>): void
}

declare module "https://esm.sh/@supabase/supabase-js@2.7.1" {
  export function createClient(...args: any[]): any
}

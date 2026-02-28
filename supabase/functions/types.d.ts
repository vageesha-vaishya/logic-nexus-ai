declare module "https://deno.land/std@0.190.0/http/server.ts" {
  export function serve(
    handler: (req: Request) => Response | Promise<Response>
  ): void;
}

declare module "https://esm.sh/@supabase/supabase-js@2.39.8" {
  export function createClient(url: string, key: string, options?: any): any;
}

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
  serve(options: { port?: number; onListen?: (params: { hostname: string; port: number }) => void }, handler: (req: Request) => Response | Promise<Response>): void;
};

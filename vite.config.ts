import { defineConfig, loadEnv, type PluginOption } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { createRequire } from "module";
import { componentTagger } from "lovable-tagger";

const require = createRequire(import.meta.url);

type ProxyServiceDefinition = {
  serviceName: string;
  startCommand: string;
  target: string;
  targetEnvVar: string;
  healthPathHint?: string;
};

function createServiceProxy(definition: ProxyServiceDefinition) {
  return {
    target: definition.target,
    changeOrigin: true,
    secure: false,
    configure: (proxy: any) => {
      proxy.on('error', (error: any, req: any, res: any) => {
        const statusCode = 503;
        const payload = {
          error: 'Upstream service unavailable',
          code: 'UPSTREAM_UNAVAILABLE',
          service: definition.serviceName,
          target: definition.target,
          targetEnvVar: definition.targetEnvVar,
          healthPathHint: definition.healthPathHint,
          requestPath: String(req?.url || ''),
          requestMethod: String(req?.method || ''),
          upstreamError: String(error?.code || error?.message || 'proxy_error'),
          resolution: `Dev orchestrator will start services automatically. Use: npm run dev. To start only services: ${definition.startCommand} or npm run services:start`,
          hint: `Set ${definition.targetEnvVar} in .env to point to a reachable instance`,
        };
        if (res && !res.headersSent) {
          res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        }
        if (res && typeof res.end === 'function') {
          res.end(JSON.stringify(payload));
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const crmApiProxyTarget = process.env.VITE_CRM_API_PROXY_TARGET || env.VITE_CRM_API_PROXY_TARGET || 'http://localhost:3011';
  const amroApiProxyTarget = process.env.VITE_AMRO_API_PROXY_TARGET || env.VITE_AMRO_API_PROXY_TARGET || 'http://localhost:3001';
  const uimApiProxyTarget = process.env.VITE_UIM_API_PROXY_TARGET || env.VITE_UIM_API_PROXY_TARGET || 'http://localhost:3000';
  const tenantBrandingProxyTarget =
    process.env.VITE_TENANT_BRANDING_PROXY_TARGET ||
    env.VITE_TENANT_BRANDING_PROXY_TARGET ||
    process.env.VITE_WEB_API_PROXY_TARGET ||
    env.VITE_WEB_API_PROXY_TARGET ||
    'http://localhost:8787';
  const crmProxy = createServiceProxy({
    serviceName: 'CRM API',
    startCommand: 'cd services/crm-api && npm run dev',
    target: crmApiProxyTarget,
    targetEnvVar: 'VITE_CRM_API_PROXY_TARGET',
    healthPathHint: '/health',
  });
  const amroProxy = createServiceProxy({
    serviceName: 'AMRO API',
    startCommand: 'cd services/amro-api && npm run dev',
    target: amroApiProxyTarget,
    targetEnvVar: 'VITE_AMRO_API_PROXY_TARGET',
    healthPathHint: '/health',
  });
  const uimProxy = createServiceProxy({
    serviceName: 'UIM API',
    startCommand: 'set VITE_UIM_API_PROXY_TARGET to a reachable backend (e.g. Next/Vercel API host)',
    target: uimApiProxyTarget,
    targetEnvVar: 'VITE_UIM_API_PROXY_TARGET',
    healthPathHint: '/api/v2/uim/health',
  });
  const tenantBrandingProxy = createServiceProxy({
    serviceName: 'Tenant Branding API',
    startCommand: 'set VITE_TENANT_BRANDING_PROXY_TARGET or run tenant-branding host',
    target: tenantBrandingProxyTarget,
    targetEnvVar: 'VITE_TENANT_BRANDING_PROXY_TARGET',
    healthPathHint: '/',
  });

  // Domain management API handler with Supabase persistence
  const domainAssignments = new Map();
  const domainConfigs = new Map();
  const platformDomains = [
    { id: '849b380e-3603-4530-94d3-e028126e2a2c', code: 'LOGISTICS', name: 'Logistics & Supply Chain', description: 'Transportation, warehousing, and freight', is_active: true },
    { id: '123e4567-e89b-12d3-a456-426614174000', code: 'BANKING', name: 'Banking & Finance', description: 'Financial services and lending', is_active: true },
    { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', code: 'ECOMMERCE', name: 'E-Commerce', description: 'Online retail and order management', is_active: true },
    { id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', code: 'TELECOM', name: 'Telecommunications', description: 'Network services and connectivity', is_active: true },
    { id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', code: 'INSURANCE', name: 'Insurance', description: 'Risk management and coverage', is_active: true },
    { id: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', code: 'CUSTOMS', name: 'Customs & Compliance', description: 'Regulatory compliance and border clearance', is_active: true },
    { id: 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', code: 'TRADING', name: 'Trading & Procurement', description: 'Sourcing and trade execution', is_active: true },
    { id: 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16', code: 'REAL_ESTATE', name: 'Real Estate', description: 'Property management and sales', is_active: true },
    { id: '00eebc99-9c0b-4ef8-bb6d-6bb9bd380a17', code: 'AMRO', name: 'Aircraft Maintenance & Repair Operations', description: 'Aviation maintenance, repair, and overhaul management', is_active: true },
  ];

  // Supabase client setup for domain API
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL || '';
  const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY || '';
  const hasSupabaseAccess = supabaseUrl && supabaseServiceKey;

  async function callSupabaseAPI(endpoint: string, method: string, body?: any, headers?: Record<string, string>) {
    if (!hasSupabaseAccess) {
      throw new Error('Supabase credentials not configured');
    }

    const url = `${supabaseUrl}/rest/v1/${endpoint}`;
    const requestHeaders: Record<string, string> = {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal',
      ...headers,
    };

    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Supabase API error (${response.status}): ${error}`);
    }

    if (method === 'GET' || response.status === 201) {
      return await response.json();
    }

    return null;
  }

  function handleDomainApi(req: any, res: any, next: any) {
    const url = new URL(req.url || '/', 'http://localhost');
    const pathname = url.pathname;
    const method = req.method;

    // Platform domains - GET
    if (pathname === '/api/v1/platform-domains' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        version: 'v1',
        correlationId: 'dev',
        data: {
          domains: platformDomains,
          tenantDomainCount: platformDomains.length,
          isPlatformAdmin: false,
        },
      }));
      return true;
    }

    // Domain assignments - POST
    if (pathname === '/api/v1/domain-assignments' && method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          const domainId = String(parsed.domainId || '').trim();
          const tenantIds = Array.isArray(parsed.tenantIds) ? parsed.tenantIds : [];
          const batchId = String(parsed.batchId || Date.now().toString()).trim();
          const actorUserId = String(parsed.actorUserId || 'system');

          if (!domainId || tenantIds.length === 0) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'domainId and tenantIds are required', code: 'INVALID_PAYLOAD' }));
            return;
          }

          // Try to save to Supabase, fallback to in-memory
          const records: any[] = [];
          const now = new Date().toISOString();
          let savedToDb = false;

          if (hasSupabaseAccess) {
            try {
              const assignmentsToInsert = tenantIds.map(tenantId => ({
                tenant_id: tenantId,
                domain_id: domainId,
                is_active: true,
                subscription_status: 'active',
                created_by: actorUserId !== 'system' ? actorUserId : null,
              }));

              // Use upsert to handle duplicates gracefully (ON CONFLICT DO NOTHING)
              const result = await callSupabaseAPI(
                'tenant_domain_assignments',
                'POST',
                assignmentsToInsert,
                { 'Prefer': 'resolution=merge-duplicates' }
              );
              savedToDb = true;

              // Build response records from the result
              if (Array.isArray(result)) {
                records.push(...result.map((row: any) => ({
                  id: row.id,
                  tenant_id: row.tenant_id,
                  domain_id: row.domain_id,
                  is_active: row.is_active,
                  subscription_status: row.subscription_status || 'active',
                  batch_id: batchId,
                  actor_user_id: actorUserId,
                  created_at: row.created_at,
                })));
              }

              // Write audit log entries
              const auditEntries = tenantIds.map(tenantId => ({
                action: 'assign',
                tenant_id: tenantId,
                domain_id: domainId,
                actor_user_id: actorUserId !== 'system' ? actorUserId : null,
                batch_id: batchId,
                metadata: { 
                  source: 'domain_management_ui', 
                  saved_at: now,
                  note: records.length < tenantIds.length ? 'Some assignments already existed (duplicate skipped)' : undefined,
                },
              }));

              try {
                await callSupabaseAPI('domain_audit_log', 'POST', auditEntries);
              } catch (auditError) {
                console.error('[Domain API] Failed to write audit log:', auditError.message);
                // Don't fail the whole operation if audit log fails
              }
            } catch (dbError) {
              // Check if it's a duplicate key error
              if (dbError.message.includes('unique_violation') || 
                  dbError.message.includes('duplicate key') ||
                  dbError.message.includes('23505')) {
                console.warn('[Domain API] Duplicate assignment detected, skipping:', dbError.message);
                // Try one-by-one to skip duplicates
                const successfulAssignments: any[] = [];
                for (const tenantId of tenantIds) {
                  try {
                    const result = await callSupabaseAPI(
                      'tenant_domain_assignments',
                      'POST',
                      [{
                        tenant_id: tenantId,
                        domain_id: domainId,
                        is_active: true,
                        subscription_status: 'active',
                        created_by: actorUserId !== 'system' ? actorUserId : null,
                      }],
                      { 'Prefer': 'resolution=merge-duplicates' }
                    );
                    if (Array.isArray(result)) {
                      successfulAssignments.push(...result.map((row: any) => ({
                        id: row.id,
                        tenant_id: row.tenant_id,
                        domain_id: row.domain_id,
                        is_active: row.is_active,
                        subscription_status: row.subscription_status || 'active',
                        batch_id: batchId,
                        actor_user_id: actorUserId,
                        created_at: row.created_at,
                      })));
                    }
                  } catch (individualError) {
                    // Skip duplicates silently
                    if (!individualError.message.includes('23505') && 
                        !individualError.message.includes('duplicate key')) {
                      console.error('[Domain API] Assignment failed:', individualError.message);
                    }
                  }
                }
                
                if (successfulAssignments.length > 0) {
                  records.push(...successfulAssignments);
                  savedToDb = true;
                  
                  // Write audit log for successful assignments
                  const auditEntries = successfulAssignments.map(record => ({
                    action: 'assign',
                    tenant_id: record.tenant_id,
                    domain_id: domainId,
                    actor_user_id: actorUserId,
                    batch_id: batchId,
                    metadata: { 
                      source: 'domain_management_ui', 
                      saved_at: now,
                      note: 'Assignment created',
                    },
                  }));

                  try {
                    await callSupabaseAPI('domain_audit_log', 'POST', auditEntries);
                  } catch (auditError) {
                    console.error('[Domain API] Failed to write audit log:', auditError.message);
                  }
                } else {
                  savedToDb = false;
                }
              } else {
                console.error('[Domain API] Supabase save failed, using in-memory:', dbError.message);
                savedToDb = false;
              }
            }
          }

          // Fallback to in-memory storage
          if (!savedToDb) {
            for (const tenantId of tenantIds) {
              const id = `${Date.now()}-${Math.random()}`;
              const record = {
                id,
                tenant_id: String(tenantId),
                domain_id: domainId,
                is_active: true,
                subscription_status: 'active',
                batch_id: batchId,
                actor_user_id: actorUserId,
                created_at: now,
              };
              domainAssignments.set(`domain-assignment:${id}`, record);
              records.push(record);
            }
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            version: 'v1',
            correlationId: 'dev',
            data: {
              batchId,
              assignedCount: records.length,
              records,
              savedToDatabase: savedToDb,
            },
          }));
        } catch (e) {
          console.error('[Domain API] POST error:', e);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error', message: e instanceof Error ? e.message : String(e) }));
        }
      });
      return true;
    }

    // Domain assignments - DELETE
    if (pathname === '/api/v1/domain-assignments' && method === 'DELETE') {
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          const domainId = String(parsed.domainId || '').trim();
          const tenantIds = Array.isArray(parsed.tenantIds) ? parsed.tenantIds : [];
          const batchId = String(parsed.batchId || Date.now().toString()).trim();

          if (!domainId || tenantIds.length === 0) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'domainId and tenantIds are required', code: 'INVALID_PAYLOAD' }));
            return;
          }

          let revokedCount = 0;
          let savedToDb = false;

          // Try to delete from Supabase
          if (hasSupabaseAccess) {
            try {
              for (const tenantId of tenantIds) {
                await callSupabaseAPI(
                  `tenant_domain_assignments?tenant_id=eq.${tenantId}&domain_id=eq.${domainId}`,
                  'DELETE'
                );
                revokedCount++;
              }
              savedToDb = true;

              // Write audit log entries
              if (revokedCount > 0) {
                const auditEntries = tenantIds.slice(0, revokedCount).map(tenantId => ({
                  action: 'revoke',
                  tenant_id: tenantId,
                  domain_id: domainId,
                  actor_user_id: 'system',
                  batch_id: batchId,
                  metadata: { source: 'domain_management_ui' },
                }));

                try {
                  await callSupabaseAPI('domain_audit_log', 'POST', auditEntries);
                } catch (auditError) {
                  console.error('[Domain API] Failed to write audit log:', auditError.message);
                }
              }
            } catch (dbError) {
              console.error('[Domain API] Supabase delete failed, using in-memory:', dbError.message);
              savedToDb = false;
            }
          }

          // Fallback to in-memory deletion
          if (!savedToDb) {
            for (const [key, record] of domainAssignments.entries()) {
              if (
                key.startsWith('domain-assignment:') &&
                record.domain_id === domainId &&
                tenantIds.includes(record.tenant_id)
              ) {
                domainAssignments.delete(key);
                revokedCount++;
              }
            }
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            version: 'v1',
            correlationId: 'dev',
            data: { batchId, revokedCount, savedToDatabase: savedToDb },
          }));
        } catch (e) {
          console.error('[Domain API] DELETE error:', e);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error', message: e instanceof Error ? e.message : String(e) }));
        }
      });
      return true;
    }

    // Domain assignments - GET
    if (pathname === '/api/v1/domain-assignments' && method === 'GET') {
      // Try to fetch from Supabase first
      if (hasSupabaseAccess) {
        // Parse query parameters for filtering
        const urlObj = new URL(req.url || '/', 'http://localhost');
        const params = new URLSearchParams(urlObj.search);
        let query = 'tenant_domain_assignments?select=*,platform_domains!inner(code,is_active)&order=created_at.desc';
        
        // Apply filters
        if (params.get('tenant_id')) query += `&tenant_id=eq.${params.get('tenant_id')}`;
        if (params.get('domain_id')) query += `&domain_id=eq.${params.get('domain_id')}`;
        if (params.get('batch_id')) query += `&batch_id=eq.${params.get('batch_id')}`;
        const limit = params.get('limit') || '50';
        query += `&limit=${limit}`;

        callSupabaseAPI(query, 'GET')
        .then((records: any[]) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            version: 'v1',
            correlationId: 'dev',
            data: Array.isArray(records) ? records : [],
          }));
        })
        .catch((err) => {
          console.error('[Domain API] GET audit failed:', err.message);
          // Fallback to in-memory
          const records = Array.from(domainAssignments.values())
            .sort((a: any, b: any) => (a.created_at < b.created_at ? 1 : -1))
            .slice(0, parseInt(limit));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ version: 'v1', correlationId: 'dev', data: records }));
        });
        return true;
      }

      // In-memory fallback
      const urlObj = new URL(req.url || '/', 'http://localhost');
      const params = new URLSearchParams(urlObj.search);
      let records = Array.from(domainAssignments.values())
        .sort((a: any, b: any) => (a.created_at < b.created_at ? 1 : -1));
      
      // Apply filters
      const tenantFilter = params.get('tenant_id');
      const domainFilter = params.get('domain_id');
      const batchFilter = params.get('batch_id');
      if (tenantFilter) records = records.filter((r: any) => r.tenant_id === tenantFilter);
      if (domainFilter) records = records.filter((r: any) => r.domain_id === domainFilter);
      if (batchFilter) records = records.filter((r: any) => r.batch_id === batchFilter);
      
      const limit = parseInt(params.get('limit') || '50');
      records = records.slice(0, limit);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ version: 'v1', correlationId: 'dev', data: records }));
      return true;
    }

    // Domain config - GET
    if (pathname === '/api/v1/domain-config' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ version: 'v1', correlationId: 'dev', data: Array.from(domainConfigs.values()) }));
      return true;
    }

    // Domain config - PUT
    if (pathname === '/api/v1/domain-config' && method === 'PUT') {
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          const now = new Date().toISOString();
          const id = String(parsed.id || `${Date.now()}-${Math.random()}`);
          const record = { id, ...parsed, updated_at: now };
          domainConfigs.set(`domain-config:${id}`, record);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ version: 'v1', correlationId: 'dev', data: record }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON body' }));
        }
      });
      return true;
    }

    return false; // Not handled, continue to next middleware
  }

  const domainApiPlugin: PluginOption = {
    name: 'domain-api-handler',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!handleDomainApi(req, res, next)) {
          next();
        }
      });
    },
  };

  const enableDesignSystemFederation = env.VITE_ENABLE_DESIGN_SYSTEM_FEDERATION === 'true';
  const enableDesignSystemRemote = env.VITE_ENABLE_DESIGN_SYSTEM_REMOTE === 'true';
  let federationPlugin: PluginOption = false;
  if (enableDesignSystemFederation || enableDesignSystemRemote) {
    try {
      const module = require("@originjs/vite-plugin-federation");
      const federation = module.default;
      federationPlugin = federation({
        name: enableDesignSystemRemote ? 'crmDesignSystem' : 'crmShell',
        remotes: enableDesignSystemFederation
          ? {
              crmDesignSystem: env.VITE_CRM_DESIGN_SYSTEM_REMOTE || 'http://localhost:5501/assets/remoteEntry.js'
            }
          : undefined,
        exposes: enableDesignSystemRemote
          ? {
              './library': './src/design-system/federation-entry.ts'
            }
          : undefined,
        filename: enableDesignSystemRemote ? 'remoteEntry.js' : undefined,
        shared: ['react', 'react-dom']
      });
    } catch (error) {
      if (mode === "development") {
        console.warn('Module federation plugin is unavailable; continuing without federation.');
      } else {
        throw error;
      }
    }
  }
  return {
  server: {
    host: "0.0.0.0",
    port: 8081,
    strictPort: true,
    headers: {
      "Content-Security-Policy": [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data: https:",
        "connect-src 'self' https: ws: wss:",
        "frame-src 'self' https://challenges.cloudflare.com",
        "worker-src 'self' blob:",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'"
      ].join("; "),
    },
    proxy: {
      '/api/crm': crmProxy,
      '/api/v1/tenant-branding.css': tenantBrandingProxy,
      '/api/v1/tenant-branding': tenantBrandingProxy,
      // Domain management APIs are served by the core web API host, not AMRO API.
      '/api/v1/platform-domains': uimProxy,
      '/api/v1/domain-assignments': uimProxy,
      '/api/v1/domain-config': uimProxy,
      '/api/v1/franchises': uimProxy,
      '/api/v1': amroProxy,
      '/api/v2/amro': amroProxy,
      '/api/v2/uim': uimProxy,
      '/api/amro': {
        ...amroProxy,
        rewrite: (path: string) => path.replace(/^\/api\/amro/, ''),
      },
      '/functions/v1': {
        target: process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL || 'https://gzhxgoigflftharcmdqj.supabase.co',
        changeOrigin: true,
        secure: false,
        configure: (proxy: any, _options: any) => {
          proxy.on('proxyReq', (proxyReq: any, _req: any, _res: any) => {
            // Remove Origin header to bypass CORS checks on Supabase
            proxyReq.removeHeader('Origin');
          });
        },
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    strictPort: true,
    proxy: {
      '/api/crm': crmProxy,
      '/api/v1/tenant-branding.css': tenantBrandingProxy,
      '/api/v1/tenant-branding': tenantBrandingProxy,
      '/api/v1/platform-domains': uimProxy,
      '/api/v1/domain-assignments': uimProxy,
      '/api/v1/domain-config': uimProxy,
      '/api/v1/franchises': uimProxy,
      '/api/v1': amroProxy,
      '/api/v2/amro': amroProxy,
      '/api/v2/uim': uimProxy,
      '/api/amro': {
        ...amroProxy,
        rewrite: (path: string) => path.replace(/^\/api\/amro/, ''),
      },
      '/functions/v1': {
        target: process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL || 'https://gzhxgoigflftharcmdqj.supabase.co',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    federationPlugin,
    domainApiPlugin,
  ].filter(Boolean) as PluginOption[],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      react: path.resolve(__dirname, "node_modules/react"),
      "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
      "react/jsx-runtime": path.resolve(__dirname, "node_modules/react/jsx-runtime"),
    },
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "@tanstack/react-query"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          // Heavy libraries — split into dedicated chunks
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) {
            return 'recharts';
          }
          if (id.includes('node_modules/xlsx')) {
            return 'xlsx';
          }
          if (id.includes('node_modules/@dnd-kit')) {
            return 'dnd-kit';
          }
          if (id.includes('node_modules/jspdf') || id.includes('node_modules/html2canvas')) {
            return 'pdf-export';
          }
          if (id.includes('node_modules/jszip')) {
            return 'jszip';
          }
        },
      },
    },
  },
  // Automated testing configuration was removed; see TESTING.md for restoration notes.
}});

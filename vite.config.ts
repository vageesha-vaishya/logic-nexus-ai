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
    federationPlugin
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

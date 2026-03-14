import { defineConfig, loadEnv, type PluginOption } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { createRequire } from "module";
import { componentTagger } from "lovable-tagger";

const require = createRequire(import.meta.url);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
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
    proxy: {
      '/functions/v1': {
        target: env.VITE_SUPABASE_URL || 'https://gzhxgoigflftharcmdqj.supabase.co',
        changeOrigin: true,
        secure: false,
        configure: (proxy: any, _options: any) => {
          proxy.on('proxyReq', (proxyReq: any, req: any, _res: any) => {
            // Remove Origin header to bypass CORS checks on Supabase
            proxyReq.removeHeader('Origin');
          });
        },
      },
    },
    // headers: {
    //   "Permissions-Policy": [
    //     "browsing-topics=()",
    //     "run-ad-auction=()",
    //     "join-ad-interest-group=()",
    //     "private-state-token-redemption=()",
    //     "private-state-token-issuance=()"
    //   ].join(", "),
    // },
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

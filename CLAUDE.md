
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
npm run dev              # Start full dev environment (runs rules + orchestrator)
npm run dev:vite         # Start Vite only (no orchestrator)
npm run services:start   # Start backend microservices only
```

### Build & Type Check
```bash
npm run build            # Production build
npm run typecheck        # TypeScript type check (no emit)
```

### Linting
```bash
npm run lint             # ESLint for .ts, .tsx, .mdx
npm run lint:unit:fix    # Auto-fix src linting issues
```

### Testing
```bash
npm test                          # Run all unit tests (vitest)
npm run test:amro                 # Run AMRO integration tests
npm run test:amro:unit            # AMRO unit tests only
npm run test:playwright           # E2E Playwright tests
npm run test:playwright:quotation # Quotation E2E tests
```

Run a single test file:
```bash
npx vitest run path/to/file.test.ts
```

### Supabase
```bash
npm run supabase:start       # Start local Supabase
npm run supabase:stop        # Stop local Supabase
npm run supabase:db:reset    # Reset local DB
npm run supabase:db:diff     # Diff schema changes
npm run supabase:db:push     # Push migrations
npm run supabase:types:gen   # Regenerate TypeScript types from DB schema
```

## Architecture

### Overview
This is a multi-tenant logistics/CRM SaaS platform ("Logic Nexus AI / SOS Logistics Pro") built as:
- **Frontend**: React 18 + Vite + TypeScript, using React Router v6, TanStack Query, Zustand, Shadcn/Radix UI, Tailwind CSS
- **Backend microservices** (under `services/`): Express.js APIs for CRM, UIM, and AMRO modules
- **Database**: Supabase (PostgreSQL) with RLS policies; types auto-generated at `src/integrations/supabase/types.ts`

### Frontend Structure
```
src/
  App.tsx              # Route definitions (lazy-loaded pages)
  main.tsx             # Entry: initializes Sentry, PostHog, logger, etc.
  pages/dashboard/     # All dashboard/feature pages
  features/            # Feature modules (see below)
  components/          # Shared UI components
  hooks/               # Global hooks (useAuth, useCRM, useTheme, etc.)
  contexts/            # React contexts (DomainContext, TenantBrandingContext)
  integrations/supabase/ # Supabase client + generated types
  plugins/             # Domain plugins (Logistics, Banking, Trading, etc.)
  lib/                 # Logger, i18n, Sentry, PostHog, performance utils
  config/              # Permissions, status configs, widget registry
```

### Feature Modules (`src/features/module-*`)
Each module follows a consistent structure:
- `workspace/[module]WorkspaceModel.ts` — domain types
- `hooks/use[Module]WorkspaceState.ts` — state management
- `components/[Module]OwnedWorkspace.tsx` — main workspace UI
- `pages/` — routed page components
- `index.ts` — public exports

Active modules: `module-amro`, `module-crm`, `module-quotation`, `module-logistics`, `module-finance`, `module-compliance`, `module-communications`

### AMRO Module (Aircraft Maintenance, Repair & Overhaul)
The most complex module with its own dedicated microservice (`services/amro-api/`). Key sub-areas:
- **MPD** (Maintenance Planning Document): `src/features/module-amro/components/mpd/`
- **Work Orders**: `src/features/module-amro/components/work-orders/`
- **Parts**: `src/features/module-amro/components/parts/`
- **Templates**: `src/features/module-amro/templates/`
- **Settings/Master Data**: `src/features/module-amro/settings/`
- **Data Grid**: `src/features/module-amro/components/data-grid/`

The AMRO API runs as a separate Express service and is proxied via Vite dev server. It supports FAA/EASA/CAAC/SACAA regulatory authorities.

### Backend Services (`services/`)
- `crm-api/` — CRM operations, leads, invoices, GL posting, BullMQ event bus
- `uim-api/` — Universal Integration Module
- `amro-api/` — AMRO maintenance operations (master data, work orders, parts, MPD, directives)

Each service has its own `package.json`, `src/app.ts` entry, and is started via `scripts/service-orchestrator.mjs`.

### Plugin System
Industry-specific behavior is loaded via `src/plugins/` using a `PluginRegistry`. Plugins: Logistics, Banking, Trading, Insurance, Customs, Telecom, RealEstate, Ecommerce. Registered at startup in `src/plugins/init.ts`.

### Multi-Tenancy
The platform supports tenants and franchises. `DomainContext` and `TenantBrandingContext` handle tenant resolution. Auth uses Supabase Auth with RLS. The `PLATFORM_ADMIN_ROLE` permission controls admin-only routes.

### Path Alias
`@/` maps to `src/` throughout the codebase.

# Logic Nexus AI

Logic Nexus AI is a comprehensive logistics and CRM platform built with modern web technologies.

## 🚀 Technologies

*   **Frontend:** React, TypeScript, Vite, Tailwind CSS, shadcn-ui
*   **Backend:** Supabase (PostgreSQL, Auth, Edge Functions, Realtime, Storage)
*   **Testing:** Vitest, Playwright (E2E), k6, Lighthouse CI
*   **Monitoring:** Sentry, PostHog

## 🛠️ Setup & Development

### Prerequisites

*   Node.js (v20+)
*   npm
*   Supabase CLI (optional, for local backend dev)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd logic-nexus-ai

# Install dependencies
npm install
```

### Development Server

```bash
npm run dev
```

### Testing

Automated testing is currently not configured in this repository. See [TESTING.md](TESTING.md) for what was removed and how to restore Vitest/Playwright/Lighthouse/k6.

### Build

```bash
npm run build
```

## 🔒 Security & Compliance

*   **Authentication:** Supabase Auth with RLS (Row Level Security).
*   **Logging:** Centralized structured logging via `src/lib/logger.ts`.
*   **Data Retention:** See [DATA_RETENTION_POLICY.md](DATA_RETENTION_POLICY.md).
*   **Disaster Recovery:** See [DISASTER_RECOVERY.md](DISASTER_RECOVERY.md).

## 📊 Monitoring

This project uses:
*   **Sentry** for error tracking.
*   **PostHog** for product analytics.
*   **Lighthouse CI** for performance regression testing.

## CRM: Leads Module Notes

### View State Persistence

The Leads module uses a single persisted state for view mode + theme + filters via [useLeadsViewState.tsx](src/hooks/useLeadsViewState.tsx).

If view toggles appear “non-functional”, check for conflicting sources of truth:
*   `leads.viewState.v1` (current persisted state)
*   legacy keys: `leadsViewMode`, `leadsTheme`
*   backend defaults: `user:{userId}:leads.default_view` / `user:{userId}:leads.default_theme`

Backend defaults should only apply on a “fresh” session (no local overrides).

## 📝 License

Proprietary - SOS Logistics Pro

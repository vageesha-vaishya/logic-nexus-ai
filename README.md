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

**Unit Tests:**
```bash
npm test
```

**Performance Tests:**
See [tests/performance/README.md](tests/performance/README.md) for details on running k6 load tests.

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

## 📝 License

Proprietary - SOS Logistics Pro

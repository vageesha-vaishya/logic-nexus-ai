# Nexus Worker Service

This service handles background processing for Logic Nexus AI, specifically email sequences using BullMQ and Redis.

## Prerequisites

1.  **Node.js** (v18+)
2.  **Redis** (v6+) running locally or accessible via URL.
3.  **Supabase** project running.

## Setup

1.  Install dependencies:
    ```bash
    npm install
    ```

2.  Configure Environment:
    Create a `.env` file in this directory:
    ```env
    SUPABASE_URL=your_supabase_url
    SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
    REDIS_URL=redis://localhost:6379
    ```

## Running

Development mode:
```bash
npm run dev
```

Production build:
```bash
npm run build
npm start
```

## Architecture

1.  **Scheduler**: Polls Supabase (`get_due_sequence_steps` RPC) every 60 seconds.
2.  **Queue**: Pushes due steps to `email-sequences` queue (BullMQ).
3.  **Worker**:
    - Picks up jobs.
    - Fetches email template.
    - Invokes `send-email` Edge Function.
    - Updates `email_sequence_enrollments` (calculates next due date or marks complete).

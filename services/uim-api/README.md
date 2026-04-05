# UIM API (Dev Mock)

This is a dev-only local mock for UIM CRUD form endpoints.

## Endpoints

- `GET /health`
- `GET /api/v2/uim/health`
- `GET /api/v2/uim/forms/:node`
- `POST /api/v2/uim/forms/:node`
- `GET /api/v2/uim/forms/:node/:id`
- `PATCH /api/v2/uim/forms/:node/:id`
- `DELETE /api/v2/uim/forms/:node/:id`

## Start

```bash
cd services/uim-api
npx tsx watch src/index.ts
```

Or from repo root via orchestrator:

```bash
npm run services:start
```

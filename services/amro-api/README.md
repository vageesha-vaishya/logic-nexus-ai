# AMRO API Service

Asset Maintenance, Repair, and Overhaul (AMRO) Express backend service for work orders management.

## Overview

The AMRO API provides RESTful endpoints for managing aircraft maintenance workflows, including work packages, tasks, and materials. The service implements:

- **JWT Token Verification**: Using Supabase's `auth.getUser()` to verify JWT tokens
- **Tenant Context Extraction**: Automatic lookup of `tenant_id` from the `user_roles` table
- **Explicit Tenant Filtering**: All queries explicitly filter by `tenant_id` (belt and suspenders approach)
- **Service Role Authentication**: Uses Supabase service role client for backend access
- **Multi-tenant Isolation**: Data isolation enforced at both the middleware and query level

## Architecture

### Authentication Flow

1. Client sends `Authorization: Bearer <jwt-token>` header
2. Middleware extracts and verifies token using Supabase's `auth.getUser()`
3. Middleware looks up `tenant_id` from `user_roles` table
4. Request context is enriched with `tenantId` and `userId`
5. All service methods explicitly filter by `tenant_id`

### Service Layer

The `WorkOrdersService` uses:
- **Service role client** for full database access
- **Explicit tenant_id filtering** in all queries (no RLS dependency)
- **Deterministic query patterns** for consistency and auditability

### Error Handling

Standard JSON error format:
```json
{
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_CODE",
  "statusCode": 400
}
```

HTTP Status Codes:
- `400`: Bad Request (validation errors)
- `401`: Unauthorized (auth/tenant issues)
- `404`: Not Found
- `500`: Internal Server Error

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- Supabase project with AMRO schema deployed
- Environment variables configured

### Installation

```bash
npm install
# or
bun install
```

### Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required environment variables:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role API key (for backend)
- `PORT`: Server port (default: 3001)
- `NODE_ENV`: Environment (development/production)
- `CORS_ORIGIN`: CORS origin for frontend

### Development

```bash
npm run dev
```

Server will start on `http://localhost:3001`

### Build

```bash
npm run build
```

### Start Production

```bash
npm run start
```

### Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

### Linting

```bash
# Check code
npm run lint

# Fix issues
npm run lint:fix
```

## API Endpoints

### Health Checks

- `GET /health` - Service health status
- `GET /` - Service info

### Work Packages

- `GET /api/v1/work-orders` - List all work packages
- `GET /api/v1/work-orders/:id` - Get specific work package
- `POST /api/v1/work-orders` - Create work package
- `PATCH /api/v1/work-orders/:id` - Update work package
- `DELETE /api/v1/work-orders/:id` - Delete work package

### Tasks

- `GET /api/v1/work-orders/:workOrderId/tasks` - List tasks for work package
- `GET /api/v1/tasks/:id` - Get specific task
- `POST /api/v1/work-orders/:workOrderId/tasks` - Create task
- `PATCH /api/v1/tasks/:id` - Update task
- `DELETE /api/v1/tasks/:id` - Delete task

## Request Examples

### Create Work Package

```bash
curl -X POST http://localhost:3001/api/v1/work-orders \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "aircraft_id": "ac-123",
    "title": "100-Hour Inspection",
    "maintenance_type": "inspection",
    "estimated_labor_hours": 40
  }'
```

### Update Task

```bash
curl -X PATCH http://localhost:3001/api/v1/tasks/task-123 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_progress",
    "assigned_to": "tech-456"
  }'
```

## Type Safety

Full TypeScript support with strict type checking:

- Domain models in `src/types/amro.types.ts`
- Request/response interfaces
- Compile-time type safety
- Generated type declarations in `dist/`

## Project Structure

```
services/amro-api/
├── src/
│   ├── middleware/
│   │   └── auth.middleware.ts        # JWT verification & tenant lookup
│   ├── services/
│   │   └── work-orders.service.ts    # Business logic with tenant filtering
│   ├── routes/
│   │   └── work-orders.routes.ts     # Express route handlers
│   ├── types/
│   │   └── amro.types.ts             # TypeScript interfaces
│   ├── app.ts                        # Express app setup
│   └── index.ts                      # Server entry point
├── tests/
│   └── work-orders.test.ts           # Integration tests
├── package.json
├── tsconfig.json
├── jest.config.js
├── .eslintrc.json
└── .env.example
```

## Database Schema Requirements

The service requires these Supabase tables (created by M0-1 and M0-2 migrations):

- `tenants` - Tenant data with multi-tenant support
- `user_roles` - User-to-tenant mappings with role information
- `aircraft` - Aircraft asset registry
- `work_orders` - Maintenance work packages with tenant isolation
- `tasks` - Individual tasks within work packages
- `materials` - Materials/parts used in work packages

All tables must have:
- `tenant_id` UUID column (NOT NULL)
- RLS enabled with tenant-aware policies
- Proper indexes on `tenant_id` and frequently filtered columns

## Testing Strategy

### Unit Tests

Mock Supabase responses for isolated function testing.

### Integration Tests

Test API endpoints with real database connections (requires test Supabase instance).

### Authentication Testing

All protected endpoints validate JWT tokens and tenant context.

## Performance Considerations

- Connection pooling via Supabase client
- Indexed queries on `tenant_id` for fast filtering
- Explicit tenant filtering prevents accidental data leaks
- Service role client avoids RLS overhead for known-good queries

## Security

- All queries explicitly filter by `tenant_id` (mandatory)
- Service role client used only in controlled backend context
- JWT tokens verified before any data access
- CORS configured with allowlist
- Error messages sanitized (no internal details to clients)

## Deployment

### Docker

Dockerfile patterns in `services/` directory.

### Environment Setup

1. Deploy AMRO schema migrations (M0-1, M0-2)
2. Create service role API key in Supabase
3. Configure environment variables
4. Build and run container or Node.js process

### Health Checks

Use `GET /health` endpoint for container orchestration (Kubernetes, etc.)

## Monitoring

Service logs all operations to stdout. Consider integration with:

- CloudWatch, Datadog, or similar for log aggregation
- OpenTelemetry (prepared in M0-5) for distributed tracing
- Error tracking (Sentry, etc.)

## Contributing

Follow the architecture decisions:

1. Always filter by `tenant_id` in service methods
2. Validate authentication before accessing data
3. Return standard error format
4. Add tests for new endpoints
5. Maintain TypeScript strict mode

## Next Steps

- M0-4: Kafka event streaming integration
- M0-5: OpenTelemetry distributed tracing
- M0-6: Mobile offline-first support
- M0-7: CI/CD pipeline setup

## License

Part of Logic Nexus-AI platform.

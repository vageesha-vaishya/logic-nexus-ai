# AMRO API Usage Examples

Complete examples for using the AMRO API service.

## Prerequisites

1. Running AMRO API service on `http://localhost:3001`
2. Valid JWT token from Supabase auth
3. User with tenant assignment in `user_roles` table
4. Supabase AMRO schema deployed (M0-1 migration)

## Authentication

All examples use an Authorization header with a Bearer token:

```bash
Authorization: Bearer <jwt-token-from-supabase-auth>
```

## Health Checks

### Check service health

```bash
curl -X GET http://localhost:3001/health
```

Response:
```json
{
  "status": "ok",
  "service": "amro-api",
  "timestamp": "2026-03-19T10:30:45.123Z"
}
```

### Get service info

```bash
curl -X GET http://localhost:3001/
```

Response:
```json
{
  "name": "AMRO API Service",
  "version": "0.1.0",
  "description": "Asset Maintenance, Repair, and Overhaul backend service"
}
```

## Work Packages

### List all work packages for tenant

```bash
curl -X GET http://localhost:3001/api/v1/work-orders \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

Response:
```json
{
  "data": [
    {
      "id": "wp-123",
      "tenant_id": "tenant-456",
      "aircraft_id": "ac-789",
      "work_order_number": "WP-1710960345123",
      "title": "100-Hour Inspection",
      "description": "Scheduled maintenance per FAA",
      "maintenance_type": "inspection",
      "status": "planning",
      "estimated_labor_hours": 40,
      "estimated_cost": 5000,
      "created_at": "2026-03-19T10:30:45.123Z",
      "updated_at": "2026-03-19T10:30:45.123Z"
    }
  ],
  "count": 1
}
```

### Get specific work package

```bash
curl -X GET http://localhost:3001/api/v1/work-orders/wp-123 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

Response:
```json
{
  "data": {
    "id": "wp-123",
    "tenant_id": "tenant-456",
    "aircraft_id": "ac-789",
    "work_order_number": "WP-1710960345123",
    "title": "100-Hour Inspection",
    "description": "Scheduled maintenance per FAA",
    "maintenance_type": "inspection",
    "status": "planning",
    "estimated_labor_hours": 40,
    "estimated_cost": 5000,
    "created_at": "2026-03-19T10:30:45.123Z",
    "updated_at": "2026-03-19T10:30:45.123Z"
  }
}
```

### Create work package

```bash
curl -X POST http://localhost:3001/api/v1/work-orders \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "aircraft_id": "ac-789",
    "title": "Annual Inspection",
    "description": "Annual airworthiness inspection",
    "maintenance_type": "inspection",
    "planned_start_date": "2026-04-01T00:00:00Z",
    "planned_completion_date": "2026-04-05T00:00:00Z",
    "estimated_labor_hours": 60,
    "estimated_cost": 7500
  }'
```

Response:
```json
{
  "data": {
    "id": "wp-new-id",
    "tenant_id": "tenant-456",
    "aircraft_id": "ac-789",
    "work_order_number": "WP-1710960400000",
    "title": "Annual Inspection",
    "description": "Annual airworthiness inspection",
    "maintenance_type": "inspection",
    "status": "planning",
    "planned_start_date": "2026-04-01T00:00:00Z",
    "planned_completion_date": "2026-04-05T00:00:00Z",
    "estimated_labor_hours": 60,
    "estimated_cost": 7500,
    "created_at": "2026-03-19T10:35:00.000Z",
    "updated_at": "2026-03-19T10:35:00.000Z"
  }
}
```

### Update work package

```bash
curl -X PATCH http://localhost:3001/api/v1/work-orders/wp-123 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "assigned_to": "tech-001",
    "actual_labor_hours": 42
  }'
```

Response:
```json
{
  "data": {
    "id": "wp-123",
    "tenant_id": "tenant-456",
    "aircraft_id": "ac-789",
    "work_order_number": "WP-1710960345123",
    "title": "100-Hour Inspection",
    "status": "approved",
    "assigned_to": "tech-001",
    "actual_labor_hours": 42,
    "updated_at": "2026-03-19T10:40:00.000Z"
  }
}
```

### Delete work package

```bash
curl -X DELETE http://localhost:3001/api/v1/work-orders/wp-123 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

Response: `204 No Content`

## Tasks

### List tasks for work package

```bash
curl -X GET http://localhost:3001/api/v1/work-orders/wp-123/tasks \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

Response:
```json
{
  "data": [
    {
      "id": "task-001",
      "tenant_id": "tenant-456",
      "work_order_id": "wp-123",
      "task_number": "TASK-1710960345123",
      "title": "Engine oil change",
      "description": "Change engine oil and filter",
      "status": "pending",
      "sequence_number": 1,
      "planned_start_date": "2026-04-01T00:00:00Z",
      "planned_completion_date": "2026-04-01T02:00:00Z",
      "required_qualification": "A&P",
      "created_at": "2026-03-19T10:30:45.123Z",
      "updated_at": "2026-03-19T10:30:45.123Z"
    },
    {
      "id": "task-002",
      "tenant_id": "tenant-456",
      "work_order_id": "wp-123",
      "task_number": "TASK-1710960350000",
      "title": "Hydraulic fluid check",
      "description": "Check hydraulic fluid levels",
      "status": "pending",
      "sequence_number": 2,
      "planned_start_date": "2026-04-01T02:00:00Z",
      "planned_completion_date": "2026-04-01T03:00:00Z",
      "required_qualification": "A&P",
      "created_at": "2026-03-19T10:30:45.123Z"
    }
  ],
  "count": 2
}
```

### Get specific task

```bash
curl -X GET http://localhost:3001/api/v1/tasks/task-001 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

Response:
```json
{
  "data": {
    "id": "task-001",
    "tenant_id": "tenant-456",
    "work_order_id": "wp-123",
    "task_number": "TASK-1710960345123",
    "title": "Engine oil change",
    "description": "Change engine oil and filter",
    "status": "pending",
    "sequence_number": 1,
    "required_qualification": "A&P",
    "created_at": "2026-03-19T10:30:45.123Z",
    "updated_at": "2026-03-19T10:30:45.123Z"
  }
}
```

### Create task

```bash
curl -X POST http://localhost:3001/api/v1/work-orders/wp-123/tasks \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "work_order_id": "wp-123",
    "title": "Brake inspection",
    "description": "Inspect brake system components",
    "sequence_number": 3,
    "planned_start_date": "2026-04-01T03:00:00Z",
    "planned_completion_date": "2026-04-01T04:00:00Z",
    "required_qualification": "A&P"
  }'
```

Response:
```json
{
  "data": {
    "id": "task-new-id",
    "tenant_id": "tenant-456",
    "work_order_id": "wp-123",
    "task_number": "TASK-1710960450000",
    "title": "Brake inspection",
    "description": "Inspect brake system components",
    "status": "pending",
    "sequence_number": 3,
    "planned_start_date": "2026-04-01T03:00:00Z",
    "planned_completion_date": "2026-04-01T04:00:00Z",
    "required_qualification": "A&P",
    "created_at": "2026-03-19T10:45:00.000Z",
    "updated_at": "2026-03-19T10:45:00.000Z"
  }
}
```

### Update task

```bash
curl -X PATCH http://localhost:3001/api/v1/tasks/task-001 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_progress",
    "assigned_to": "tech-001",
    "actual_start_date": "2026-04-01T09:00:00Z"
  }'
```

Response:
```json
{
  "data": {
    "id": "task-001",
    "tenant_id": "tenant-456",
    "work_order_id": "wp-123",
    "task_number": "TASK-1710960345123",
    "title": "Engine oil change",
    "status": "in_progress",
    "assigned_to": "tech-001",
    "actual_start_date": "2026-04-01T09:00:00Z",
    "updated_at": "2026-03-19T10:50:00.000Z"
  }
}
```

### Delete task

```bash
curl -X DELETE http://localhost:3001/api/v1/tasks/task-001 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

Response: `204 No Content`

## Error Responses

### Missing authentication

```bash
curl -X GET http://localhost:3001/api/v1/work-orders
```

Response: `401 Unauthorized`
```json
{
  "error": "Missing or malformed Authorization header",
  "code": "MISSING_TOKEN",
  "statusCode": 401
}
```

### Invalid token

```bash
curl -X GET http://localhost:3001/api/v1/work-orders \
  -H "Authorization: Bearer invalid-token"
```

Response: `401 Unauthorized`
```json
{
  "error": "Invalid or expired token",
  "code": "INVALID_TOKEN",
  "statusCode": 401
}
```

### Validation error

```bash
curl -X POST http://localhost:3001/api/v1/work-orders \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Missing required fields"
  }'
```

Response: `400 Bad Request`
```json
{
  "error": "Missing required fields: aircraft_id, title, maintenance_type",
  "code": "VALIDATION_ERROR",
  "statusCode": 400
}
```

### Resource not found

```bash
curl -X GET http://localhost:3001/api/v1/work-orders/non-existent-id \
  -H "Authorization: Bearer <token>"
```

Response: `404 Not Found`
```json
{
  "error": "Work package not found",
  "code": "NOT_FOUND",
  "statusCode": 404
}
```

## JavaScript Client Example

```javascript
const API_URL = 'http://localhost:3001/api/v1';
const token = 'your-jwt-token';

// Fetch work packages
async function getWorkOrders() {
  const response = await fetch(`${API_URL}/work-orders`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  return response.json();
}

// Create work package
async function createWorkOrder(payload) {
  const response = await fetch(`${API_URL}/work-orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  return response.json();
}

// Update work package
async function updateWorkOrder(id, updates) {
  const response = await fetch(`${API_URL}/work-orders/${id}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updates)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  return response.json();
}
```

## TypeScript Client Example

```typescript
import { WorkOrder, Task, CreateWorkOrderRequest } from '../services/amro-api/src/types/amro.types';

class AMROClient {
  private apiUrl = 'http://localhost:3001/api/v1';
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private async request<T>(method: string, path: string, body?: any): Promise<T> {
    const response = await fetch(`${this.apiUrl}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error);
    }

    return response.json();
  }

  async getWorkOrders(): Promise<{ data: WorkOrder[]; count: number }> {
    return this.request('GET', '/work-orders');
  }

  async createWorkOrder(payload: CreateWorkOrderRequest): Promise<{ data: WorkOrder }> {
    return this.request('POST', '/work-orders', payload);
  }

  async getTasks(workOrderId: string): Promise<{ data: Task[]; count: number }> {
    return this.request('GET', `/work-orders/${workOrderId}/tasks`);
  }
}

// Usage
const client = new AMROClient(token);
const workOrders = await client.getWorkOrders();
console.log(workOrders.data);
```

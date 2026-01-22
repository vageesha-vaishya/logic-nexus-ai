# Subscription Plans API

## Overview

The Subscription Plans API provides RESTful endpoints for managing subscription plan master data. It is implemented as a Supabase Edge Function and enforces platform-admin-only access for all write operations.

Base URL:

- `/functions/v1/subscription-plans`

Authentication:

- Supabase JWT in the `Authorization: Bearer <token>` header.

## Endpoints

### List Plans

- `GET /functions/v1/subscription-plans`

Response:

- `200 OK` with `{ data: SubscriptionPlan[] }`

### Create Plan

- `POST /functions/v1/subscription-plans`

Body:

- JSON `PlanPayload` with fields:
  - `name` (string, required)
  - `slug` (string, required)
  - `description` (string, optional)
  - `plan_type` (string)
  - `tier` (string)
  - `billing_period` (`monthly` | `quarterly` | `annual`)
  - `price_monthly` (number)
  - `price_quarterly` (number, optional)
  - `price_annual` (number, optional)
  - `currency` (string)
  - `features` (object)
  - `limits` (object)
  - `trial_period_days` (number)
  - `deployment_model` (`saas` | `on_premise` | `hybrid`)
  - `supported_currencies` (string[])
  - `supported_languages` (string[])
  - `metadata` (object)
  - `is_active` (boolean)

Responses:

- `201 Created` with `{ data: { id: string } }`

### Update Plan

- `PUT /functions/v1/subscription-plans?id={plan_id}`

Body:

- Same shape as `PlanPayload`, all fields optional.

Responses:

- `200 OK` with `{ ok: true }`

### Delete Plan

- `DELETE /functions/v1/subscription-plans?id={plan_id}`

Responses:

- `200 OK` with `{ ok: true }`

## RBAC and Audit Logging

- Only users with `platform_admin` role (checked via `is_platform_admin`) can access these endpoints.
- All create, update, and delete operations write to `audit_logs` with:
  - `resource_type = 'subscription_plan'`
  - `resource_id = <plan_id>`
  - `action = 'create' | 'update' | 'delete'`
  - `details` containing the payload.


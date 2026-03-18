Title: Multi-Gateway, Multi-Currency Subscription Payments Design
Status: Draft
Owner: Platform Engineering
Date: 2026-03-18

## Goals
- Enable one-time and recurring (monthly/annual) subscription payments across Stripe, PayPal, UPI (India), Google Pay, and additional international processors
- Support USD, INR, and other global currencies with accurate conversion and tax compliance
- Preserve existing application logic and database schemas with additive metadata usage only
- Maintain PCI-DSS, GDPR, RBI, PSD2, and other regional compliance requirements

## Non-Goals
- No breaking changes to existing APIs, UI flows, or database schemas
- No new database tables when existing structures can be reused
- No implementation changes in this phase

## Compatibility Constraints
- Reuse existing subscription and billing tables with JSONB metadata fields
- Use current webhook infrastructure and RLS policies
- Keep tenant isolation via existing RLS and `ScopedDataAccess`
- Retain Stripe fields already present for backwards compatibility

## Existing Assets to Reuse
- Subscription plans and pricing in `subscription_plans` with Stripe identifiers
- Subscription lifecycle in `tenant_subscriptions` with `metadata`
- Billing artifacts in `subscription_invoices` with `metadata`
- Webhook ingestion in `payment_webhook_events` and `payment-webhook-handler`
- Audit trail in `audit_logs`
- Onboarding and payment state in `tenant_onboarding_sessions`

## Functional Design

### Payment Scenarios
1. One-time payment (setup fee, onboarding fee, add-on purchase)
2. Recurring subscription (monthly/annual)
3. Upgrade/downgrade mid-cycle with proration
4. Retry and dunning for failed payments
5. Refunds, chargebacks, and disputes

### User Flow Summary
1. Tenant selects plan and billing period
2. System creates a payment session with the chosen gateway
3. User completes hosted checkout (PCI-compliant, tokenized)
4. Gateway sends webhook events
5. Webhook handler records event, updates subscription/invoice state
6. Audit log captures payment lifecycle actions

## Data Model Reuse Strategy (No New Tables)

### `subscription_plans`
- Use `stripe_price_id` and `stripe_product_id` for Stripe
- Use plan `slug` as the canonical cross-gateway key
- Store non-Stripe gateway plan identifiers in secure config keyed by `slug` (no DB change)

### `tenant_subscriptions`
- Store gateway-specific subscription/customer identifiers in `metadata`
  - `metadata.gateway = { provider, customer_id, subscription_id, mandate_id, payment_method_id }`
  - `metadata.payment_status` and `metadata.payment_failure_reason`
- Preserve `stripe_subscription_id` and `stripe_customer_id` for Stripe

### `subscription_invoices`
- Store payment transaction data in `metadata`
  - `metadata.gateway = { provider, charge_id, intent_id, order_id, payment_id }`
  - `metadata.currency = { billing_currency, settlement_currency, fx_rate, fx_source }`
  - `metadata.tax = { tax_amount, tax_type, jurisdiction, tax_id }`
  - `metadata.dispute = { dispute_id, status, reason, due_by }`

### `payment_webhook_events`
- Store full gateway payload for traceability
- Use `provider` and `event_id` for idempotency

### `audit_logs`
- Record all payment actions (checkout initiation, payment success/failure, refunds, disputes)

## Multi-Currency Support

### Supported Currencies
- Default base: USD
- Regional: INR
- Expandable list for global currencies per gateway capability

### Currency Conversion Logic
- Prefer gateway-settlement conversion when supported
- Otherwise, use an approved FX rate source at checkout
- Persist conversion details in `subscription_invoices.metadata.currency`

### Pricing Strategy
- Use plan `price_monthly` and `price_annual` as base prices
- Apply currency conversion for non-USD plans at checkout
- Store converted amount per invoice to ensure auditability

## Tax Calculation and Compliance
- Apply jurisdictional tax rules (VAT, GST, sales tax) using gateway tax engines when available
- Store tax details in `subscription_invoices.metadata.tax`
- Ensure invoice displays compliant tax breakdowns per region

## Compliance and Regulatory Requirements

### PCI-DSS
- Use hosted checkout or payment element tokenization
- Do not store PAN or CVV
- Maintain SAQ-A compliance scope

### GDPR
- Minimize PII in payment metadata
- Use lawful basis for processing and retention
- Support right-to-erasure requests while preserving financial audit requirements

### RBI (India)
- Use UPI via RBI-compliant PSP
- Ensure two-factor authentication for cards
- Support e-mandate rules for recurring transactions
- Tokenization for stored cards

### PSD2 (Europe)
- Enforce SCA via 3DS2 for applicable transactions
- Support exemptions only when permitted
- Store authentication results in payment metadata

### Other Regional Controls
- Support local consumer protection and refund timelines
- Comply with data residency requirements where contractually mandated

## Security and Encryption
- Encrypt secrets in environment-level secret management
- Verify webhook signatures per provider
- Use idempotency keys for all create/confirm operations
- Restrict access via RLS and service role for webhook processing
- Log security-relevant events in `audit_logs`

## Webhook Handling

### Unified Webhook Flow
1. Receive webhook payload
2. Validate signature and provider
3. Write to `payment_webhook_events`
4. Update `tenant_subscriptions` and `subscription_invoices`
5. Write to `audit_logs`

### Event Mapping
- `payment_succeeded` → mark invoice paid, subscription active
- `payment_failed` → mark invoice open, subscription past_due, capture failure reason
- `chargeback/dispute` → update invoice metadata, trigger notification workflow

## Reconciliation and Failure Recovery

### Reconciliation
- Daily reconciliation between gateway reports and `subscription_invoices`
- Detect mismatches via `payment_webhook_events` and invoice status
- Log discrepancies to `audit_logs`

### Failure Recovery
- Retry webhook processing with idempotency
- Dunning policy: retry schedule per gateway norms
- Grace period support before downgrading service access

## Dispute Management
- Track dispute events in `subscription_invoices.metadata.dispute`
- Store evidence references in secure storage and link from metadata
- Maintain timelines for responses per provider

## API Design (No Implementation in This Phase)

### Create Checkout Session
`POST /payments/checkout/session`
Request:
```json
{
  "tenant_id": "uuid",
  "plan_slug": "professional",
  "billing_period": "monthly",
  "currency": "INR",
  "payment_provider": "stripe | paypal | upi | google_pay | other",
  "mode": "subscription | one_time",
  "return_url": "https://app.example.com/billing/return",
  "cancel_url": "https://app.example.com/billing/cancel"
}
```
Response:
```json
{
  "payment_session_id": "sess_123",
  "checkout_url": "https://gateway/checkout/...",
  "expires_at": "2026-03-18T12:00:00Z"
}
```

### Confirm Payment
`POST /payments/confirm`
Request:
```json
{
  "payment_session_id": "sess_123",
  "provider": "stripe",
  "provider_reference": "pi_123"
}
```
Response:
```json
{
  "status": "paid | pending | failed",
  "subscription_id": "uuid",
  "invoice_id": "uuid"
}
```

### Webhook Endpoint
`POST /payments/webhook`
- Provider-specific signature verification
- Map to `payment_webhook_events` and update subscription/invoice records

### Billing History
`GET /payments/invoices?tenant_id=...`
Response:
```json
{
  "data": [
    {
      "invoice_id": "uuid",
      "amount_due": 1200,
      "amount_paid": 1200,
      "currency": "USD",
      "status": "paid",
      "paid_at": "2026-03-10T08:20:00Z"
    }
  ]
}
```

## SDK Integration Guides (High-Level)

### Stripe
- Use Stripe Checkout or Payment Element for PCI scope reduction
- Map Stripe `customer`, `subscription`, `invoice`, `payment_intent` to `tenant_subscriptions` and `subscription_invoices.metadata`
- Use webhook signature verification and idempotency keys

### PayPal
- Use PayPal Subscriptions API for recurring
- Map PayPal `billing_agreement` and `subscription_id` into `tenant_subscriptions.metadata`
- Validate webhook signatures and capture event payloads

### UPI (India)
- Use RBI-compliant PSP (e.g., UPI Collect/Intent flows)
- Store `upi_mandate_id` and `upi_txn_id` in `subscription_invoices.metadata`
- Enforce RBI e-mandate rules for recurring charges

### Google Pay
- Use Google Pay via supported acquirer or gateway
- Store tokenized payment reference in `subscription_invoices.metadata`
- Use provider callbacks to reconcile payment status

### Other International Processors
- Require webhook support, idempotency, and charge status API
- Map gateway identifiers into `subscription_invoices.metadata`

## Phased Implementation Plan

### Phase 1: Sandbox/Test Mode
- Enable test credentials for all gateways
- Implement webhook validation and event persistence
- Validate multi-currency conversion and tax calculation logic
- End-to-end test of subscription lifecycle with sandbox payments

### Phase 2: Limited Production Pilot
- Enable production credentials for a small tenant cohort
- Monitor webhook reliability and reconciliation accuracy
- Validate regulatory compliance per region

### Phase 3: Full Production Rollout
- Enable all tenants with regional routing
- Introduce standardized dispute workflows
- Monitor KPI dashboards and audit logs

## Backward Compatibility and Safety
- All changes remain additive to metadata fields
- Stripe fields remain the source of truth for existing integrations
- No schema changes without architecture approval
- Preserve existing UI flows for subscription management

## Risk Register and Mitigations
- Currency conversion mismatch: persist FX rates and amounts on invoice creation
- Webhook replay/duplication: enforce idempotency with `payment_webhook_events`
- Regulatory changes: maintain per-region policy checklist and reviews


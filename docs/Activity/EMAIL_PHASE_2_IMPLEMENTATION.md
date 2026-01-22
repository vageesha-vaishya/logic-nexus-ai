# Email Phase 2 Implementation: Advanced Features & Automation

## 1. Overview
This document outlines the implementation of **Phase 2** of the email infrastructure for SOS Logistics Pro. Building upon the Phase 1 Foundation, this phase introduces:
- **Templating System**: Dynamic email content using `email_templates`.
- **Scheduled Sending**: Queue-based processing for high-volume and scheduled delivery.
- **Robustness**: Failover mechanisms and comprehensive audit logging.
- **AI Readiness**: Schema updates to support future AI classification and sentiment analysis.

## 2. Architecture

### 2.1 Queue-Based Processing
To handle high volumes and scheduled delivery, we introduced a `scheduled_emails` table acting as a persistent queue.
- **Producer**: Frontend or Backend inserts into `scheduled_emails` with `status = 'pending'`.
- **Consumer**: `process-scheduled-emails` Edge Function runs via Cron (e.g., every minute), picks up pending items, and invokes `send-email`.

### 2.2 Failover Strategy
The `send-email` function now supports a **Provider Chain**.
- **Primary**: Resend (System) or User's OAuth Provider (Gmail/O365).
- **Failover**: The architecture allows defining a list of providers. If the first fails, the system automatically tries the next (currently implemented for System emails if multiple keys/providers are added).

### 2.3 Audit Trail
A dedicated `email_audit_log` table captures all lifecycle events (`send`, `read`, `click`) securely, adhering to strict RLS policies.

## 3. Database Schema Changes

### New Tables
- **`scheduled_emails`**: Stores email jobs.
- **`email_audit_log`**: Compliance logging.

### Updates
- **`emails`**: Added `ai_category`, `ai_sentiment`, `ai_urgency` columns.
- **Triggers**: Automatic audit logging on email table changes.

## 4. Edge Functions

### `send-email` (Enhanced)
- **Templating**: Accepts `templateId` and `variables`. Fetches template from DB and performs string replacement.
- **Failover**: Implements retry logic across configured providers.
- **Logging**: Inserts record into `emails` table (which triggers audit log).

### `process-scheduled-emails` (New)
- **Batch Processing**: Fetches up to 50 pending emails per run.
- **Idempotency**: Updates status to `processing` before sending to prevent double-sends.
- **Error Handling**: Captures and logs errors to the database without halting the batch.

## 5. Provider Onboarding Guide (Future Proofing)

To add a new provider (e.g., SendGrid, AWS SES):

1.  **Update Interface**:
    Modify `supabase/functions/send-email/index.ts`:
    ```typescript
    class SendGridProvider extends EmailProvider {
      async send(req: EmailRequest): Promise<EmailResponse> {
        // Implement SendGrid API call
      }
    }
    ```

2.  **Register Provider**:
    In the `serve` handler, add the new provider to the selection logic:
    ```typescript
    if (account.provider === 'sendgrid') {
      providers.push(new SendGridProvider({ ... }));
    }
    ```

3.  **Environment Variables**:
    Add `SENDGRID_API_KEY` to Supabase Secrets.

## 6. Testing Strategy

### Unit Tests
- **Template Rendering**: Verify variable replacement.
- **Provider Selection**: Ensure correct provider is chosen based on input.
- **Failover**: Simulate provider failure and verify retry.

### Integration Tests
- **End-to-End**: Insert into `scheduled_emails` -> Wait for Cron/Invoke -> Verify delivery -> Verify `sent` status -> Verify `email_audit_log` entry.

## 7. Performance & Scaling
- **Batch Size**: Currently set to 50. Can be increased based on Edge Function timeout limits.
- **Concurrency**: `process-scheduled-emails` can be triggered more frequently or in parallel (with row locking updates) for higher throughput.

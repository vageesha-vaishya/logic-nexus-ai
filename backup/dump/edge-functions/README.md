# Edge Functions

This folder contains all Supabase Edge Functions from the project.

## Functions List

| Function | Description |
|----------|-------------|
| `_shared/` | Shared utilities (CORS, Logger, Classification) |
| `admin-reset-password/` | Admin password reset |
| `calculate-lead-score/` | Lead scoring calculation |
| `calculate-quote-financials/` | Quote financial calculations |
| `classify-email/` | AI email classification |
| `cleanup-logs/` | Log cleanup utility |
| `create-user/` | User creation with role assignment |
| `email-stats/` | Email statistics |
| `exchange-oauth-token/` | OAuth token exchange |
| `export-data/` | Data export utility |
| `get-account-label/` | Account label retrieval |
| `get-contact-label/` | Contact label retrieval |
| `get-opportunity-full/` | Full opportunity data |
| `get-opportunity-label/` | Opportunity label retrieval |
| `get-service-label/` | Service label retrieval |
| `ingest-email/` | Email ingestion |
| `lead-event-webhook/` | Lead event webhook handler |
| `list-edge-functions/` | List available functions |
| `process-franchise-import/` | Franchise data import |
| `process-lead-assignments/` | Lead assignment processing |
| `process-scheduled-emails/` | Scheduled email processing |
| `route-email/` | Email routing |
| `salesforce-sync-opportunity/` | Salesforce sync |
| `search-emails/` | Email search |
| `seed-platform-admin/` | Platform admin seeding |
| `send-email/` | Email sending (Gmail, O365, Resend) |
| `sync-all-mailboxes/` | Mailbox synchronization |
| `sync-emails/` | Email sync |

## Deployment

Edge functions are located in `supabase/functions/` directory.
Copy the entire `supabase/functions/` folder to deploy to your Supabase project.

```bash
supabase functions deploy --project-ref YOUR_PROJECT_REF
```

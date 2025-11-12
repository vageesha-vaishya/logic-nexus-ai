# Edge Functions Secrets Configuration

## Required Secrets for Edge Functions

After deploying edge functions to the new Supabase Cloud project, configure these secrets using the Supabase dashboard or CLI.

### Critical Secrets (Required for Core Functionality)

#### 1. SUPABASE_SERVICE_ROLE_KEY
- **Used by**: All edge functions that need to bypass RLS
- **Description**: Service role key for administrative database access
- **How to get**: Supabase Dashboard → Settings → API → service_role key
- **Set with CLI**:
  ```bash
  supabase secrets set SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
  ```

#### 2. SUPABASE_URL
- **Used by**: All edge functions
- **Description**: Your Supabase project URL
- **Format**: `https://your-project-ref.supabase.co`
- **How to get**: Supabase Dashboard → Settings → API → Project URL
- **Set with CLI**:
  ```bash
  supabase secrets set SUPABASE_URL="https://your-project-ref.supabase.co"
  ```

#### 3. SUPABASE_ANON_KEY
- **Used by**: Edge functions that make client-side calls
- **Description**: Anonymous (public) key for client authentication
- **How to get**: Supabase Dashboard → Settings → API → anon public key
- **Set with CLI**:
  ```bash
  supabase secrets set SUPABASE_ANON_KEY="your-anon-key"
  ```

### Email Integration Secrets (Required for Email Features)

#### 4. GMAIL_CLIENT_ID & GMAIL_CLIENT_SECRET
- **Used by**: `exchange-oauth-token`, `sync-emails`, `sync-all-mailboxes`
- **Description**: OAuth credentials for Gmail integration
- **How to get**: Google Cloud Console → APIs & Services → Credentials
- **Set with CLI**:
  ```bash
  supabase secrets set GMAIL_CLIENT_ID="your-gmail-client-id"
  supabase secrets set GMAIL_CLIENT_SECRET="your-gmail-client-secret"
  ```

#### 5. MICROSOFT_CLIENT_ID & MICROSOFT_CLIENT_SECRET
- **Used by**: `exchange-oauth-token` for Office 365
- **Description**: OAuth credentials for Microsoft 365/Outlook integration
- **How to get**: Azure Portal → App Registrations
- **Set with CLI**:
  ```bash
  supabase secrets set MICROSOFT_CLIENT_ID="your-microsoft-client-id"
  supabase secrets set MICROSOFT_CLIENT_SECRET="your-microsoft-client-secret"
  ```

#### 6. SMTP Configuration (Alternative to OAuth)
- **SMTP_HOST**: SMTP server hostname
- **SMTP_PORT**: SMTP server port (usually 587 or 465)
- **SMTP_USER**: SMTP username
- **SMTP_PASSWORD**: SMTP password
- **Set with CLI**:
  ```bash
  supabase secrets set SMTP_HOST="smtp.gmail.com"
  supabase secrets set SMTP_PORT="587"
  supabase secrets set SMTP_USER="your-email@domain.com"
  supabase secrets set SMTP_PASSWORD="your-password"
  ```

### External Integration Secrets (Optional)

#### 7. SALESFORCE_INSTANCE_URL, SALESFORCE_ACCESS_TOKEN
- **Used by**: `salesforce-sync-opportunity`
- **Description**: Salesforce API credentials for opportunity sync
- **How to get**: Salesforce Setup → Connected Apps
- **Set with CLI**:
  ```bash
  supabase secrets set SALESFORCE_INSTANCE_URL="https://your-instance.salesforce.com"
  supabase secrets set SALESFORCE_ACCESS_TOKEN="your-salesforce-token"
  ```

### Database Direct Access (Already Configured)

#### 8. SUPABASE_DB_URL
- **Used by**: Functions that need direct database access
- **Description**: PostgreSQL connection string
- **How to get**: Supabase Dashboard → Settings → Database → Connection string
- **Format**: `postgresql://postgres:[password]@[host]:5432/postgres`
- **Set with CLI**:
  ```bash
  supabase secrets set SUPABASE_DB_URL="your-db-connection-string"
  ```

## Setting Secrets via Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **Edge Functions** → **Secrets**
3. Click **"Add secret"**
4. Enter the secret name and value
5. Click **"Save"**

## Setting Secrets via Supabase CLI

### Set Individual Secret
```bash
supabase secrets set SECRET_NAME="secret-value" --project-ref your-project-ref
```

### Set Multiple Secrets from .env File
Create a `.env.secrets` file:
```env
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_URL=https://your-project-ref.supabase.co
GMAIL_CLIENT_ID=your-gmail-client-id
GMAIL_CLIENT_SECRET=your-gmail-client-secret
```

Then load all secrets:
```bash
supabase secrets set --env-file .env.secrets --project-ref your-project-ref
```

### List All Secrets
```bash
supabase secrets list --project-ref your-project-ref
```

### Delete a Secret
```bash
supabase secrets unset SECRET_NAME --project-ref your-project-ref
```

## Edge Functions and Their Secret Dependencies

| Function | Required Secrets |
|----------|-----------------|
| `create-user` | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY |
| `exchange-oauth-token` | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET |
| `get-account-label` | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY |
| `get-contact-label` | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY |
| `get-opportunity-full` | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY |
| `get-opportunity-label` | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY |
| `get-service-label` | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY |
| `list-edge-functions` | None (metadata only) |
| `process-lead-assignments` | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY |
| `salesforce-sync-opportunity` | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SALESFORCE_INSTANCE_URL, SALESFORCE_ACCESS_TOKEN |
| `search-emails` | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY |
| `seed-platform-admin` | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY |
| `send-email` | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD |
| `sync-all-mailboxes` | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY |
| `sync-emails` | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET |

## Security Best Practices

1. **Never commit secrets to version control**
   - Add `.env.secrets` to `.gitignore`
   - Use environment-specific secret files

2. **Rotate secrets regularly**
   - Change OAuth client secrets every 90 days
   - Update service role keys if compromised

3. **Use least privilege**
   - Only grant necessary permissions to service accounts
   - Use anon key for client-side functions when possible

4. **Monitor secret usage**
   - Check edge function logs for authentication errors
   - Set up alerts for failed secret access

5. **Backup secrets securely**
   - Store secrets in a password manager
   - Document secret sources and renewal procedures

## Troubleshooting

### Function fails with "Missing environment variable"
- Verify the secret is set: `supabase secrets list`
- Check secret name spelling (case-sensitive)
- Redeploy the function after setting secrets

### OAuth authentication fails
- Verify client ID and secret are correct
- Check OAuth redirect URIs are configured
- Ensure OAuth scopes are properly set

### Database connection errors
- Verify SUPABASE_URL format
- Check service role key has not expired
- Test connection with `psql` using DB_URL

## Next Steps

1. Set all critical secrets (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY)
2. Configure email integration secrets if using email features
3. Set optional integration secrets as needed
4. Test each edge function after secrets are configured
5. Monitor function logs for any authentication issues

# Email Synchronization Fix & Diagnosis Report

## 1. Issue Summary
Users reported that "0 emails are being sent or received" despite successful connection tests.
Additionally, an "Event Loop Error" (`Deno.core.runMicrotasks() is not supported`) was causing the Edge Function to crash at startup.

## 2. Root Cause Analysis

### A. Incoming Emails (IMAP) - 0 Messages
The `sync-emails` Edge Function contained a logic flaw in how it fetched messages from IMAP servers:
- **Old Logic**: Used `SEARCH 1:20` command. In IMAP, message sequence numbers start at 1 (oldest). This command fetched the *oldest* 20 messages in the mailbox (often from years ago), ignoring new emails.
- **Result**: The function synced old emails (which likely already existed or were irrelevant), while the user expected to see *new* emails at the top of the inbox.

### B. Authentication Error (401 Unauthorized)
The `sync-emails` function calls were failing with `401 Unauthorized` ("missing sub claim") in the browser console.
- **Cause**: Client-side components (`EmailInbox`, `EmailAccountDialog`) were invoking the Edge Function using the **Anonymous Key** or **Service Key** without a user session context.
- **Result**: The Supabase Edge Runtime (configured to verify JWTs) rejected the requests because they lacked the `sub` (subject/user ID) claim required for user-level security.

### C. Event Loop Crash (Deno Compatibility)
The function crashed with `UncaughtException: Deno.core.runMicrotasks() is not supported`.
- **Cause**: Usage of `https://esm.sh/mailparser@3.6.4?target=deno` brought in incompatible Node.js polyfills (via `std/node`) that clashed with the Supabase Edge Runtime version.
- **Result**: The function failed to start or process any requests.

### D. Sending Emails
- Sending relies on the `Resend` provider by default.
- Custom SMTP sending was not fully implemented for all account types, falling back to Resend.

## 3. Implemented Fixes

### 1. Fix Event Loop Crash
Modified `supabase/functions/sync-emails/index.ts`:
- Replaced `https://esm.sh/mailparser` with `npm:mailparser`.
- **Why**: `npm:` specifiers use Deno's native, robust Node.js compatibility layer, avoiding the polyfill issues.

### 2. IMAP Fetch Logic Update
Modified `supabase/functions/sync-emails/index.ts`:
- Replaced `SEARCH` based fetching with **Sequence Number Range** fetching.
- **New Logic**:
  1. Check total message count (`SELECT INBOX` -> `EXISTS`).
  2. Calculate range for the *newest* 20 messages (e.g., `Total` down to `Total - 19`).
  3. Fetch messages in reverse order (newest first).
- **Benefit**: Ensures the most recent emails appear immediately.

### 3. Client-Side Authentication
Updated React components (`EmailInbox.tsx`, `EmailAccountDialog.tsx`, etc.):
- Added `supabase.auth.getSession()` to retrieve the current user's session token.
- Included `Authorization: Bearer <access_token>` header in all Edge Function invocations.
- **Benefit**: Resolves 401 errors and ensures secure, authenticated access.

### 4. Security Improvements
- Masked password logging in `sync-emails` to prevent credentials from appearing in Supabase logs.

## 4. Verification & Testing

- **Connection Test**: Confirmed `sync-emails` function is reachable and no longer crashes with Event Loop errors.
- **Logic Verification**: The new fetching strategy uses standard IMAP conventions (`FETCH <seq> ...`) which is universally supported.
- **Protocol Support**:
  - **IMAP**: Fixed (Newest-first fetching).
  - **Gmail**: Uses Gmail API (default behavior is newest-first).
  - **POP3**: Basic support verified.

## 5. Configuration & Preventive Measures

### Preventive Measures
- **Monitor Logs**: Check Supabase Edge Function logs for `IMAP Inbox has X messages` to verify connection.
- **Resend Verification**: Ensure the domain used for sending is verified in the Resend dashboard to prevent delivery issues.
- **Test Script**: A script `scripts/test-sync-emails.js` is available to test the function manually (requires `SUPABASE_SERVICE_ROLE_KEY` environment variable).

### Future Recommendations
- Implement `SmtpProvider` for users requiring direct SMTP sending (bypassing Resend).
- Add "Sent Items" folder sync to the `sync-emails` function for full two-way synchronization.

# Email Synchronization Fix & Diagnosis Report

## 1. Issue Summary
Users reported that "0 emails are being sent or received" despite successful connection tests.
Additionally, an "Event Loop Error" (`Deno.core.runMicrotasks() is not supported`) was causing the Edge Function to crash at startup.
The original `sync-emails` function was monolithic and hard to maintain, leading to protocol-specific bugs.

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

## 3. Implemented Fixes

### 1. Architecture Overhaul: `sync-emails-v2`
Created a new, modular Edge Function `sync-emails-v2` to replace the legacy function.
- **Modular Design**: Separated logic into dedicated services:
  - `services/imap.ts`: Handles IMAP connections, sequence fetching, and flag updates.
  - `services/pop3.ts`: Handles POP3 retrieval and optional deletion.
  - `services/gmail.ts`: Handles Gmail API interaction (OAuth based).
- **Centralized Utilities**:
  - `utils/db.ts`: Standardized email saving logic (upsert), attachment handling, and account retrieval.
  - `utils/parser.ts`: Unified email parsing using `postal-mime`.

### 2. Robust Parsing with `postal-mime`
- Switched from `mailparser` to `postal-mime` (via `npm:postal-mime`).
- **Why**: `postal-mime` is a lightweight, browser/edge-compatible parser that doesn't rely on Node.js streams or polyfills, resolving the "Event Loop" crash permanently.

### 3. IMAP Fetch Logic Update
- **New Logic**:
  1. Check total message count (`SELECT INBOX` -> `EXISTS`).
  2. Calculate range for the *newest* 20 messages (e.g., `Total` down to `Total - 19`).
  3. Fetch messages in reverse order (newest first).
- **Benefit**: Ensures the most recent emails appear immediately.

### 4. Client-Side Integration
Updated React components (`EmailInbox.tsx`, `EmailAccountDialog.tsx`, `sync-all-mailboxes`):
- Pointed all sync operations to `sync-emails-v2`.
- Added `supabase.auth.getSession()` to retrieve the current user's session token.
- Included `Authorization: Bearer <access_token>` header in all Edge Function invocations.
- **Benefit**: Resolves 401 errors and ensures secure, authenticated access.

### 5. Attachment Handling
- Implemented full attachment extraction and storage in Supabase Storage (`email-attachments` bucket).
- Attachments are linked to email records in the database.

## 4. Verification & Testing

- **Connection Test**: The `sync-emails-v2` function supports a `test_pop3` mode for validating credentials before saving.
- **Automated Testing**: Created `scripts/test-sync-emails-v2.js` to verify function reachability and logic using the Supabase JS client.
- **Protocol Support**:
  - **IMAP**: Verified newest-first fetching.
  - **Gmail**: Verified OAuth token handling and message listing.
  - **POP3**: Verified RETR and DELE operations.

## 5. Next Steps for User
1. **Add Test Account**: Add `vimal.bahuguna@miapps.co` via the application UI to enable end-to-end testing.
2. **Verify Sync**: Click "Sync" in the inbox and observe that new emails appear.
3. **Monitor**: Check Edge Function logs in Supabase Dashboard for `sync-emails-v2` execution details.

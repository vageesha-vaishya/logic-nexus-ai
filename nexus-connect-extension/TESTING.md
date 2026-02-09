# Testing Nexus Connect Extension

## Prerequisites
- Chrome Browser
- Supabase Project running
- `dist-extension/` folder built (`npm run build:extension`)

## Installation

1.  Open Chrome and navigate to `chrome://extensions/`.
2.  Enable **Developer mode** (top right toggle).
3.  Click **Load unpacked**.
4.  Select the `dist-extension` folder in your project root.

## Test Scenarios

### 1. Authentication
1.  Open the Side Panel (Click the extension icon -> Open Side Panel).
2.  **Verify:** You see the Login screen.
3.  **Action:** Enter valid credentials for your Supabase tenant.
4.  **Verify:** Successful login redirects to the main Dashboard view.
5.  **Action:** Click "Logout".
6.  **Verify:** You are returned to the Login screen.

### 2. Context Extraction
1.  Open an email in Gmail.
2.  **Verify:** The extension displays the **Subject** and **Sender** of the current email.
3.  **Verify:** If you switch emails, the extension updates automatically.

### 3. Compliance Check
1.  Open an email.
2.  Click **"Check Compliance"**.
3.  **Verify:**
    - Loading state appears.
    - AI analysis returns a Threat Level (Safe/Suspicious/High Risk).
    - A brief reasoning is displayed.

### 4. Sequence Enrollment
1.  Open an email from a potential lead/contact.
2.  Click **"Add to Sequence"**.
3.  **Verify:** A modal appears listing available sequences.
4.  **Action:** Select a sequence and click "Enroll".
5.  **Verify:**
    - Success message appears ("Successfully enrolled...").
    - In Supabase, check the `email_sequence_enrollments` table:
        - A new row exists for this sender.
        - `status` is `active`.
        - `next_step_due_at` is set correctly (based on step 1 delay).

## Troubleshooting

- **"Error: Template not found"**: Ensure `email_templates` are seeded.
- **"Failed to fetch"**: Check if the Edge Function is deployed and `SUPABASE_URL` is correct in `src/lib/supabase.ts`.

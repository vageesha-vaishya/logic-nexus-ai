import { test, expect } from '@playwright/test';

test.describe('Activity Composer Data Loading', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Auth
    await page.route('**/auth/v1/user', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'user-123',
          email: 'test@example.com',
          user_metadata: {
            tenant_id: 'tenant-123',
            franchise_id: 'franchise-123',
            role: 'platform_admin'
          },
          app_metadata: {},
          aud: 'authenticated',
          created_at: new Date().toISOString()
        })
      });
    });

    await page.route('**/auth/v1/session', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                access_token: 'fake-token',
                token_type: 'bearer',
                user: {
                    id: 'user-123',
                    email: 'test@example.com',
                    user_metadata: {
                        tenant_id: 'tenant-123',
                        franchise_id: 'franchise-123',
                        role: 'platform_admin'
                    }
                }
            })
        });
    });

    // Mock RPC calls
    await page.route('**/rest/v1/rpc/get_user_custom_permissions', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([])
        });
    });

    await page.route('**/rest/v1/rpc/get_user_tenant_id', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify('tenant-123')
        });
    });

    await page.route('**/rest/v1/rpc/get_assignable_users', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([{ id: 'user-123', email: 'test@example.com', raw_user_meta_data: { first_name: 'Test', last_name: 'User' } }])
        });
    });
  });

  test('loads and populates related selection fields', async ({ page }) => {
    // Mock Related Data Responses
    await page.route('**/rest/v1/accounts*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'acc-1', name: 'Test Account' }])
      });
    });

    await page.route('**/rest/v1/contacts*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'cont-1', first_name: 'John', last_name: 'Doe', email: 'john@example.com' }])
      });
    });

    await page.route('**/rest/v1/leads*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'lead-1', first_name: 'Jane', last_name: 'Smith', email: 'jane@example.com' }])
      });
    });

    await page.route('**/rest/v1/email_accounts*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'email-1', email_address: 'support@example.com', display_name: 'Support', is_active: true, is_primary: true }])
      });
    });

    // Navigate to a page using ActivityComposer (e.g., /dashboard/activities/new)
    await page.goto('http://localhost:5173/dashboard/activities/new');

    // Wait for the form to be visible
    await expect(page.getByRole('tablist')).toBeVisible();

    // Switch to Email tab to check all fields including From Account
    await page.getByRole('tab', { name: 'Email' }).click();

    // Check Related Account
    const accountSelect = page.getByRole('combobox', { name: 'Select account' }).first(); // Adjust selector if needed
    // Note: It might say "Loading..." initially, but with fast mocks it might be quick.
    // We expect it to eventually have the option.
    
    // We need to trigger the dropdown
    await page.getByText('Related Account').click(); // Focus/click label to be sure or just click the trigger
    // Actually the select trigger is inside.
    // Let's target the Select Trigger specifically.
    // The placeholder changes from "Loading..." to "Select account"
    
    // Wait for loading to finish (placeholder should be "Select account")
    await expect(page.locator('button:has-text("Select account")')).toBeVisible();

    // Open Account Dropdown
    await page.locator('button:has-text("Select account")').click();
    await expect(page.getByRole('option', { name: 'Test Account' })).toBeVisible();
    await page.getByRole('option', { name: 'Test Account' }).click();
    
    // Verify selection
    await expect(page.locator('button:has-text("Test Account")')).toBeVisible();

    // Check Related Contact
    await page.locator('button:has-text("Select contact")').click();
    await expect(page.getByRole('option', { name: 'John Doe' })).toBeVisible();
    
    // Check Related Lead
    await page.locator('button:has-text("Select lead")').click();
    await expect(page.getByRole('option', { name: 'Jane Smith' })).toBeVisible();
  });

  test('handles data loading errors gracefully', async ({ page }) => {
    // Mock Error Response
    await page.route('**/rest/v1/accounts*', async (route) => {
      await route.abort('failed');
    });

    await page.goto('http://localhost:5173/dashboard/activities/new');

    // Expect a toast error (Sonner toast)
    await expect(page.getByText('Failed to load related data')).toBeVisible();
    
    // Dropdowns should probably revert to non-loading state (disabled or enabled but empty? Code says disabled={isLoadingRelated})
    // If error occurs, finally block sets isLoadingRelated(false).
    // So they should be enabled but empty (or contain "None").
    
    await expect(page.locator('button:has-text("Select account")')).toBeVisible();
    await page.locator('button:has-text("Select account")').click();
    await expect(page.getByRole('option', { name: 'Test Account' })).not.toBeVisible();
  });
});

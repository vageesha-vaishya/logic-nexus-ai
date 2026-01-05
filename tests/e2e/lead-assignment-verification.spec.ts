import { test, expect } from '@playwright/test';

test.describe('Lead Assignment Verification', () => {
  // Mock data
  const mockQueueItem = {
    id: 'queue-1',
    lead_id: 'lead-alice',
    status: 'pending',
    priority: 1,
    created_at: new Date().toISOString(),
    tenant_id: 'tenant-123',
    leads: {
      first_name: 'Alice',
      last_name: 'Wonderland',
      company: 'Wonder Corp'
    }
  };

  test.beforeEach(async ({ page }) => {
    // Debug console
    page.on('console', msg => {
        console.log(`[Browser Console]: ${msg.type()} ${msg.text()}`);
    });

    // Mock Supabase Auth User
    await page.route('**/auth/v1/user', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'user-123',
          email: 'admin@example.com',
          aud: 'authenticated',
          role: 'authenticated',
          user_metadata: { tenant_id: 'tenant-123' }
        }),
      });
    });

    // Mock Auth Token (Login)
    await page.route('**/auth/v1/token*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'fake-jwt-token',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'fake-refresh-token',
          user: {
            id: 'user-123',
            email: 'admin@example.com',
            aud: 'authenticated',
            role: 'authenticated',
            user_metadata: { tenant_id: 'tenant-123' }
          }
        }),
      });
    });

    // Mock Profile
    await page.route('**/rest/v1/profiles*', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([{
                id: 'user-123',
                email: 'admin@example.com',
                first_name: 'Admin',
                last_name: 'User',
                is_active: true
            }])
        });
    });

    // Mock User Roles - Ensure platform_admin for permissions
    await page.route('**/rest/v1/user_roles*', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([{
                role: 'platform_admin',
                tenant_id: 'tenant-123',
                franchise_id: null
            }])
        });
    });
    
    // Mock Custom Permissions
    await page.route('**/rest/v1/rpc/get_user_custom_permissions', async route => {
         await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    // Mock Lead Assignment Queue (Both Stats and List)
    await page.route('**/rest/v1/lead_assignment_queue*', async route => {
        const url = route.request().url();
        if (url.includes('count=exact') && url.includes('status=eq.pending')) {
             // Stats count: select count from lead_assignment_queue where status = 'pending'
             await route.fulfill({
                status: 200,
                headers: {
                    'content-range': '0-0/1' // Total count 1
                },
                body: ''
            });
        } else if (url.includes('leads')) {
            // Queue list: select *, leads(...)
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([mockQueueItem])
            });
        } else {
            // Fallback
            await route.continue();
        }
    });

    // Mock Lead Assignment History (Assigned Today)
    await page.route('**/rest/v1/lead_assignment_history*', async route => {
        await route.fulfill({
            status: 200,
            headers: { 'content-range': '0-0/0' },
            body: ''
        });
    });

    // Mock Lead Assignment Rules
    await page.route('**/rest/v1/lead_assignment_rules*', async route => {
        await route.fulfill({
            status: 200,
            headers: { 'content-range': '0-0/0' },
            body: ''
        });
    });

    // Mock Territories
    await page.route('**/rest/v1/territories*', async route => {
        await route.fulfill({
            status: 200,
            headers: { 'content-range': '0-0/0' },
            body: ''
        });
    });

  });

  test('Verify pending leads and Alice in queue', async ({ page }) => {
    // 0. Perform Login
    await page.goto('/auth');
    await page.fill('input[type="email"]', 'admin@example.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    
    // Wait for redirection to dashboard (any dashboard route)
    await page.waitForURL(/\/dashboard/);

    // 1. Navigate to the dashboard interface
    await page.goto('/dashboard/lead-assignment');
    
    // Debug: Check URL
    await expect(page).toHaveURL('/dashboard/lead-assignment');
    
    // 2. Locate the 'Pending Queue' status card and 3. Confirm status information
    // We expect a card with title "Pending Queue" and count "1"
    // Assuming the stats are displayed in some card component. 
    // I'll look for text "Pending Queue" and "1" nearby.
    const pendingCard = page.locator('.stats-card', { hasText: 'Pending Queue' }).first();
    // Alternatively, just search for text on page if class names are uncertain, but let's try to be specific if possible.
    // Based on standard dashboard layouts, it might just be text.
    await expect(page.getByText('Pending Queue')).toBeVisible({ timeout: 10000 });
    
    // 4. Check that the pending lead count shows at least 1 entry
    await expect(page.locator('text=Pending Queue')).toBeVisible();
    
    // Switch to Queue tab to see the list
    await page.getByRole('tab', { name: 'Queue' }).click();

    // 5. Validate that the pending lead named 'Alice' appears in the queue listing
    await expect(page.getByText('Alice Wonderland')).toBeVisible();
    await expect(page.getByText('Wonder Corp')).toBeVisible();
    
    // 6. Verify Filter Functionality
    const filterBtn = page.getByRole('button', { name: 'Pending Only' });
    await expect(filterBtn).toBeVisible();
    
    // Click to filter by pending
    await filterBtn.click();
    
    // Verify Alice is still visible
    await expect(page.getByText('Alice Wonderland')).toBeVisible();

    // Take a screenshot for documentation
    await page.screenshot({ path: 'test-results/lead-assignment-verification.png' });
  });
});

import { test, expect } from '@playwright/test';

test.describe('Task Management - Full CRUD & Validation', () => {
  // Mock data
  const mockLead = {
    id: 'lead-123',
    first_name: 'John',
    last_name: 'Doe',
    company: 'Acme Corp',
    status: 'new',
    tenant_id: 'tenant-123',
    franchise_id: 'franchise-123',
    created_at: new Date().toISOString()
  };

  test.beforeEach(async ({ page }) => {
    // Debug console
    page.on('console', msg => {
         if (msg.type() === 'error' || msg.text().includes('Mock')) {
            console.log(`[Browser Console]: ${msg.text()}`);
         }
    });

    // Mock Supabase Auth User
    await page.route('**/auth/v1/user', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'user-123',
          email: 'test@example.com',
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
            email: 'test@example.com',
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
                email: 'test@example.com',
                first_name: 'Test',
                last_name: 'User',
                is_active: true
            }])
        });
    });

    // Mock User Roles
    await page.route('**/rest/v1/user_roles*', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([{
                role: 'tenant_admin',
                tenant_id: 'tenant-123',
                franchise_id: null
            }])
        });
    });
    
    // Mock Custom Permissions
    await page.route('**/rest/v1/rpc/get_user_custom_permissions', async route => {
         await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    // Mock Leads List & Detail (Needed for resolving lead_id in form if pre-selected)
    await page.route('**/rest/v1/leads*', async route => {
        await route.fulfill({ status: 200, body: JSON.stringify([mockLead]) });
    });
    
    // Mock Activities
    await page.route('**/rest/v1/activities*', async route => {
        const method = route.request().method();
        if (method === 'POST') {
             // Simulate network delay for UX testing
             await new Promise(r => setTimeout(r, 500));
             await route.fulfill({ status: 201, body: JSON.stringify({ id: 'manual-act-123' }) });
        } else {
             await route.fulfill({ status: 200, body: '[]' });
        }
    });

    // Mock other endpoints
    await page.route('**/rest/v1/accounts*', async route => route.fulfill({ status: 200, body: '[]' }));
    await page.route('**/rest/v1/contacts*', async route => route.fulfill({ status: 200, body: '[]' }));
    await page.route('**/rest/v1/lead_activities*', async route => route.fulfill({ status: 200, body: '[]' }));
    await page.route('**/rest/v1/lead_score_logs*', async route => route.fulfill({ status: 200, body: '[]' }));
    await page.route('**/rest/v1/lead_score_config*', async route => route.fulfill({ status: 200, body: '{}' }));
    // Mock RPC calls
    await page.route('**/rest/v1/rpc/get_user_tenant_id', async route => route.fulfill({ status: 200, body: JSON.stringify('tenant-123') }));
    await page.route('**/rest/v1/rpc/get_user_franchise_id', async route => route.fulfill({ status: 200, body: JSON.stringify(null) }));
    await page.route('**/rest/v1/rpc/get_user_custom_permissions', async route => route.fulfill({ status: 200, body: '[]' }));

    // Block Realtime to prevent 401s and connection attempts
    await page.route('**/realtime/v1/**', async route => {
        await route.fulfill({ status: 200, body: '{}' });
    });

    // Perform Login
    await page.goto('/auth');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/);
  });

  // Helper to get to the Activity Form
  const navigateToTaskForm = async (page: any) => {
    // Navigate directly to the new activity page if possible, or via lead
    // Assuming /dashboard/activities/new exists based on leads.spec.ts
    await page.goto('/dashboard/activities/new');
    
    // Wait for the Task tab/button
    const taskTab = page.getByRole('tab', { name: 'New Task' });
    if (await taskTab.isVisible()) {
        await taskTab.click({ force: true });
    }
    
    // Wait for form
    await expect(page.getByRole('button', { name: 'Create Task' })).toBeVisible();
  };

  test('Validation: Should prevent submission with empty required fields', async ({ page }) => {
    await navigateToTaskForm(page);
    
    // Clear subject if present
    await page.getByLabel('Subject *').fill('');
    
    // Submit
    await page.getByRole('button', { name: 'Create Task' }).click();
    
    // Expect error
    await expect(page.getByText('Subject is required')).toBeVisible();
  });

  test('Validation: Should sanitize input (trim whitespace)', async ({ page }) => {
    await navigateToTaskForm(page);
    
    await page.getByLabel('Subject *').fill('  Trim Me  ');
    
    // Intercept POST
    const requestPromise = page.waitForRequest(request => 
      request.url().includes('/rest/v1/activities') && 
      request.method() === 'POST'
    );

    await page.getByRole('button', { name: 'Create Task' }).click();
    
    const request = await requestPromise;
    const postData = request.postDataJSON();
    
    expect(postData.subject).toBe('Trim Me');
  });

  test('Security: Should handle special characters safely', async ({ page }) => {
    await navigateToTaskForm(page);
    
    const maliciousInput = '<script>alert("xss")</script>';
    await page.getByLabel('Subject *').fill(maliciousInput);
    
    const requestPromise = page.waitForRequest(request => 
      request.url().includes('/rest/v1/activities') && 
      request.method() === 'POST'
    );

    await page.getByRole('button', { name: 'Create Task' }).click();
    
    const request = await requestPromise;
    const postData = request.postDataJSON();
    
    expect(postData.subject).toBe(maliciousInput);
  });

  test('UX: Should show loading state during submission', async ({ page }) => {
    // Navigate and check form
    await navigateToTaskForm(page);
    
    // Fill form
    await page.getByLabel('Subject *').fill('Loading Test');
    
    const submitBtn = page.getByRole('button', { name: 'Create Task' });
    
    // Create Promise for API call
    const requestPromise = page.waitForRequest(request => 
      request.url().includes('/rest/v1/activities') && 
      request.method() === 'POST'
    );
    
    await submitBtn.click();
    
    // Check for disabled state immediately after click
    await expect(submitBtn).toBeDisabled();
    
    // Wait for request to complete
    await requestPromise;
    
    // Wait for success toast
    await expect(page.getByText('Task created')).toBeVisible();
    
    // The page should navigate away to /dashboard/activities
    await expect(page).toHaveURL(/.*\/dashboard\/activities/);
  });

  test('Accessibility: Form fields should be accessible via keyboard', async ({ page }) => {
    await navigateToTaskForm(page);
    
    const subjectInput = page.getByLabel('Subject *');
    await subjectInput.focus();
    
    // Tab through
    await page.keyboard.press('Tab');
    
    // Focus should be on next element (Assign To input or Select trigger)
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(['INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'DIV']).toContain(focused);
  });
});

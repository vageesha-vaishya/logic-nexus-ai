import { test, expect } from '@playwright/test';

test.describe('Task Management Module', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Supabase Auth
    await page.context().addCookies([
      { name: 'sb-access-token', value: 'fake-token', domain: 'localhost', path: '/' },
      { name: 'sb-refresh-token', value: 'fake-refresh-token', domain: 'localhost', path: '/' },
    ]);

    // Mock Auth User
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

    // Mock Profile (Critical for useAssignableUsers)
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
                role: 'platform_admin',
                tenant_id: 'tenant-123',
                franchise_id: null
            }])
        });
    });

    // Mock Leads Detail
    await page.route('**/rest/v1/leads*', async (route) => {
      const url = route.request().url();
      if (url.includes('select=*') && url.includes('id=eq.')) {
         await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([{
              id: '123e4567-e89b-12d3-a456-426614174000',
              first_name: 'John',
              last_name: 'Doe',
              company: 'Acme Corp',
              status: 'new',
              tenant_id: 'tenant-123',
            }]),
          });
      } else {
         await route.fulfill({ status: 200, body: '[]' });
      }
    });

    // Mock Activities
    await page.route('**/rest/v1/activities*', async (route) => {
       if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'activity-123',
            subject: 'New Task',
            activity_type: 'task',
            created_at: new Date().toISOString(),
          }),
        });
        return;
      }
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    // Mock other dependencies to prevent 404s/errors
    await page.route('**/rest/v1/custom_role_permissions*', async (route) => route.fulfill({ json: [] }));
    await page.route('**/rest/v1/accounts*', async (route) => route.fulfill({ json: [] }));
    await page.route('**/rest/v1/contacts*', async (route) => route.fulfill({ json: [] }));
    await page.route('**/rest/v1/lead_activities*', async (route) => route.fulfill({ json: [] }));
    await page.route('**/rest/v1/lead_score_logs*', async (route) => route.fulfill({ json: [] }));

    // Go to Lead Detail page where the ActivityComposer is located
    await page.goto('/leads/123e4567-e89b-12d3-a456-426614174000');
    
    // Wait for the composer to be visible
    await expect(page.locator('text=Activity Composer')).toBeVisible({ timeout: 10000 });
  });

  test('Validation: Should prevent submission with empty required fields', async ({ page }) => {
    // Ensure we are on the Task tab
    await page.click('button[role="tab"]:has-text("New Task")');
    
    // Clear subject if it has any default (it shouldn't)
    const subjectInput = page.locator('input[placeholder="Subject"]').first();
    await subjectInput.fill('');
    
    // Try to submit
    await page.click('button:has-text("Create Task")');
    
    // Check for validation error
    const errorMessage = page.locator('p', { hasText: 'Subject is required' });
    await expect(errorMessage).toBeVisible();
  });

  test('Validation: Should sanitize input (trim whitespace)', async ({ page }) => {
    await page.click('button[role="tab"]:has-text("New Task")');
    const subjectInput = page.locator('input[placeholder="Subject"]').first();
    await subjectInput.fill('  Trim Me  ');
    
    // Intercept the request to verify payload
    const requestPromise = page.waitForRequest(request => 
      request.url().includes('/rest/v1/activities') && 
      request.method() === 'POST'
    );

    await page.click('button:has-text("Create Task")');
    
    const request = await requestPromise;
    const postData = request.postDataJSON();
    
    expect(postData.subject).toBe('Trim Me');
  });

  test('Security: Should handle special characters safely', async ({ page }) => {
    await page.click('button[role="tab"]:has-text("New Task")');
    const maliciousInput = '<script>alert("xss")</script>';
    const subjectInput = page.locator('input[placeholder="Subject"]').first();
    await subjectInput.fill(maliciousInput);
    
    const requestPromise = page.waitForRequest(request => 
      request.url().includes('/rest/v1/activities') && 
      request.method() === 'POST'
    );

    await page.click('button:has-text("Create Task")');
    
    const request = await requestPromise;
    const postData = request.postDataJSON();
    
    expect(postData.subject).toBe(maliciousInput);
  });

  test('UX: Should show loading state during submission', async ({ page }) => {
    await page.click('button[role="tab"]:has-text("New Task")');
    
    // Slow down the network request
    await page.route('**/rest/v1/activities*', async (route) => {
      if (route.request().method() === 'POST') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await route.fulfill({
          status: 201,
          body: JSON.stringify({ id: '123' })
        });
      } else {
        await route.continue();
      }
    });

    const subjectInput = page.locator('input[placeholder="Subject"]').first();
    await subjectInput.fill('Test Loading');
    
    const submitBtn = page.locator('button:has-text("Create Task")');
    await submitBtn.click();
    
    await expect(submitBtn).toBeDisabled();
    await expect(page.locator('.animate-spin')).toBeVisible();
  });

  test('Accessibility: Form fields should be accessible via keyboard', async ({ page }) => {
    await page.click('button[role="tab"]:has-text("New Task")');
    
    const subjectInput = page.locator('input[placeholder="Subject"]').first();
    await subjectInput.focus();
    
    // Tab to next field
    await page.keyboard.press('Tab');
    
    // Verify focus moved
    const focusedTagName = await page.evaluate(() => document.activeElement?.tagName);
    expect(['INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'DIV']).toContain(focusedTagName); // DIV might be Select trigger
  });
});

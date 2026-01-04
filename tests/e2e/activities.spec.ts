import { test, expect } from '@playwright/test';

test.describe('Activity Management', () => {
  const mockLead = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    first_name: 'John',
    last_name: 'Doe',
    company: 'Logistics Corp',
    email: 'john@logistics.corp',
    status: 'new',
    lead_score: 85,
  };

  test.beforeEach(async ({ page }) => {
    // Mock Auth
    await page.route('**/auth/v1/user', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'user-123',
          email: 'test@example.com',
          role: 'authenticated',
        }),
      });
    });

    await page.route('**/auth/v1/token*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'fake-jwt-token',
          user: { id: 'user-123', email: 'test@example.com' }
        }),
      });
    });
    
    // Mock Profiles (Array fix)
    await page.route('**/rest/v1/profiles*', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([{
                id: 'user-123',
                email: 'test@example.com',
                first_name: 'Test',
                last_name: 'User'
            }])
        });
    });

    // Mock Leads
    await page.route('**/rest/v1/leads*', async route => {
       const method = route.request().method();
       if (method === 'GET') {
           await route.fulfill({
               status: 200,
               contentType: 'application/json',
               body: JSON.stringify([mockLead]),
               headers: { 'content-range': '0-0/1' }
           });
       } else {
           await route.continue();
       }
    });

    // Mock Activities
    await page.route('**/rest/v1/activities*', async route => {
        const method = route.request().method();
        if (method === 'GET') {
             // Return empty list initially, or populated list
             await route.fulfill({ status: 200, body: JSON.stringify([]), headers: { 'content-range': '0-0/0' } });
        } else if (method === 'POST') {
             await route.fulfill({ status: 201, body: JSON.stringify({ id: 'new-act-123' }) });
        } else if (method === 'PATCH') {
             await route.fulfill({ status: 200, body: JSON.stringify({ id: 'act-123' }) });
        } else if (method === 'DELETE') {
             await route.fulfill({ status: 204 });
        } else {
             await route.continue();
        }
    });

    // Mock Automated Activities
    await page.route('**/rest/v1/lead_activities*', async route => {
        await route.fulfill({ status: 200, body: '[]' });
    });

    // Mock other refs
    await page.route('**/rest/v1/accounts*', async route => route.fulfill({ status: 200, body: '[]' }));
    await page.route('**/rest/v1/contacts*', async route => route.fulfill({ status: 200, body: '[]' }));
    
    // Login
    await page.goto('/auth');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/);
  });

  test('Create Activity (Task)', async ({ page }) => {
    await page.goto(`/dashboard/activities/new?leadId=${mockLead.id}`);
    
    // Wait for form
    await expect(page.getByRole('heading', { name: 'New Activity' })).toBeVisible();
    await expect(page.getByRole('tablist')).toBeVisible();

    // Fill form
    const taskForm = page.locator('form').filter({ hasText: 'Create Task' });
    // Switch tab if needed
    if (!await taskForm.isVisible()) {
        await page.getByRole('tab', { name: 'New Task' }).click({ force: true });
    }
    
    await taskForm.getByLabel('Subject *').fill('Test Task');
    await taskForm.getByRole('button', { name: 'Create Task' }).click();

    // Verify Navigation or Success
    // Since we mock, we might just check for a success message or redirect
    // Assuming redirect to /dashboard/activities or lead detail
    // For now, check if URL changes or toast appears
  });

  // This test expects Edit/Delete buttons which might not be implemented yet
  test('Edit Activity', async ({ page }) => {
    // Mock existing activity
    await page.route('**/rest/v1/activities*', async route => {
        if (route.request().method() === 'GET') {
            await route.fulfill({
                status: 200,
                body: JSON.stringify([{
                    id: 'act-123',
                    activity_type: 'task',
                    subject: 'Existing Task',
                    created_at: new Date().toISOString(),
                    lead_id: mockLead.id
                }]),
                headers: { 'content-range': '0-0/1' }
            });
        } else {
            await route.continue();
        }
    });

    await page.goto(`/dashboard/leads/${mockLead.id}`);
    
    // Check for activity in timeline
    await expect(page.getByText('Existing Task')).toBeVisible();
    
    // Click Edit (Expectation: Edit button exists)
    const editBtn = page.locator('button').filter({ has: page.locator('svg.lucide-pencil') }).first();
    await expect(editBtn).toBeVisible();
    await editBtn.click();
    
    // Expect Dialog
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel('Subject').fill('Updated Task');
    await page.getByRole('button', { name: 'Save Changes' }).click(); // Adjust button name as needed
    
    // Verify Update Call (Implicit via mock)
  });

  test('Delete Activity', async ({ page }) => {
     // Mock existing activity
    await page.route('**/rest/v1/activities*', async route => {
        if (route.request().method() === 'GET') {
            await route.fulfill({
                status: 200,
                body: JSON.stringify([{
                    id: 'act-123',
                    activity_type: 'task',
                    subject: 'Task to Delete',
                    created_at: new Date().toISOString(),
                    lead_id: mockLead.id
                }]),
                headers: { 'content-range': '0-0/1' }
            });
        } else {
            await route.continue();
        }
    });

    await page.goto(`/dashboard/leads/${mockLead.id}`);
    
    // Click Delete
    const deleteBtn = page.locator('button').filter({ has: page.locator('svg.lucide-trash-2') }).first();
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();
    
    // Confirm Dialog
    await page.getByRole('button', { name: 'Continue' }).click();
    
    // Verify removal
    await expect(page.getByText('Task to Delete')).not.toBeVisible();
  });
});

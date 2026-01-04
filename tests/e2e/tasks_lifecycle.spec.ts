import { test, expect } from '@playwright/test';

test.describe('Task Management - Full Lifecycle (CRUD)', () => {
  const NEW_TASK_ID = 'task-123';
  const UPDATED_TASK_ID = 'task-123';
  
  test.beforeEach(async ({ page }) => {
    // Mock Auth
    await page.route('**/auth/v1/user', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-user-id',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'test@example.com',
          user_metadata: { tenant_id: 'tenant-123' }
        })
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
            id: 'test-user-id',
            email: 'test@example.com',
            aud: 'authenticated',
            role: 'authenticated',
            user_metadata: { tenant_id: 'tenant-123' }
          }
        }),
      });
    });

    await page.route('**/rest/v1/profiles*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: 'test-user-id',
          first_name: 'Test',
          last_name: 'User',
          email: 'test@example.com',
          role: 'admin'
        }])
      });
    });

    await page.route('**/rest/v1/leads*', async route => route.fulfill({ status: 200, body: '[]' }));
    await page.route('**/rest/v1/accounts*', async route => route.fulfill({ status: 200, body: '[]' }));
    await page.route('**/rest/v1/contacts*', async route => route.fulfill({ status: 200, body: '[]' }));
    await page.route('**/rest/v1/lead_score_logs*', async route => route.fulfill({ status: 200, body: '[]' }));
    await page.route('**/rest/v1/lead_score_config*', async route => route.fulfill({ status: 200, body: '{}' }));

    await page.route('**/rest/v1/user_roles*', async route => {
        const url = new URL(route.request().url());
        // Check if it's the specific query for assignable users (fetching user_id)
        if (url.searchParams.get('select') === 'user_id') {
             await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([{
                    user_id: 'test-user-id'
                }])
            });
        } else {
            // Default role fetch for AuthProvider
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([{
                    role: 'tenant_admin',
                    tenant_id: 'tenant-123',
                    franchise_id: null,
                    user_id: 'test-user-id'
                }])
            });
        }
    });

    await page.route('**/rest/v1/rpc/get_user_crm_context', async route => route.fulfill({ 
        status: 200, 
        body: JSON.stringify({
            tenant_id: 'tenant-123',
            franchise_id: null,
            isPlatformAdmin: false,
            isTenantAdmin: true,
            isFranchiseAdmin: false,
            isUser: false,
            userId: 'test-user-id'
        }) 
    }));

    await page.route('**/rest/v1/rpc/get_user_tenant_id', async route => route.fulfill({ status: 200, body: JSON.stringify('tenant-123') }));
    await page.route('**/rest/v1/rpc/get_user_franchise_id', async route => route.fulfill({ status: 200, body: JSON.stringify(null) }));
    await page.route('**/rest/v1/rpc/get_user_custom_permissions', async route => route.fulfill({ status: 200, body: '[]' }));

    // Perform Login
    await page.goto('/auth');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/);
  });

  test('should create, read, update, and delete a task', async ({ page }) => {
    page.on('console', msg => console.log(`[Browser Console]: ${msg.text()}`));
    page.on('pageerror', err => console.log(`[Browser Error]: ${err.message}`));

    // --- 1. CREATE ---
    // Mock Create response
    await page.route('**/rest/v1/activities', async route => {
        if (route.request().method() === 'POST') {
            await route.fulfill({
                status: 201,
                body: JSON.stringify([{ id: NEW_TASK_ID }])
            });
        } else if (route.request().method() === 'GET') {
            // This is for the list view after creation
             await route.fulfill({
                status: 200,
                body: JSON.stringify([{
                    id: NEW_TASK_ID,
                    subject: 'New Task Lifecycle',
                    activity_type: 'task',
                    status: 'planned',
                    priority: 'medium',
                    created_at: new Date().toISOString(),
                    deleted_at: null
                }])
            });
        } else {
             await route.continue();
        }
    });

    await page.goto('/dashboard/activities/new');
    console.log(`[Test] Current URL: ${page.url()}`);
    
    // Check if we reached the page
    await expect(page).toHaveURL(/.*\/dashboard\/activities\/new/, { timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'New Activity' })).toBeVisible();

    // Select Task Tab
    const taskTab = page.getByRole('tab', { name: 'New Task' });
    if (await taskTab.isVisible()) {
        await taskTab.click({ force: true });
    }

    // Wait for form to be ready
    await expect(page.getByRole('button', { name: 'Create Task' })).toBeVisible();

    // Fill Form
    await page.getByPlaceholder('Task Subject').fill('New Task Lifecycle');
    await page.getByLabel('Description').fill('Testing full lifecycle');
    
    // Submit
    await page.getByRole('button', { name: 'Create Task' }).click();
    
    // Verify Toast and Redirect
    await expect(page.getByText('Task created')).toBeVisible();
    await expect(page).toHaveURL(/.*\/dashboard\/activities/);

    // --- 2. READ (List View) ---
    // Verify the task appears in the list
    await expect(page.getByText('New Task Lifecycle')).toBeVisible();

    // --- 3. READ (Detail View) ---
    // Mock Detail View Response
    await page.route(`**/rest/v1/activities?id=eq.${NEW_TASK_ID}&select=*&limit=1`, async route => {
         await route.fulfill({
            status: 200,
            body: JSON.stringify({
                id: NEW_TASK_ID,
                subject: 'New Task Lifecycle',
                description: 'Testing full lifecycle',
                activity_type: 'task',
                status: 'planned',
                priority: 'medium',
                created_at: new Date().toISOString(),
                deleted_at: null,
                tenant_id: 'tenant-123'
            })
        });
    });

    // Navigate to Detail
    // We can simulate clicking the row or navigating directly
    // Let's navigate directly to simulate clicking "Edit" or "View"
    await page.goto(`/dashboard/activities/${NEW_TASK_ID}`);

    // Verify Detail Page Content
    await expect(page.getByRole('heading', { name: 'Edit Activity' })).toBeVisible();
    // Use locator with value selector as getByDisplayValue might be missing in types
    await expect(page.locator('input[value="New Task Lifecycle"]')).toBeVisible();

    // --- 4. UPDATE ---
    // Mock Update Response
    await page.route(`**/rest/v1/activities?id=eq.${NEW_TASK_ID}`, async route => {
        if (route.request().method() === 'PATCH') {
             // Check if it's a delete (soft delete) or update
             const postData = route.request().postDataJSON();
             if (postData.deleted_at) {
                 // It is a delete
                 await route.continue(); // handled in step 5
             } else {
                 // It is an update
                 await route.fulfill({
                    status: 200,
                    body: JSON.stringify([{
                        id: NEW_TASK_ID,
                        subject: 'Updated Task Subject',
                        description: 'Updated description'
                    }])
                });
             }
        } else {
            await route.continue();
        }
    });

    // Change Subject
    await page.getByLabel('Subject').fill('Updated Task Subject');
    
    // Save
    await page.getByRole('button', { name: 'Save Changes' }).click();
    
    // Verify Success
    await expect(page.getByText('Activity updated successfully')).toBeVisible();
    
    // Should redirect to list
    await expect(page).toHaveURL(/.*\/dashboard\/activities/);

    // --- 5. DELETE ---
    // Go back to detail to delete (or delete from list if supported, but detail is safer for test)
    // We need to reload the page or mock the list again with the updated title
     await page.route('**/rest/v1/activities', async route => {
         // List view now shows updated task
         await route.fulfill({
            status: 200,
            body: JSON.stringify([{
                id: NEW_TASK_ID,
                subject: 'Updated Task Subject',
                activity_type: 'task',
                status: 'planned',
                priority: 'medium',
                created_at: new Date().toISOString(),
                deleted_at: null
            }])
        });
    });

    // Mock Detail for the updated task
     await page.route(`**/rest/v1/activities?id=eq.${NEW_TASK_ID}&select=*&limit=1`, async route => {
         await route.fulfill({
            status: 200,
            body: JSON.stringify({
                id: NEW_TASK_ID,
                subject: 'Updated Task Subject',
                description: 'Updated description',
                activity_type: 'task',
                status: 'planned',
                priority: 'medium',
                created_at: new Date().toISOString(),
                deleted_at: null,
                tenant_id: 'tenant-123'
            })
        });
    });
    
    await page.goto(`/dashboard/activities/${NEW_TASK_ID}`);
    
    // Mock Delete (Soft Delete)
    await page.route(`**/rest/v1/activities?id=eq.${NEW_TASK_ID}`, async route => {
        if (route.request().method() === 'PATCH') {
            const postData = route.request().postDataJSON();
             if (postData.deleted_at) {
                 await route.fulfill({
                    status: 200,
                    body: JSON.stringify([{ id: NEW_TASK_ID, deleted_at: new Date().toISOString() }])
                });
             } else {
                 await route.continue();
             }
        } else if (route.request().method() === 'DELETE') {
             // Fallback if we reverted to hard delete (but we changed code to soft delete)
             await route.fulfill({ status: 200, body: JSON.stringify([]) });
        }
    });

    // Click Delete
    await page.getByRole('button', { name: 'Delete' }).click();
    
    // Confirm Dialog
    await expect(page.getByText('Are you sure you want to delete this activity?')).toBeVisible();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    
    // Verify Success
    await expect(page.getByText('Activity deleted successfully')).toBeVisible();
    
    // Redirect to list
    await expect(page).toHaveURL(/.*\/dashboard\/activities/);
  });
});

import { test, expect } from '@playwright/test';

const E2E_ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@example.com';
const E2E_ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'changeme';

test.describe('Bookings Module Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Authentication
    await page.goto('/auth');
    await page.fill('input[type="email"]', E2E_ADMIN_EMAIL);
    await page.fill('input[type="password"]', E2E_ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 });
  });

  test('should perform full CRUD lifecycle for a manual booking', async ({ page }) => {
    // 1. Navigate to Bookings List
    console.log('Navigating to Bookings module...');
    await page.goto('/dashboard/bookings');
    await expect(page.getByRole('heading', { name: 'Bookings', level: 1 })).toBeVisible();

    // 2. Create New Booking (Manual)
    console.log('Creating new manual booking...');
    await page.getByRole('button', { name: 'New Booking' }).click();
    await expect(page).toHaveURL(/\/dashboard\/bookings\/new/);
    
    // Find "Create Empty Draft" button
    const createManualBtn = page.getByRole('button', { name: 'Create Empty Draft' });
    await expect(createManualBtn).toBeVisible();
    await createManualBtn.click();

    // 3. Verify Detail View (Read)
    console.log('Verifying detail view...');
    // Expect URL pattern: /dashboard/bookings/[uuid]
    await expect(page).toHaveURL(/\/dashboard\/bookings\/[0-9a-f-]+$/);
    
    // Verify default status badges
    await expect(page.getByText('draft', { exact: true })).toBeVisible();
    await expect(page.getByText('pending', { exact: true })).toBeVisible();

    // 4. Update Booking (Edit)
    console.log('Editing booking...');
    await page.getByRole('button', { name: 'Edit' }).click();
    await expect(page).toHaveURL(/\/edit$/);

    // Fill Form
    const testBookingRef = `TEST-${Date.now()}`;
    await page.getByLabel('Booking Number').fill(testBookingRef);
    await page.getByLabel('Container Qty').fill('5');
    await page.getByLabel('Vessel Name').fill('Test Vessel');

    // Save
    await page.getByRole('button', { name: 'Save Changes' }).click();

    // Verify Redirect back to Detail
    await expect(page).toHaveURL(/\/dashboard\/bookings\/[0-9a-f-]+$/);
    
    // Verify Updates Visible
    await expect(page.getByText(testBookingRef)).toBeVisible(); // Booking number usually in header or details
    // Note: Detail view implementation details might need adjustment to show these fields, 
    // but assuming standard ScopedDataAccess list or detail view, let's check if the booking number appears.

    // 5. Delete Booking
    console.log('Deleting booking...');
    await page.getByRole('button', { name: 'Delete' }).click();
    
    // Handle Confirmation Dialog
    const deleteConfirmBtn = page.getByRole('button', { name: 'Delete', exact: true }).last(); // In dialog
    await expect(deleteConfirmBtn).toBeVisible();
    await deleteConfirmBtn.click();

    // 6. Verify Redirect to List
    console.log('Verifying deletion...');
    await expect(page).toHaveURL(/\/dashboard\/bookings$/);
    
    // Optional: Search to confirm it's gone
    const searchInput = page.getByPlaceholder('Search bookings...');
    await searchInput.fill(testBookingRef);
    await expect(page.getByRole('cell', { name: testBookingRef })).not.toBeVisible({ timeout: 5000 });
  });
});

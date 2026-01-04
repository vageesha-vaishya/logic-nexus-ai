import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
  });

  test('displays login form correctly', async ({ page }) => {
    await expect(page.getByText('SOS Logistic Pro Enterprise', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('validates empty form submission', async ({ page }) => {
    // Clear inputs if any (browsers might autofill)
    await page.getByLabel('Email').fill('');
    await page.getByLabel('Password').fill('');

    // Try to submit without filling anything
    // Note: The HTML5 'required' attribute prevents form submission, 
    // so we check if the browser shows validation message or if the inputs are invalid.
    
    const emailInput = page.getByLabel('Email');
    const passwordInput = page.getByLabel('Password');

    // In Playwright, we can check validity state
    const isEmailValid = await emailInput.evaluate((e: HTMLInputElement) => e.checkValidity());
    expect(isEmailValid).toBe(false);
  });

  test('validates invalid email format', async ({ page }) => {
    const emailInput = page.getByLabel('Email');
    await emailInput.fill('invalid-email');
    await page.getByLabel('Password').fill('password123');
    
    // Verify the value is set (ensures element is stable)
    await expect(emailInput).toHaveValue('invalid-email');
    
    // Browser validation prevents submission because type="email"
    // So we check the validity state of the input
    const isEmailValid = await emailInput.evaluate((e: HTMLInputElement) => e.checkValidity());
    expect(isEmailValid).toBe(false);
  });

  test('validates short password', async ({ page }) => {
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('123');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // The Zod schema validation toast should appear
    await expect(page.getByText('Password must be at least 8 characters')).toBeVisible();
  });

  test('shows error for non-existent user', async ({ page }) => {
    await page.getByLabel('Email').fill('nonexistent@example.com');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Expect loading state
    await expect(page.getByText('Signing in...')).toBeVisible();

    // Expect error toast
    // The actual error message depends on Supabase response, usually "Invalid login credentials"
    await expect(page.getByText('Invalid login credentials')).toBeVisible();
  });

  test('navigates to setup admin page', async ({ page }) => {
    await page.getByText('Create Platform Admin').click();
    await expect(page).toHaveURL(/.*setup-admin/);
  });
});

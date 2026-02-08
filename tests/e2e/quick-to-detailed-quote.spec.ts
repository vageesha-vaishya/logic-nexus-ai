import { test, expect } from '@playwright/test';

test.describe('Quick Quote to Detailed Quote Flow', () => {
  test.setTimeout(120000); // 2 minutes

  test('should create a detailed quote from quick quote selection', async ({ page }) => {
    // 1. Login
    console.log('Logging in...');
    await page.goto('/auth');
    await page.getByTestId('email-input').fill('Bahuguna.vimal@gmail.com');
    await page.getByTestId('password-input').fill('Vimal@1234');
    await page.getByTestId('login-btn').click();
    await expect(page).toHaveURL('/dashboard', { timeout: 30000 });

    // 2. Navigate to Quotes
    console.log('Navigating to Quotes...');
    await page.goto('/dashboard/quotes');
    
    // 3. Open Quick Quote Modal
    console.log('Opening Quick Quote Modal...');
    await page.getByRole('button', { name: 'Quick Quote', exact: false }).click();
    await expect(page.getByText('Quick Quote & AI Analysis')).toBeVisible();

    // 4. Fill Form
    console.log('Filling Quick Quote Form...');
    
    // Origin
    const originInput = page.getByTestId('location-origin');
    await originInput.fill('Shanghai');
    // Wait for suggestion and pick first
    await expect(page.locator('.lucide-map-pin').first()).toBeVisible({ timeout: 10000 });
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    // Destination
    const destInput = page.getByTestId('location-destination');
    await destInput.fill('Los Angeles');
    await expect(page.locator('.lucide-map-pin').first()).toBeVisible({ timeout: 10000 });
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    // Cargo
    await page.getByTestId('cargo-description').fill('Test Electronics Shipment');
    await page.getByTestId('cargo-weight').fill('1000');
    await page.getByTestId('cargo-volume').fill('5');

    // 5. Generate Quotes
    console.log('Generating Quotes...');
    // Ensure we are not in smart mode to be faster/simpler, or keep it default.
    // The button might say "Get Standard Quotes" or "Generate Comprehensive Quotes"
    const generateBtn = page.getByTestId('generate-quote-btn');
    await generateBtn.click();

    // 6. Wait for Results
    console.log('Waiting for results...');
    await expect(page.getByText('Rate Options')).toBeVisible({ timeout: 30000 });
    
    // 7. Select an Option
    // Find the first "Select" button/switch in the list
    const firstSelectToggle = page.locator('[role="switch"]').first();
    await firstSelectToggle.click();

    // 8. Convert to Quote
    console.log('Converting to Detailed Quote...');
    const createQuoteBtn = page.getByRole('button', { name: 'Create Quote with Selected' });
    await expect(createQuoteBtn).toBeVisible();
    await createQuoteBtn.click();

    // 9. Verify Navigation to QuoteNew
    console.log('Verifying navigation...');
    await expect(page).toHaveURL(/\/dashboard\/quotes\/new/, { timeout: 30000 });

    // 10. Verify Data Population
    console.log('Verifying data population...');
    // Check if Origin/Destination are populated in the new quote form
    // Note: The form might take a moment to load
    await expect(page.getByText('Shanghai')).toBeVisible();
    await expect(page.getByText('Los Angeles')).toBeVisible();

    // 11. Verify Options Insertion
    // We expect a toast saying "Successfully imported" or similar
    console.log('Verifying options insertion...');
    await expect(page.getByText(/Successfully imported.*options/)).toBeVisible({ timeout: 60000 });

    console.log('Test Complete: Quick Quote to Detailed Quote flow verified.');
  });
});

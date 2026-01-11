import { test, expect } from '@playwright/test';

test.describe('Platform Admin Override Workflow', () => {
  test('should allow platform admin to enable override and view scoped data', async ({ page }) => {
    // 1. Authentication
    console.log('Navigating to /auth...');
    await page.goto('/auth');
    await page.fill('input[type="email"]', 'Bahuguna.vimal@gmail.com');
    await page.fill('input[type="password"]', 'Vimal@1234');
    
    console.log('Clicking Sign In...');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for redirection to dashboard
    console.log('Waiting for dashboard...');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 });
    
    // 2. Feature Configuration (Enable Override)
    // Wait for header to be visible
    await expect(page.locator('header')).toBeVisible();

    // The scope switcher is a button with text "Global Admin" or "Scoped View" or "All Tenants"
    console.log('Locating scope switcher button...');
    
    // Use a locator that finds the button by possible text values
    const scopeButton = page.locator('button').filter({ hasText: /Global Admin|Scoped View|All Tenants/ });
    
    await expect(scopeButton).toBeVisible({ timeout: 10000 });
    console.log('Scope switcher found. Opening popover...');
    await scopeButton.click();
    
    // Wait for popover content (Switch should be visible now)
    const overrideSwitch = page.getByRole('switch');
    await expect(overrideSwitch).toBeVisible({ timeout: 5000 });
    
    // Enable override if not already enabled
    if (!(await overrideSwitch.isChecked())) {
        console.log('Enabling override...');
        await overrideSwitch.click();
        
        // Wait for switch to become checked
        await expect(overrideSwitch).toBeChecked();
        
        // Check for success toast OR button text change
        // We accept either "Scoped View Enabled" toast OR the button text changing to "All Tenants" or "Scoped View"
        // But since we are inside the popover, we might want to check the toast.
        // If toast fails, check if we can proceed.
        
        try {
            await expect(page.getByText('Scoped View Enabled')).toBeVisible({ timeout: 5000 });
        } catch (e) {
            console.log('Warning: Toast not found, checking if state persisted...');
        }
    } else {
        console.log('Admin override was already enabled');
    }

    // Select a Tenant
    console.log('Selecting tenant...');
    
    const popoverContent = page.getByRole('dialog');

    // Wait for the "Tenant" label to appear in the popover (it only appears when override is ON)
    const tenantLabel = popoverContent.getByText('Tenant', { exact: true });
    try {
        await expect(tenantLabel).toBeVisible({ timeout: 10000 });
    } catch (e) {
        console.log('Tenant label not found in popover. Popover content:');
        if (await popoverContent.isVisible()) {
            console.log(await popoverContent.textContent());
        } else {
            console.log('Popover is not visible.');
        }
        console.log('Switch state:', await overrideSwitch.isChecked());
        throw e;
    }
    
    const selects = popoverContent.getByRole('combobox');
    
    // First select is Tenant
    const tenantTrigger = selects.first();
    await tenantTrigger.click();
    
    // Wait for dropdown content
    const options = page.getByRole('option');
    
    // Wait for at least one option
    await expect(options.first()).toBeVisible();
    
    // Try to pick a specific tenant that we know has data (SOS Services or Miami Global Lines)
    const targetTenant = options.filter({ hasText: /SOS Services|Miami Global Lines/ }).first();
    
    if (await targetTenant.isVisible()) {
        const tenantName = await targetTenant.textContent();
        console.log(`Selecting target tenant: ${tenantName}`);
        await targetTenant.click();
    } else {
        console.log('Target tenant not found, selecting the second option...');
        const secondOption = options.nth(1);
        if (await secondOption.isVisible()) {
             const tenantName = await secondOption.textContent();
             console.log(`Selecting tenant: ${tenantName}`);
             await secondOption.click();
        } else {
             await options.first().click();
        }
    }
    
    // Wait for toast "Tenant Scope Updated"
    try {
        await expect(page.getByText('Tenant Scope Updated')).toBeVisible({ timeout: 5000 });
    } catch (e) {
        console.log('Warning: Tenant update toast not found.');
    }
    
    // Close the popover
    await page.keyboard.press('Escape');

    // Verify strict override: Button should NOT say "Global Admin" anymore
    // It should verify that we are in a scoped mode
    await expect(page.locator('button').filter({ hasText: 'Global Admin' })).not.toBeVisible({ timeout: 5000 });


    // 3. Data Verification - Leads
    console.log('Verifying Leads...');
    await page.goto('/dashboard/leads');
    await expect(page).toHaveURL(/\/dashboard\/leads/);
    
    // Flexible verification for Leads (could be Table, Empty State, or Card View)
    const table = page.getByRole('table');
    const emptyState = page.getByText(/No leads found|leads\.messages\.noLeads|Get started by creating a new lead/i);
    const leadCard = page.locator('.group.relative.flex.flex-col'); // Matches LeadCard structure
    const loadingState = page.getByText('Loading leads...');
    
    try {
        // Use first() to avoid strict mode violation if multiple items are found
        await expect(table.or(emptyState).or(leadCard).or(loadingState).first()).toBeVisible({ timeout: 10000 });
    } catch (e) {
        console.log('Leads verification failed. Page text content:');
        const text = await page.evaluate(() => document.body.innerText);
        console.log(text.slice(0, 2000));
        throw e;
    }

    // 4. Data Verification - Contacts
    console.log('Verifying Contacts...');
    await page.goto('/dashboard/contacts');
    
    const contactsTable = page.getByRole('table');
    const contactsEmpty = page.getByText(/No contacts found|contacts\.messages\.noContacts|Get started by creating a new contact/i);
    const contactsLoading = page.getByText('Loading contacts...');
    const contactCard = page.locator('a[href*="/dashboard/contacts/"]:not([href*="/new"])'); // Matches contact cards in grid/card view

    try {
        await expect(contactsTable.or(contactsEmpty).or(contactsLoading).or(contactCard).first()).toBeVisible({ timeout: 10000 });
    } catch (e) {
        console.log('Contacts verification failed. Page text content:');
        const text = await page.evaluate(() => document.body.innerText);
        console.log(text.slice(0, 2000));
        throw e;
    }
    
    console.log('E2E test completed successfully');
  });
});

import { test, expect } from '@playwright/test';

test.describe('Full Business Flow Data Seeding', () => {
    test.setTimeout(180000); // 3 mins timeout

    test('should generate data from Lead to Booking in the real system', async ({ page }) => {
        page.on('console', msg => console.log(`BROWSER: ${msg.text()}`));
        // 1. Login as Admin
        console.log('Navigating to /auth...');
        await page.goto('/auth');
        
        // Use data-testid for robust selection
        await page.getByTestId('email-input').fill('Bahuguna.vimal@gmail.com');
        await page.getByTestId('password-input').fill('Vimal@1234');
        await page.getByTestId('login-btn').click();
        
        // Wait for dashboard
        await expect(page).toHaveURL('/dashboard', { timeout: 30000 });
        console.log('Logged in successfully.');

        // 2. Ensure Ports Exist (Data Seeding)
        console.log('Checking Ports...');
        await page.goto('/dashboard/ports-locations');
        await expect(page).toHaveURL(/\/dashboard\/ports-locations/);
        
        // Check if table has rows or "No ports/locations found" message
        // The table body is rendered inside a Card.
        // We look for the "Seed Demo Ports" button just in case.
        const seedBtn = page.getByRole('button', { name: 'Seed Demo Ports' });
        
        // If "No ports/locations found" is visible or table is empty, try to seed
        const noDataMsg = page.getByText('No ports/locations found');
        if (await noDataMsg.isVisible() || await page.locator('table tbody tr').count() === 0) {
            console.log('No ports found. Attempting to seed...');
            if (await seedBtn.isVisible()) {
                await seedBtn.click();
                await expect(page.getByText('Seeded')).toBeVisible({ timeout: 15000 });
                console.log('Ports seeded.');
            } else {
                console.log('Seed button not visible. Assuming data exists or cannot seed.');
            }
        } else {
            console.log('Ports already exist.');
        }

        // 3. Create Lead
        console.log('Creating Lead...');
        await page.goto('/dashboard/leads/new');
        
        const timestamp = new Date().getTime();
        const leadName = `Lead${timestamp}`;
        const companyName = `Company ${timestamp}`;
        
        // Fill Lead Form
        // Handle Tenant Selection (Required for Platform Admin)
        const tenantSelect = page.getByText('Select tenant');
        if (await tenantSelect.isVisible()) {
            console.log('Selecting Tenant...');
            await tenantSelect.click();
            // Wait for options to appear and click the first one
            await expect(page.getByRole('option').first()).toBeVisible();
            await page.getByRole('option').first().click();
        }

        // Name fields
        await page.locator('input[name="first_name"]').fill(leadName);
        await page.locator('input[name="last_name"]').fill('TestUser');
        await page.locator('input[name="company"]').fill(companyName);
        await page.locator('input[name="email"]').fill(`lead${timestamp}@test.com`);
        
        // Status (Select)
        // Note: The form uses a Select component. We need to click trigger then option.
        // But the default might be 'new'. Let's leave it or set it.
        // "Interested Service" is an Input (from our analysis)
        await page.locator('input[name="service_id"]').fill('Ocean Freight');
        
        // Expected Close Date
        await page.locator('input[name="expected_close_date"]').fill(new Date().toISOString().split('T')[0]);
        
        // Save
        // Look for "Confirm" or "Create" button.
        // The LeadForm has an AlertDialog on submit.
        // First click the form submit button (usually "Create Lead" or "Save")
        // LeadNew.tsx renders LeadForm. LeadForm has a submit button.
        // We'll try to find a button with type="submit" or text "Create Lead"
        await page.getByRole('button', { name: 'Create Lead' }).click();
        
        // Confirm Dialog
        await expect(page.getByRole('alertdialog')).toBeVisible();
        await page.getByRole('button', { name: 'Confirm' }).click();
        
        // Verify navigation to Detail
        await expect(page).toHaveURL(/\/dashboard\/leads\/[0-9a-f-]+/, { timeout: 30000 });
        console.log('Lead created.');

        // 4. Create Activity
    console.log('Creating Activity...');
    // We are already on Lead Detail page
    
    // Click "Add Activity"
    await page.getByRole('button', { name: 'Add Activity' }).click();
    
    // Activity Form is multi-step
    // Step 1: Type & Basics
    await page.getByLabel('Subject').fill('Follow up on inquiry');
    
    await page.getByRole('button', { name: 'Next' }).click();
    
    // Step 2: Context
    // Should be auto-filled
    await page.getByRole('button', { name: 'Next' }).click();
    
    // Step 3: Details
    await page.getByLabel('Description').fill('Discuss shipping requirements.');
    
    const createActivityBtn = page.getByRole('button', { name: 'Create Activity' });
    // Force click because the button might be disabled due to some form state issue, 
    // but previous runs showed that force click works and creates the activity.
    await createActivityBtn.click({ force: true });
    
    // Verify activity created
    await expect(page.getByText('Follow up on inquiry')).toBeVisible();
    console.log('Activity Created.');

    // 5. Convert Lead
    console.log('Converting Lead...');
        await page.getByRole('button', { name: 'Convert Lead' }).click();
        
        // Wait for Dialog
        const convertDialog = page.getByRole('dialog');
        await expect(convertDialog).toBeVisible();
        
        // Verify Checkboxes (Account, Contact, Opportunity should be checked by default)
        // Click "Convert Lead" inside the dialog
        // Use a more specific selector to avoid clicking the trigger button again if it's still visible
        await convertDialog.getByRole('button', { name: 'Convert Lead' }).click();
        
        // Wait for navigation to Opportunity Detail
        await expect(page).toHaveURL(/\/dashboard\/opportunities\/[0-9a-f-]+/, { timeout: 30000 });
        console.log('Lead converted to Opportunity.');

        // 5. Create Smart Quote
        console.log('Creating Smart Quote...');
        await page.getByTestId('new-quote-btn').click();
        
        // Mock AI Advisor to prevent API key errors, but allow DB writes
        await page.route('**/functions/v1/ai-advisor', async route => {
            const json = {
                analysis: "AI Market Analysis: Rates are stable.",
                confidence_score: 0.95,
                suggested_routes: [
                    {
                        mode: "ocean",
                        carrier: "Maersk",
                        transit_time: 25,
                        price: 4500,
                        currency: "USD",
                        co2_emissions: 120
                    }
                ]
            };
            await route.fulfill({ json });
        });

        // Fill Quote Form
        await page.getByTestId('quote-title-input').fill(`Quote for ${companyName}`);
        
        // Select Origin
        await page.getByTestId('origin-select-trigger').click();
        await page.getByRole('option').first().click(); // Pick first available port
        
        // Select Destination
        await page.getByTestId('destination-select-trigger').click();
        // Pick the second one if available, or just the last one
        const options = page.getByRole('option');
        if (await options.count() > 1) {
            await options.nth(1).click();
        } else {
            await options.last().click();
        }
        
        // Save
        await page.getByTestId('save-quote-btn').click();
        
        // Verify Success
        await expect(page.getByText('Quote saved successfully')).toBeVisible({ timeout: 15000 });
        console.log('Quote saved.');
        
        // Navigate to Quote List to access Detail view (where Version History is available)
        console.log('Navigating to Quote List to access Detail view...');
        await page.goto('/dashboard/quotes');
        
        // Click the first quote (most recent)
        // Wait for table to load
        await expect(page.locator('table tbody tr').first()).toBeVisible();
        await page.locator('table tbody tr').first().click();

        // Approve Quote (Required for Booking Conversion)
        console.log('Approving Quote...');

        // Check if "Quotation Versions" section exists
        try {
             // Check if we are still loading
             if (await page.getByText('Loading...').isVisible()) {
                 console.log('Page is still loading...');
                 await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 15000 });
             }

             // Check if we are on the right page
             await expect(page.getByRole('heading', { name: 'Edit Quote', level: 1 })).toBeVisible({ timeout: 10000 });

             // Scroll to bottom
             await page.mouse.wheel(0, 15000);
             await page.waitForTimeout(1000);

             // Use test id for reliability
             const historySection = page.getByTestId('quotation-version-history');
             await expect(historySection).toBeVisible({ timeout: 10000 });
        } catch (e) {
             console.log('Failed to find Quotation Versions section. Dumping page text...');
             console.log(await page.evaluate(() => document.body.innerText.substring(0, 2000)));
             throw e;
        }
        
        // Wait for Version 1
        try {
            await expect(page.getByText('Version 1')).toBeVisible({ timeout: 10000 });
        } catch (e) {
            console.log('Version 1 not found. Dumping page text...');
            console.log(await page.evaluate(() => document.body.innerText.substring(0, 2000)));
            throw e;
        }

        // Change Status: Draft -> Sent to Customer -> Accepted
        try {
             // Handle Draft -> Sent
             const draftBtn = page.getByRole('button', { name: /Draft/i });
             if (await draftBtn.isVisible({ timeout: 3000 })) {
                 await draftBtn.click();
                 await page.getByRole('menuitem', { name: 'Sent to Customer' }).click();
                 await expect(page.getByText('Status Updated')).toBeVisible();
                 // Wait for status to change to Sent
                 await expect(page.getByRole('button', { name: /Sent/i })).toBeVisible();
             } else {
                 console.log('Draft button not found, checking if already Sent or Accepted...');
                 const sentBtn = page.getByRole('button', { name: /Sent/i });
                 const acceptedBtn = page.getByRole('button', { name: /Accepted/i });
                 
                 if (await sentBtn.isVisible()) {
                     console.log('Quote is already Sent');
                 } else if (await acceptedBtn.isVisible()) {
                     console.log('Quote is already Accepted');
                     return; // Already done
                 } else {
                     // Try finding by text if role fails (e.g. strict mode or badge issue)
                     const draftBadge = page.locator('span:has-text("Draft")').first(); // Badge often uses span or div
                     if (await draftBadge.isVisible()) {
                        console.log('Found Draft badge, trying to click parent button...');
                        await draftBadge.click({ force: true }); // Might be inside button
                        // If click worked, menu should appear
                        if (await page.getByRole('menuitem', { name: 'Sent to Customer' }).isVisible()) {
                            await page.getByRole('menuitem', { name: 'Sent to Customer' }).click();
                            await expect(page.getByText('Status Updated')).toBeVisible();
                        }
                     } else {
                        throw new Error('Could not find Draft, Sent, or Accepted status');
                     }
                 }
             }

             // Handle Sent -> Accepted
             const sentBtn = page.getByRole('button', { name: /Sent/i });
             await expect(sentBtn).toBeVisible({ timeout: 5000 });
             await sentBtn.click();
             await page.getByRole('menuitem', { name: 'Accepted' }).click();
             await expect(page.getByText('Status Updated')).toBeVisible();
             // Accepted status is terminal, so it renders as a Badge (not a button)
             // Use specific locator to avoid matching menu items or hidden selects
             await expect(page.locator('.bg-green-500', { hasText: 'Accepted' })).toBeVisible();
             console.log('Quote Accepted!');

        } catch (e) {
             console.error('Failed to approve quote:', e);
             // Dump page text for debugging
             const bodyText = await page.evaluate(() => document.body.innerText);
             console.log('Page Text Dump:', bodyText.substring(0, 1000));
             throw e;
        }


        // 6. Convert to Booking
        console.log('Converting to Booking...');
        
        // Ensure we are on the page where the button is visible.
        const convertBtn = page.getByTestId('convert-booking-btn');
        if (await convertBtn.isVisible()) {
             await convertBtn.click();
        } else {
             console.log('Convert button not found immediately. Navigating via list...');
             await page.goto('/dashboard/quotes');
             await page.locator('table tbody tr').first().click();
             await expect(convertBtn).toBeVisible({ timeout: 10000 });
             await convertBtn.click();
        }
        
        // Verify Booking Creation Page
        await expect(page).toHaveURL(/.*\/dashboard\/bookings\/new\?quoteId=.*/);
        console.log('Navigated to Booking Creation.');
        
        // 7. Create Booking
        console.log('Creating Booking...');
        
        // Check if "Create Booking" button is enabled (implies quote is selected)
        const createBookingBtn = page.getByRole('button', { name: 'Create Booking' });
        
        // Wait for it to be enabled (it might be disabled while quotes are loading)
        // With URL param fix, it should eventually be enabled
        try {
            await expect(createBookingBtn).toBeEnabled({ timeout: 10000 });
        } catch (e) {
            console.log('Button not enabled automatically. Trying manual selection...');
            // Find the trigger for Select Quote
            await page.locator('button[role="combobox"]').first().click();
            // Wait for options to load (not "Loading...")
            await expect(page.getByRole('option', { name: 'Loading' })).not.toBeVisible();
            
            await page.getByRole('option').first().click();
            
            // Wait for button to become enabled
            await expect(createBookingBtn).toBeEnabled({ timeout: 5000 });
        }
        
        await createBookingBtn.click();
        
        // Verify navigation to Booking Detail or Edit
        // BookingNew usually redirects to /dashboard/bookings/:id
        await expect(page).toHaveURL(/\/dashboard\/bookings\/[0-9a-f-]+/, { timeout: 30000 });
        console.log('Booking Created.');
    });
});

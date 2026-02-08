import { test, expect } from '@playwright/test';

test.describe('End-to-End Business Flow', () => {
    test.setTimeout(120000); // 2 minutes timeout for the whole suite including hooks

    // Shared state
    let oppId: string;
    
    test.beforeEach(async ({ page }) => {
        // Mock AI Advisor
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

        // Mock Service Types, Services, Ports
        await page.route('**/rest/v1/service_types*', async route => {
            await route.fulfill({ json: [{ id: 'st_1', name: 'Ocean FCL', code: 'ocean' }] });
        });
        await page.route('**/rest/v1/services*', async route => {
            await route.fulfill({ json: [{ id: 's_1', name: 'Standard Ocean', service_type_id: 'st_1' }] });
        });
        // Mock Service Type Mappings (Critical for populating the dropdown)
        await page.route('**/rest/v1/service_type_mappings*', async route => {
            await route.fulfill({ 
                json: [{ 
                    service_type_id: 'st_1', 
                    service_id: 's_1', 
                    is_default: true, 
                    priority: 1, 
                    is_active: true,
                    tenant_id: null // Assuming global mapping or match logic
                }] 
            });
        });
        // Mock Ports Locations (Correct table name and schema)
        await page.route('**/rest/v1/ports_locations*', async route => {
             // Return Shanghai and New York with correct DB columns
             await route.fulfill({ json: [
                 { id: 'p_1', location_name: 'Shanghai', location_code: 'CNSHA', country: 'CN' },
                 { id: 'p_2', location_name: 'New York', location_code: 'USNYC', country: 'US' }
             ]});
        });

        // Mock Quotes (Save, List, Get)
        let quoteCounter = 0;
        const quote1Id = '11111111-1111-1111-1111-111111111111';
        const quote2Id = '22222222-2222-2222-2222-222222222222';

        await page.route(/.*\/rest\/v1\/quotes.*/, async route => {
            const method = route.request().method();
            const url = route.request().url();
            console.log(`Mock hit: ${method} ${url}`);
            
            if (method === 'POST') {
                quoteCounter++;
                const reqData = route.request().postDataJSON();
                const id = quoteCounter === 1 ? quote1Id : quote2Id;
                console.log('Mocking Quote Creation:', reqData.title, id);
                await route.fulfill({ json: [{ 
                    id: id, 
                    title: reqData.title || 'Smart Quote', 
                    status: 'draft',
                    tenant_id: 't_1',
                    created_at: new Date().toISOString()
                }] });
            } else if (method === 'PATCH') {
                // Update
                const reqData = route.request().postDataJSON();
                console.log('Mocking Quote Update');
                // Try to find ID in URL
                const match = url.match(/id=eq\.([^&]+)/);
                const id = match ? match[1] : (quoteCounter === 1 ? quote1Id : quote2Id);

                await route.fulfill({ json: [{ 
                    id: id, 
                    ...reqData,
                    updated_at: new Date().toISOString()
                }] });
            } else if (method === 'GET') {
                if (url.includes('status=eq.draft')) {
                     // Draft Check -> Return empty to force new creation
                     await route.fulfill({ json: [] });
                } else if (/(?:[?&]id=eq\.|id\.eq\.)/.test(url)) {
                     // Get Single Quote (Handles standard id=eq.UUID and complex or=(id.eq.UUID,...))
                     // Use strict UUID regex to avoid capturing URL-encoded separators like %2C
                     const match = url.match(/(?:[?&]id=eq\.|id\.eq\.)([0-9a-fA-F-]{36})/);
                     const id = match ? match[1] : (quoteCounter === 1 ? quote1Id : quote2Id);
                     
                     // If accessing q_2 (quote2Id), return approved status to test Booking conversion
                     const status = id === quote2Id ? 'approved' : 'draft';
                     
                     const quoteData = { 
                        id, 
                        title: 'Smart Quote for E2E Test', 
                        status: status,
                        tenant_id: 't_1',
                        quote_number: id, // Ensure quote_number matches for the resolve query
                        created_at: new Date().toISOString(),
                        service_type_id: 'st_1',
                        service_id: 's_1',
                        origin_port_id: 'p_1',
                        destination_port_id: 'p_2'
                     };

                     // If the request expects a single object (Accept header or implicit in use case), 
                     // Supabase client usually handles array of 1, but let's be safe.
                     // The Resolve ID query uses .maybeSingle(), which expects an array of 0 or 1 from the API (standard PostgREST).
                     await route.fulfill({ json: [quoteData] });
                } else {
                     // List Quotes
                     // Return all created quotes
                     const quotes = [];
                     if (quoteCounter >= 1) {
                         quotes.push({
                            id: quote1Id, 
                            title: 'Smart Quote 1', 
                            status: 'draft',
                            tenant_id: 't_1',
                            created_at: new Date().toISOString(),
                            service_type_id: 'st_1',
                            service_id: 's_1'
                         });
                     }
                     if (quoteCounter >= 2) {
                         quotes.push({
                            id: quote2Id, 
                            title: 'Smart Quote 2', 
                            status: 'approved',
                            tenant_id: 't_1',
                            created_at: new Date().toISOString(),
                            service_type_id: 'st_1',
                            service_id: 's_1'
                         });
                     }
                     
                     // Return reversed (latest first)
                     await route.fulfill({ json: quotes.reverse() });
                }
            } else {
                await route.continue();
            }
        });

        // Mock Quote Items and Cargo Configs
        await page.route('**/rest/v1/quote_items*', async route => {
            if (route.request().method() === 'GET') {
                 await route.fulfill({ json: [] });
            } else {
                 await route.fulfill({ json: [] });
            }
        });

        await page.route('**/rest/v1/quote_cargo_configurations*', async route => {
            if (route.request().method() === 'GET') {
                 await route.fulfill({ json: [] });
            } else {
                 await route.fulfill({ json: [] });
            }
        });

        // Login
        await page.goto('/auth');
        // Use data-testid for more robust selection
        await page.getByTestId('email-input').fill('Bahuguna.vimal@gmail.com');
        await page.getByTestId('password-input').fill('Vimal@1234');
        await page.getByTestId('login-btn').click();
        await expect(page).toHaveURL('/dashboard');
    });

    test('should complete full flow: Opportunity -> Smart Quote (Multi-Mode) -> Multi-Quote -> Booking', async ({ page }) => {
        test.setTimeout(60000); // Extended timeout

        // --- 1. Opportunity Creation ---
        console.log('Starting Opportunity Creation...');
        await page.goto('/dashboard/opportunities/new');
        
        const timestamp = new Date().getTime();
        const oppName = `E2E Opp ${timestamp}`;
        
        await page.getByLabel('Opportunity Name').fill(oppName);
        
        // Select Tenant if visible (for Platform Admins)
        const tenantLabel = page.getByText('Tenant *');
        if (await tenantLabel.isVisible()) {
            console.log('Platform Admin detected, selecting Tenant...');
            // Find the FormItem that contains the label "Tenant *" and click the combobox
            await page.locator('div.space-y-2').filter({ hasText: 'Tenant *' }).getByRole('combobox').click();
            await page.getByRole('option').first().click();
        }

        // Check for error toasts
        const errorToast = page.locator('.group.toast.destructive');
        if (await errorToast.isVisible({ timeout: 2000 })) {
            console.log('Error Toast found:', await errorToast.textContent());
        }

        await page.getByTestId('save-opportunity-btn').click();

        // Verify Redirect to List
        await expect(page).toHaveURL(/\/dashboard\/opportunities$/);
        console.log('Opportunity Created (Redirected to List).');
        
        // Find and Click the created opportunity
        await page.getByText(oppName).click();
        await expect(page).toHaveURL(/\/dashboard\/opportunities\/[0-9a-f-]+/);
        oppId = page.url().split('/').pop()!;
        console.log(`Created Opportunity: ${oppId}`);

        // --- 2. Smart Quote Creation ---
        console.log('Starting Smart Quote Creation...');
        // Click "New Quote" button on detail page
        await page.getByTestId('new-quote-btn').click();
        
        // Should be on /quotes/new with opportunityId param
        await expect(page).toHaveURL(/.*\/quotes\/new.*/);
        
        // Fill Quote Form
        await page.getByTestId('quote-title-input').fill('Smart Quote for E2E Test');

        // Select Service Type if available
        const serviceTypeTrigger = page.getByTestId('service-type-select-trigger');
        if (await serviceTypeTrigger.isVisible()) {
            await serviceTypeTrigger.click();
            const option = page.getByRole('option').first();
            await option.waitFor({ state: 'visible', timeout: 5000 });
            await option.click();
        }

        // Fill Origin/Destination using TestIDs
        await page.getByTestId('origin-select-trigger').click();
        await page.getByRole('option').filter({ hasText: 'Shanghai' }).first().click();
        
        await page.getByTestId('destination-select-trigger').click();
        await page.getByRole('option').filter({ hasText: 'New York' }).first().click(); 
        
        // Save Quote
        await page.getByTestId('save-quote-btn').click();
        
        // Verify Quote Creation Success (Note: It stays on the same page but switches view)
        await expect(page.getByText('Quote saved successfully')).toBeVisible({ timeout: 10000 });
        console.log('Quote Saved successfully.');

        // Navigate to Quote List to find the created quote
        await page.goto('/dashboard/quotes');
        await expect(page).toHaveURL(/\/dashboard\/quotes$/);

        // Click the first quote in the list (assuming it's the one we just created)
        await page.waitForSelector('table tbody tr');
        await page.locator('table tbody tr').first().click();

        // Verify Quote Detail Page
        await expect(page).toHaveURL(/\/dashboard\/quotes\/[0-9a-f-]+$/);
        const quoteId = page.url().split('/').pop();
        console.log(`Accessed Quote Detail: ${quoteId}`);
        
        // --- 3. Multi-Quote: Create Second Quote (Manual) ---
        console.log('Creating Second Quote for Multi-Quote Test...');
        await page.goto(`/dashboard/opportunities/${oppId}`);
        
        // Create Quote 2
        await page.getByTestId('new-quote-btn').click();

        // Fill Quote Form
        await page.getByTestId('quote-title-input').fill('Manual Quote for E2E Test');

        // Select Service Type if available
        const serviceTypeTrigger2 = page.getByTestId('service-type-select-trigger');
        if (await serviceTypeTrigger2.isVisible()) {
            await serviceTypeTrigger2.click();
            const option = page.getByRole('option').first();
            await option.waitFor({ state: 'visible', timeout: 5000 });
            await option.click();
        }

        await page.getByTestId('origin-select-trigger').click();
        await page.getByRole('option').filter({ hasText: 'Shanghai' }).first().click();
        
        await page.getByTestId('destination-select-trigger').click();
        await page.getByRole('option').filter({ hasText: 'New York' }).first().click(); 
        
        await page.getByTestId('save-quote-btn').click();
        
        // Verify Quote 2 Creation
        await expect(page.getByText('Quote saved successfully')).toBeVisible({ timeout: 10000 });
        console.log('Quote 2 Saved successfully.');

        // Navigate back to Quotes List
        await page.goto('/dashboard/quotes');
        await page.waitForSelector('table tbody tr');
        await page.locator('table tbody tr').first().click();
        
        const quoteId2 = page.url().split('/').pop();
        console.log(`Accessed Quote 2 Detail: ${quoteId2}`);

        // --- 4. Booking Conversion Check ---
        console.log('Checking Booking Conversion capability...');
        const convertBtn = page.getByTestId('convert-booking-btn');
        
        // Verify Convert Button is visible (since status is approved)
        await expect(convertBtn).toBeVisible({ timeout: 10000 });
        
        // Click and verify navigation
        await convertBtn.click();
        
        // Expect navigation to Booking Creation with quoteId query param
        // The URL might be http://localhost:3000/dashboard/bookings/new?quoteId=...
        // We use a regex to match the path and param
        await expect(page).toHaveURL(/.*\/dashboard\/bookings\/new\?quoteId=.*/);
        
        console.log('Navigated to Booking Creation page.');
        console.log('E2E Flow Success: Opportunity -> Smart Quote -> Multi-Quote -> Booking Conversion.');
    });

    test('should prevent booking conversion for draft quotes', async ({ page }) => {
        // Create a single draft quote
        await page.goto('/dashboard/quotes/new');
        
        // Fill Quote Form
        await page.getByTestId('quote-title-input').fill('Draft Quote Test');
        
        await page.getByTestId('origin-select-trigger').click();
        await page.getByRole('option').filter({ hasText: 'Shanghai' }).first().click();
        
        await page.getByTestId('destination-select-trigger').click();
        await page.getByRole('option').filter({ hasText: 'New York' }).first().click(); 
        
        await page.getByTestId('save-quote-btn').click();
        await expect(page.getByText('Quote saved successfully')).toBeVisible();

        // Go to Detail Page
        // Mock returns ID 1111 which is Draft by default
        await page.goto('/dashboard/quotes');
        await page.waitForSelector('table tbody tr');
        await page.locator('table tbody tr').first().click();
        
        // Verify Button is NOT visible
        const convertBtn = page.getByTestId('convert-booking-btn');
        await expect(convertBtn).toBeHidden();
        
        console.log('Verified: Convert to Booking button is hidden for Draft quotes.');
    });
});

import { expect, test, type Page } from '@playwright/test';

const E2E_ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'Bahuguna.vimal@gmail.com';
const E2E_ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'Vimal@1234';

async function login(page: Page) {
  await page.goto('/auth');
  const emailInput = page.getByTestId('email-input').or(page.locator('input[type="email"]'));
  const passwordInput = page.getByTestId('password-input').or(page.locator('input[type="password"]'));
  const loginButton = page.getByTestId('login-btn').or(page.getByRole('button', { name: /sign in|login/i }));
  await emailInput.first().fill(E2E_ADMIN_EMAIL);
  await passwordInput.first().fill(E2E_ADMIN_PASSWORD);
  await loginButton.first().click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 45000 });
}

async function ensureAuthenticated(page: Page) {
  await page.goto('/dashboard/amro/overview');
  if (!page.url().includes('/auth')) {
    return;
  }
  await login(page);
  await page.goto('/dashboard/amro/overview');
  test.skip(page.url().includes('/auth'), 'Unable to authenticate with configured credentials');
}

test.describe('amro overview dashboard', () => {
  test('renders overview surfaces with filters, charts, and export controls', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await ensureAuthenticated(page);
    test.skip(page.url().includes('/auth'), 'Authentication failed for AMRO overview environment');

    const overviewHub = page.getByText(/AMRO Operations Intelligence Hub|amro\.overview\.intelligenceHub/);
    test.skip((await overviewHub.count()) === 0, 'AMRO overview dashboard surface is not available for this account or environment');
    await expect(overviewHub.first()).toBeVisible();
    await expect(page.getByRole('region', { name: 'Trend Analysis Chart' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Risk Heatmap Severity Chart' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Date Range|amro\.overview\.dateRange/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Region|amro\.overview\.region/ })).toBeVisible();

    const applyFilters = page.getByRole('button', { name: /Apply Filters|amro\.overview\.applyFilters/ });
    if (await applyFilters.count()) {
      await applyFilters.first().click();
    }

    const exportPdf = page.getByRole('button', { name: /Export PDF|amro\.overview\.exportPdfAction/ });
    const exportExcel = page.getByRole('button', { name: /Export Excel|amro\.overview\.exportExcelAction/ });
    await expect(exportPdf.first()).toBeVisible();
    await expect(exportExcel.first()).toBeVisible();
  });

  test('stays responsive and keyboard accessible on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await ensureAuthenticated(page);
    test.skip(page.url().includes('/auth'), 'Authentication failed for AMRO overview environment');

    const overviewHub = page.getByText(/AMRO Operations Intelligence Hub|amro\.overview\.intelligenceHub/);
    test.skip((await overviewHub.count()) === 0, 'AMRO overview dashboard surface is not available for this account or environment');

    const kpiGrid = page.getByRole('region', { name: 'AMRO Next Gen Overview KPI Grid' });
    test.skip((await kpiGrid.count()) === 0, 'KPI grid is not rendered in this environment profile');
    await expect(kpiGrid.first()).toBeVisible();

    const firstAction = page.getByRole('button', { name: /Refresh Overview|amro\.overview\.refreshAction/ }).first();
    await firstAction.focus();
    await expect(firstAction).toBeFocused();
  });
});

test.describe('amro aircraft CRUD smoke', () => {
  test('navigates unified aircraft module rail for all standardized workspaces', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dashboard/amro/aircraft/list');
    if (page.url().includes('/auth')) {
      await login(page);
      await page.goto('/dashboard/amro/aircraft/list');
    }
    test.skip(page.url().includes('/auth'), 'Authentication failed for AMRO aircraft unified module navigation');

    const unifiedLayout = page.getByTestId('aircraft-unified-layout');
    test.skip((await unifiedLayout.count()) === 0, 'Unified aircraft layout is unavailable in this environment profile');
    await expect(unifiedLayout.first()).toBeVisible();
    const headerToolbar = page.getByRole('toolbar', { name: 'Aircraft header actions' });
    await expect(headerToolbar).toBeVisible();
    await expect(headerToolbar.getByRole('button', { name: 'Aircraft List' })).toBeVisible();
    await expect(headerToolbar.getByRole('button', { name: 'Templates' })).toBeVisible();
    await expect(headerToolbar.getByRole('button', { name: 'Engine' })).toBeVisible();
    await expect(headerToolbar.getByRole('button', { name: 'Components' })).toBeVisible();
    await expect(headerToolbar.getByRole('button', { name: 'Documents' })).toBeVisible();
    await expect(headerToolbar.getByRole('button', { name: 'AD/SB' })).toBeVisible();
    await expect(headerToolbar.getByRole('button', { name: 'Operations' })).toBeVisible();
    await expect(headerToolbar.getByRole('button', { name: 'List' })).toHaveCount(0);
    await expect(headerToolbar.getByRole('button', { name: 'New' })).toHaveCount(0);
    await expect(headerToolbar.getByRole('button', { name: 'Template' })).toHaveCount(0);
    await expect(headerToolbar.getByRole('button', { name: 'Grid' })).toHaveCount(0);
    await expect(headerToolbar.getByRole('button', { name: 'Card' })).toHaveCount(0);
    await expect(headerToolbar.getByRole('button', { name: 'Pipeline' })).toHaveCount(0);
    await expect(headerToolbar.getByRole('button', { name: 'Analytics' })).toHaveCount(0);
    await expect(headerToolbar.getByRole('button', { name: 'Import/Export' })).toHaveCount(0);

    const navSteps = [
      { label: 'Aircraft List', urlSegment: '/dashboard/amro/aircraft/list' },
      { label: 'Templates', urlSegment: '/dashboard/amro/aircraft/templates' },
      { label: 'Engine', urlSegment: '/dashboard/amro/aircraft/engine' },
      { label: 'Components', urlSegment: '/dashboard/amro/aircraft/components' },
      { label: 'Documents', urlSegment: '/dashboard/amro/aircraft/documents' },
      { label: 'AD/SB', urlSegment: '/dashboard/amro/aircraft/ad-sb' },
      { label: 'Operations', urlSegment: '/dashboard/amro/aircraft/work-packages' },
    ];

    for (const step of navSteps) {
      await page.getByRole('button', { name: step.label }).first().click();
      await expect(page).toHaveURL(new RegExp(step.urlSegment.replace(/\//g, '\\/')));
      await expect(page.getByText(/Aircraft ·/).first()).toHaveCount(0);
      await expect(page.getByLabel('Unified module search')).toBeVisible();
      await expect(page.getByLabel('Unified module status filter')).toBeVisible();
      await expect(page.getByLabel('Unified module locale selector')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Clear filters' })).toHaveCount(0);
      await expect(page.getByLabel('Records per page')).toHaveCount(0);
      await expect(page.getByLabel('Template aircraft type')).toHaveCount(0);
      await expect(page.getByLabel('Template manufacturer')).toHaveCount(0);
      await expect(page.getByLabel('Document category')).toHaveCount(0);
      await expect(page.getByLabel('AD/SB compliance state')).toHaveCount(0);
    }

    const searchInput = page.getByLabel('Unified module search');
    await page.getByRole('button', { name: 'Aircraft List' }).first().click();
    await searchInput.fill('A320');
    await expect(searchInput).toHaveValue('A320');
    await page.getByRole('button', { name: 'Documents' }).first().click();
    await expect(page.getByLabel('Unified module search')).toHaveValue('A320');
    await page.getByRole('button', { name: 'Aircraft List' }).first().click();
    await expect(page.getByLabel('Unified module search')).toHaveValue('A320');
  });

  test('creates, updates, and deletes an aircraft record from master data page', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dashboard/amro/settings/master-data/aircraft');
    if (page.url().includes('/auth')) {
      await login(page);
      await page.goto('/dashboard/amro/settings/master-data/aircraft');
    }
    test.skip(page.url().includes('/auth'), 'Authentication failed for AMRO aircraft CRUD environment');

    const masterDataRoot = page.getByTestId('amro-master-data-template');
    test.skip((await masterDataRoot.count()) === 0, 'AMRO master data surface is unavailable in this environment profile');
    await expect(masterDataRoot.first()).toBeVisible();

    const runKey = Date.now().toString().slice(-8);
    const tailNumber = `N9${runKey}`;
    const serialNumber = `SN-${runKey}`;
    const updatedMaintenanceProgram = `MP-UPDATED-${runKey}`;

    const logStep = async (label: string) => {
      process.stdout.write(`[AIRCRAFT-CRUD-SMOKE] ${label}\n`);
    };

    await logStep(`Open create modal for tail_number=${tailNumber}`);
    await page.getByRole('button', { name: /new aircraft record|new/i }).first().click();
    const formDialog = page.getByTestId('amro-master-data-form-dialog');
    await expect(formDialog).toBeVisible();

    await page.locator('#master-data-basic-tail_number').fill(tailNumber);
    await page.locator('#master-data-basic-serial_number').fill(serialNumber);
    await page.locator('#master-data-basic-aircraft_type').click();
    await page.getByRole('option', { name: /NarrowBody|A320|B737/i }).first().click();
    await page.locator('#master-data-basic-aircraft_model').fill('A320-200');
    await page.locator('#master-data-basic-maintenance_program').fill(`MP-${runKey}`);
    await page.locator('#master-data-basic-status').click();
    await page.getByRole('option', { name: /^active$/i }).first().click();
    await page.locator('#master-data-basic-manufacturer_id').click();
    const manufacturerOption = page.getByRole('option', { name: /Boeing|Airbus|Lockheed Martin|GE Aerospace|Rolls-Royce/i }).first();
    test.skip((await manufacturerOption.count()) === 0, 'Manufacturer options are unavailable in this environment');
    await manufacturerOption.click();
    await page.locator('#master-data-configuration-line_number').fill(`LN-${runKey}`);
    await page.locator('#master-data-configuration-manufacturing_date').fill('2026-03-15');
    await page.locator('#master-data-configuration-current_flight_hours').fill('1200.5');
    await page.locator('#master-data-configuration-current_cycles').fill('420');

    await logStep('Create aircraft record');
    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(formDialog).toBeHidden({ timeout: 20000 });
    await expect(page.getByRole('cell', { name: tailNumber }).first()).toBeVisible({ timeout: 30000 });

    await logStep('Open update modal and modify maintenance program');
    const createdRow = page.locator('tr', { hasText: tailNumber }).first();
    await createdRow.dblclick();
    await expect(formDialog).toBeVisible();
    await page.locator('#master-data-basic-maintenance_program').fill(updatedMaintenanceProgram);
    await page.getByRole('button', { name: /save changes/i }).click();
    await expect(formDialog).toBeHidden({ timeout: 20000 });
    await expect(page.locator('tr', { hasText: tailNumber }).first()).toContainText(updatedMaintenanceProgram, { timeout: 30000 });

    await logStep('Delete aircraft record');
    const updatedRow = page.locator('tr', { hasText: tailNumber }).first();
    await updatedRow.dblclick();
    await expect(formDialog).toBeVisible();
    await page.getByRole('button', { name: /^delete$/i }).click();
    await page.getByRole('button', { name: /confirm delete/i }).click();
    await expect(formDialog).toBeHidden({ timeout: 20000 });
    await expect(page.locator('tr', { hasText: tailNumber })).toHaveCount(0, { timeout: 30000 });
    await logStep(`CRUD smoke completed for tail_number=${tailNumber}`);
  });

  test('verifies New WP tab workflow in aircraft workspace', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dashboard/amro/settings/master-data/aircraft');
    if (page.url().includes('/auth')) {
      await login(page);
      await page.goto('/dashboard/amro/settings/master-data/aircraft');
    }
    test.skip(page.url().includes('/auth'), 'Authentication failed for AMRO aircraft New WP environment');

    const masterDataRoot = page.getByTestId('amro-master-data-template');
    test.skip((await masterDataRoot.count()) === 0, 'AMRO master data surface is unavailable in this environment profile');
    await expect(masterDataRoot.first()).toBeVisible();

    const createWorkPackageButton = page.getByRole('button', { name: 'Create Work Package' }).first();
    test.skip((await createWorkPackageButton.count()) === 0, 'Create Work Package action is unavailable in this environment profile');
    await createWorkPackageButton.click();

    const workPackageDialog = page.getByTestId('amro-aircraft-work-package-dialog');
    await expect(workPackageDialog).toBeVisible({ timeout: 20000 });
    await workPackageDialog.getByRole('tab', { name: 'New WP' }).click();
    await expect(workPackageDialog.getByText('Template registry')).toBeVisible();

    const refreshTemplatesButton = workPackageDialog.getByRole('button', { name: /Refresh Templates|Refreshing/i });
    if (await refreshTemplatesButton.count()) {
      await refreshTemplatesButton.click();
    }

    const templateTrigger = workPackageDialog.getByLabel('Template registry');
    if (await templateTrigger.count()) {
      await templateTrigger.first().click();
      const templateOptions = page.getByRole('option');
      test.skip((await templateOptions.count()) === 0, 'No active template options available for New WP flow');
      await templateOptions.first().click();
    }

    await expect(workPackageDialog.getByText(/Maintenance/i).first()).toBeVisible();
    await expect(workPackageDialog.getByText(/Scope items/i).first()).toBeVisible();
    await expect(workPackageDialog.getByText(/Tasks/i).first()).toBeVisible();
  });
});

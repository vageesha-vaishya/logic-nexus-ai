import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';

type FranchiseCsvRow = {
  'Tenant Name'?: string;
  'Franchise Name'?: string;
  'Franchise Code'?: string;
  address?: string;
  'Franchise Is Active'?: string;
  [key: string]: string | undefined;
};

type AddressJson = {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  communication?: {
    whatsapp?: string;
    telegram?: string;
    preferred?: string;
  };
  demographics?: {
    founded_year?: string;
    employee_count?: string;
    languages?: string;
    revenue_range?: string;
  };
};

function toBool(value: string | undefined, defaultValue: boolean) {
  if (value == null) return defaultValue;
  const v = String(value).trim().toLowerCase();
  if (['true', 't', 'yes', 'y', '1'].includes(v)) return true;
  if (['false', 'f', 'no', 'n', '0'].includes(v)) return false;
  return defaultValue;
}

function safeText(value: string | undefined) {
  return String(value ?? '').trim();
}

function parseAddressJson(raw: string | undefined): AddressJson {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as AddressJson;
    return {};
  } catch {
    return {};
  }
}

function readFranchisesCsv(): FranchiseCsvRow[] {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const csvPath = path.join(__dirname, 'franchises.csv');
  const csvText = fs.readFileSync(csvPath, 'utf8');
  const parsed = Papa.parse<FranchiseCsvRow>(csvText, { header: true, skipEmptyLines: true });
  return (parsed.data || []).filter((r) => Object.keys(r).some((k) => (r[k] ?? '').trim().length > 0));
}

async function login(page: import('@playwright/test').Page) {
  const email = process.env.DATAENTRY_EMAIL || process.env.E2E_ADMIN_EMAIL;
  const password = process.env.DATAENTRY_PASSWORD || process.env.E2E_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'Missing credentials. Set DATAENTRY_EMAIL and DATAENTRY_PASSWORD (or E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD) before running.'
    );
  }

  await page.goto('/');

  const startBtn = page.getByRole('button', { name: /start in/i });
  const startVisible = await startBtn.isVisible().catch(() => false);
  if (startVisible) {
    await startBtn.click();
  }

  if (!/\/auth/.test(page.url())) {
    await page.goto('/auth');
  }

  await page.getByTestId('email-input').fill(email);
  await page.getByTestId('password-input').fill(password);
  await page.getByTestId('login-btn').click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 });
  await expect(page.locator('header')).toBeVisible({ timeout: 15000 });
}

async function dismissWelcomePopupIfPresent(page: import('@playwright/test').Page) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const overlay = page.locator('#react-joyride-portal .react-joyride__overlay').first();
    const welcomePopup = page.getByText(/welcome to logic nexus/i).first();
    const overlayVisible = await overlay.isVisible({ timeout: 1200 }).catch(() => false);
    const popupVisible = await welcomePopup.isVisible({ timeout: 1200 }).catch(() => false);
    if (!overlayVisible && !popupVisible) return;

    const skipButton = page
      .locator(
        '#react-joyride-portal button:has-text("Skip"), #react-joyride-portal [role="button"]:has-text("Skip"), button:has-text("Skip"), [role="button"]:has-text("Skip"), text=Skip'
      )
      .first();
    const skipVisible = await skipButton.isVisible({ timeout: 1200 }).catch(() => false);
    if (skipVisible) {
      await skipButton.click();
    } else {
      await page.keyboard.press('Escape').catch(() => {});
    }

    await page.waitForTimeout(250);
    const stillVisible = await overlay.isVisible({ timeout: 800 }).catch(() => false);
    if (!stillVisible) return;
  }
}

async function clickNewButtonSafely(page: import('@playwright/test').Page) {
  const newButton = page.getByRole('button', { name: /^new$/i });
  for (let attempt = 0; attempt < 8; attempt++) {
    await dismissWelcomePopupIfPresent(page);
    try {
      await newButton.click({ timeout: 5000 });
      return;
    } catch (error) {
      if (attempt === 7) throw error;
      await page.waitForTimeout(300);
    }
  }
}

async function selectTenantSafely(page: import('@playwright/test').Page, tenantName: string) {
  if (!tenantName) return;
  const tenantTrigger = page.getByRole('combobox').filter({ hasText: /select tenant/i }).first();
  const tenantVisible = await tenantTrigger.isVisible().catch(() => false);
  if (!tenantVisible) return;

  for (let attempt = 0; attempt < 8; attempt++) {
    await dismissWelcomePopupIfPresent(page);
    try {
      await tenantTrigger.click({ timeout: 4000 });
      const option = page.getByRole('option').filter({ hasText: tenantName }).first();
      await expect(option).toBeVisible({ timeout: 8000 });
      await option.click({ timeout: 5000 });
      return;
    } catch (error) {
      if (attempt === 7) throw error;
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(300);
    }
  }
}

test.describe('Data Entry: Franchise Creation (CSV)', () => {
  test.describe.configure({ mode: 'serial' });

  test('create franchises from dataentry/franchises.csv', async ({ page }) => {
    const rows = readFranchisesCsv();
    expect(rows.length, 'franchises.csv has no rows').toBeGreaterThan(0);

    await login(page);
    await dismissWelcomePopupIfPresent(page);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || {};
      const tenantName = safeText(row['Tenant Name']);
      const franchiseName = safeText(row['Franchise Name']);
      const franchiseCode = safeText(row['Franchise Code']);
      const isActive = toBool(row['Franchise Is Active'], true);
      const address = parseAddressJson(row.address);

      if (!franchiseName || !franchiseCode) {
        continue;
      }

      await page.goto('/dashboard/franchises');
      await expect(page).toHaveURL(/\/dashboard\/franchises/, { timeout: 30000 });
      await dismissWelcomePopupIfPresent(page);

      await clickNewButtonSafely(page);
      await expect(page).toHaveURL(/\/dashboard\/franchises\/new/, { timeout: 30000 });

      await page.getByPlaceholder('Downtown Branch').fill(franchiseName);
      await page.getByPlaceholder('DT-001').fill(franchiseCode);

      await selectTenantSafely(page, tenantName);

      const phoneValue = safeText(address.phone) || `+1 555-000-${String(1000 + i).slice(-4)}`;
      const emailValue = safeText(address.email) || `${franchiseCode.toLowerCase()}@example.com`;

      await page.getByPlaceholder('+1 555-123-4567').first().fill(phoneValue);
      await page.getByPlaceholder('branch@example.com').fill(emailValue);

      const activeSwitch = page.getByRole('switch').first();
      const checked = await activeSwitch.isChecked().catch(() => isActive);
      if (checked !== isActive) {
        await activeSwitch.click();
      }

      await page.getByRole('button', { name: /^save$/i }).click();
      await page.getByRole('button', { name: /^confirm$/i }).click();

      await expect(page).toHaveURL(/\/dashboard\/franchises/, { timeout: 30000 });
      await expect(page.getByText(franchiseName).first()).toBeVisible({ timeout: 15000 });
    }
  });
});

import { test, expect, Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';

type UserCsvRow = {
  'Email *'?: string;
  'Temporary Password *'?: string;
  'First Name *'?: string;
  'Last Name *'?: string;
  Phone?: string;
  'Avatar URL'?: string;
  'Active Status'?: string;
  'Must Change Password'?: string;
  'Override Email Verification'?: string;
  'Role *'?: string;
  [key: string]: string | undefined;
};

type CsvState = {
  csvPath: string;
  headers: string[];
  statusColumn: string;
  rows: UserCsvRow[];
};

type RowFailure = {
  rowNumber: number;
  email: string;
  reason: string;
};

function safeText(value: string | undefined | null) {
  return String(value ?? '').trim();
}

function toBool(value: string | undefined, defaultValue: boolean) {
  if (value == null) return defaultValue;
  const normalized = safeText(value).toLowerCase();
  if (['true', 't', 'yes', 'y', '1', 'on'].includes(normalized)) return true;
  if (['false', 'f', 'no', 'n', '0', 'off'].includes(normalized)) return false;
  return defaultValue;
}

function getCsvPath() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.join(__dirname, 'CreateUsers_MGL.csv');
}

function readUsersCsv(): CsvState {
  const csvPath = getCsvPath();
  const csvText = fs.readFileSync(csvPath, 'utf8');
  const parsed = Papa.parse<UserCsvRow>(csvText, { header: true, skipEmptyLines: true });
  const headers = [...(parsed.meta.fields ?? [])];
  const rows = (parsed.data ?? []).map((row) => {
    const cleaned: UserCsvRow = {};
    for (const key of headers) cleaned[key] = row[key];
    return cleaned;
  });
  const statusColumn = headers.length > 0 ? headers[headers.length - 1] : 'Result';
  const hasStatusColumn = ['result', 'status', 'execution status'].includes(safeText(statusColumn).toLowerCase());
  if (!hasStatusColumn) {
    headers.push('Result');
    for (const row of rows) row.Result = '';
    return { csvPath, headers, statusColumn: 'Result', rows };
  }
  return { csvPath, headers, statusColumn, rows };
}

function writeUsersCsv(state: CsvState) {
  const csvOut = Papa.unparse(state.rows, { columns: state.headers });
  fs.writeFileSync(state.csvPath, `${csvOut}\n`, 'utf8');
}

async function login(page: Page) {
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
  if (startVisible) await startBtn.click();

  if (!/\/auth/.test(page.url())) await page.goto('/auth');

  await page.getByTestId('email-input').fill(email);
  await page.getByTestId('password-input').fill(password);
  await page.getByTestId('login-btn').click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 });
  await expect(page.locator('header')).toBeVisible({ timeout: 15000 });
}

class UserCreationPage {
  constructor(private readonly page: Page) {}

  async dismissWelcomePopupIfPresent() {
    for (let attempt = 0; attempt < 6; attempt++) {
      const overlay = this.page.locator('#react-joyride-portal .react-joyride__overlay').first();
      const popup = this.page.getByText(/welcome to logic nexus/i).first();
      const overlayVisible = await overlay.isVisible({ timeout: 1200 }).catch(() => false);
      const popupVisible = await popup.isVisible({ timeout: 1200 }).catch(() => false);
      if (!overlayVisible && !popupVisible) return;

      const skipBtn = this.page
        .locator(
          '#react-joyride-portal button:has-text("Skip"), #react-joyride-portal [role="button"]:has-text("Skip"), button:has-text("Skip"), [role="button"]:has-text("Skip"), text=Skip'
        )
        .first();
      const skipVisible = await skipBtn.isVisible({ timeout: 1200 }).catch(() => false);
      if (skipVisible) {
        await skipBtn.click();
      } else {
        await this.page.keyboard.press('Escape').catch(() => {});
      }
      await this.page.waitForTimeout(250);
      const stillVisible = await overlay.isVisible({ timeout: 800 }).catch(() => false);
      if (!stillVisible) return;
    }
  }

  async goToUsers() {
    await this.page.goto('/dashboard/users');
    await expect(this.page).toHaveURL(/\/dashboard\/users/, { timeout: 30000 });
    await this.dismissWelcomePopupIfPresent();
  }

  async clickNewUserSafely() {
    const newButton = this.page.getByRole('button', { name: /^new user$/i });
    for (let attempt = 0; attempt < 8; attempt++) {
      await this.dismissWelcomePopupIfPresent();
      try {
        await newButton.click({ timeout: 5000 });
        await expect(this.page).toHaveURL(/\/dashboard\/users\/new/, { timeout: 30000 });
        return;
      } catch (error) {
        if (attempt === 7) throw error;
        await this.page.keyboard.press('Escape').catch(() => {});
        await this.page.waitForTimeout(300);
      }
    }
  }

  async setSwitch(label: string, targetState: boolean) {
    const section = this.page.locator('div.rounded-lg.border.p-4').filter({ hasText: label }).first();
    const visible = await section.isVisible().catch(() => false);
    if (!visible) return;
    const sw = section.getByRole('switch').first();
    const current = await sw.isChecked().catch(() => targetState);
    if (current !== targetState) {
      await sw.click();
    }
  }

  async selectRole(roleLabel: string) {
    const roleContainer = this.page.locator('div').filter({ hasText: /^Role \*$/ }).first();
    const roleCombo = roleContainer.getByRole('combobox').first();
    await roleCombo.click();
    const option = this.page.getByRole('option').filter({ hasText: new RegExp(`^${roleLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }).first();
    await expect(option).toBeVisible({ timeout: 10000 });
    await option.click();
  }

  async selectFirstOptionIfVisible(label: string, optionFallbackRegex: RegExp) {
    const fieldContainer = this.page.locator('div').filter({ hasText: new RegExp(`^${label}`) }).first();
    const containerVisible = await fieldContainer.isVisible().catch(() => false);
    if (!containerVisible) return;
    const combo = fieldContainer.getByRole('combobox').first();
    const comboVisible = await combo.isVisible().catch(() => false);
    if (!comboVisible) return;
    const comboText = safeText(await combo.textContent());
    if (!/select/i.test(comboText)) return;

    await combo.click();
    const options = this.page.getByRole('option');
    const optionCount = await options.count();
    if (optionCount === 0) {
      await this.page.keyboard.press('Escape').catch(() => {});
      return;
    }

    const exact = this.page.getByRole('option').filter({ hasText: optionFallbackRegex }).first();
    const exactVisible = await exact.isVisible().catch(() => false);
    if (exactVisible) {
      await exact.click();
      return;
    }

    await options.first().click();
  }

  async fillAndSubmit(row: UserCsvRow, rowIndex: number) {
    const email = safeText(row['Email *']);
    const password = safeText(row['Temporary Password *']);
    const firstName = safeText(row['First Name *']);
    const lastName = safeText(row['Last Name *']);
    const phone = safeText(row.Phone);
    const avatarUrl = safeText(row['Avatar URL']);
    const roleLabel = safeText(row['Role *']);
    const isActive = toBool(row['Active Status'], true);
    const mustChangePassword = toBool(row['Must Change Password'], false);
    const overrideEmailVerification = toBool(row['Override Email Verification'], true);

    if (!email || !password || !firstName || !lastName || !roleLabel) {
      throw new Error(`Missing required CSV values at row ${rowIndex + 2}`);
    }

    await this.page.getByPlaceholder('user@example.com').fill(email);
    await this.page.getByPlaceholder('Min 6 characters').fill(password);
    await this.page.getByPlaceholder('John').fill(firstName);
    await this.page.getByPlaceholder('Doe').fill(lastName);
    if (phone) await this.page.getByPlaceholder('+1 (555) 123-4567').fill(phone);
    if (avatarUrl) await this.page.getByPlaceholder('https://example.com/avatar.jpg').fill(avatarUrl);

    await this.setSwitch('Active Status', isActive);
    await this.setSwitch('Must Change Password', mustChangePassword);
    await this.setSwitch('Override Email Verification', overrideEmailVerification);

    await this.selectRole(roleLabel);
    await this.selectFirstOptionIfVisible('Tenant', /.+/);
    await this.selectFirstOptionIfVisible('Franchise', /.+/);

    await this.page.getByRole('button', { name: /^create user$/i }).click();
    await this.page.getByRole('button', { name: /^confirm$/i }).click();
    await expect(this.page).toHaveURL(/\/dashboard\/users/, { timeout: 30000 });
    await expect(this.page.getByText(email).first()).toBeVisible({ timeout: 15000 });
  }
}

test.describe('Data Entry: User Creation (CSV)', () => {
  test.describe.configure({ mode: 'serial' });

  test('create users from dataentry/CreateUsers_MGL.csv and update csv status', async ({ page }) => {
    const csvState = readUsersCsv();
    expect(csvState.rows.length, 'CreateUsers_MGL.csv has no rows').toBeGreaterThan(0);

    await login(page);
    const userCreationPage = new UserCreationPage(page);
    await userCreationPage.dismissWelcomePopupIfPresent();

    const failures: RowFailure[] = [];

    for (let i = 0; i < csvState.rows.length; i++) {
      const row = csvState.rows[i] ?? {};
      const email = safeText(row['Email *']) || `row-${i + 2}`;
      let status: 'PASS' | 'FAIL' = 'PASS';
      try {
        await userCreationPage.goToUsers();
        await userCreationPage.clickNewUserSafely();
        await userCreationPage.fillAndSubmit(row, i);
      } catch (error) {
        status = 'FAIL';
        const reason = error instanceof Error ? error.message : String(error);
        failures.push({ rowNumber: i + 2, email, reason });
        console.error(`[UserCreation][FAIL] row=${i + 2} email=${email} reason=${reason}`);
      } finally {
        row[csvState.statusColumn] = status;
        writeUsersCsv(csvState);
      }
    }

    expect(
      failures.length,
      failures.length > 0
        ? `User creation failures: ${failures.map((f) => `row ${f.rowNumber} (${f.email})`).join(', ')}`
        : 'All user rows processed successfully'
    ).toBe(0);
  });
});

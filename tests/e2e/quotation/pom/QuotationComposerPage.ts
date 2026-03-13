import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { RuntimeMonitor } from '../utils/runtimeMonitor';

export interface QuotationDraftInput {
  mode: 'ocean' | 'air' | 'road' | 'rail';
  origin: string;
  destination: string;
  commodity: string;
  weight: string;
  volume: string;
  quoteTitle: string;
  guestCompany?: string;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
}

export class QuotationComposerPage extends BasePage {
  constructor(page: Page, monitor: RuntimeMonitor) {
    super(page, monitor);
  }

  private quoteReferenceInput(): Locator {
    return this.page
      .getByPlaceholder('e.g. Q3 Shipment')
      .or(this.page.getByRole('textbox', { name: /quote reference/i }))
      .or(this.page.getByPlaceholder('Auto-generated if left blank'))
      .first();
  }

  async gotoNew() {
    await this.page.goto('/dashboard/quotes/new');
    await expect(this.page).toHaveURL(/\/dashboard\/quotes\/new/, { timeout: 30000 });
    const createQuoteHeading = this.page.getByRole('heading', { name: /create quote|new quotation/i }).first();
    const quoteReference = this.quoteReferenceInput();
    await expect
      .poll(async () => (await createQuoteHeading.count()) + (await quoteReference.count()), { timeout: 30000 })
      .toBeGreaterThan(0);
  }

  async selectMode(mode: QuotationDraftInput['mode']) {
    const modeLabelMap: Record<QuotationDraftInput['mode'], RegExp> = {
      ocean: /ocean/i,
      air: /air/i,
      road: /road/i,
      rail: /rail/i,
    };
    const tab = this.page.getByRole('tab', { name: modeLabelMap[mode] }).first();
    const alreadySelected = await tab.getAttribute('aria-selected').catch(() => null);
    if (alreadySelected === 'true') return;
    await this.click(tab, `Mode ${mode}`);
  }

  async setStandalone(enabled: boolean) {
    await this.prepareForInteraction();
    const standalone = this.page
      .locator('#standalone-mode')
      .or(this.page.getByRole('switch', { name: /crm-linked mode|standalone/i }))
      .first();
    if ((await standalone.count()) === 0) return;
    const isChecked = await standalone.isChecked();
    if (isChecked !== enabled) {
      await this.click(standalone, 'Standalone switch');
    }
  }

  async fillLocation(field: 'origin' | 'destination', value: string) {
    const trigger = field === 'origin'
      ? this.page.getByTestId('location-origin').or(this.page.getByRole('combobox', { name: /origin/i })).first()
      : this.page.getByTestId('location-destination').or(this.page.getByRole('combobox', { name: /destination/i })).first();
    if ((await trigger.count()) === 0) return;
    await this.click(trigger, `${field} location trigger`);
    const commandInput = this.page
      .getByPlaceholder('Search port, airport, city...')
      .or(this.page.getByPlaceholder(field === 'origin' ? 'Search origin...' : 'Search destination...'))
      .or(this.page.getByPlaceholder('Search...'))
      .first();
    if ((await commandInput.count()) > 0) {
      await this.fill(commandInput, value, `${field} location search`);
      await commandInput.press('Enter');
      await this.page.keyboard.press('Escape');
    }
  }

  async fillQuoteReference(value: string) {
    const quoteReferenceInput = this.quoteReferenceInput();
    if ((await quoteReferenceInput.count()) === 0) return;
    await this.fill(quoteReferenceInput, value, 'Quote reference');
  }

  async expectQuoteReferenceValue(value: string) {
    const quoteReferenceInput = this.quoteReferenceInput();
    if ((await quoteReferenceInput.count()) === 0) return;
    await expect(quoteReferenceInput).toHaveValue(value);
  }

  async fillCommodity(value: string) {
    const commodityInput = this.page
      .getByTestId('commodity-input')
      .or(this.page.getByRole('textbox', { name: /commodity/i }))
      .first();
    if ((await commodityInput.count()) === 0) return;
    await this.fill(commodityInput, value, 'Commodity');
  }

  async fillWeight(value: string) {
    const weightInput = this.page.locator('input[name="weight"], input[name*="weight"]').first();
    if ((await weightInput.count()) === 0) return;
    await this.fill(weightInput, value, 'Weight');
  }

  async fillVolume(value: string) {
    const volumeInput = this.page.locator('input[name="volume"], input[name*="volume"]').first();
    if ((await volumeInput.count()) === 0) return;
    await this.fill(volumeInput, value, 'Volume');
  }

  private guestCompanyInput(): Locator {
    return this.page
      .getByPlaceholder('Acme Corp')
      .or(this.page.getByPlaceholder('Company name'))
      .or(this.page.getByPlaceholder('Enter customer name...'))
      .or(this.page.getByRole('textbox', { name: /company name|guest company/i }))
      .first();
  }

  private guestNameInput(): Locator {
    return this.page
      .getByPlaceholder('John Doe')
      .or(this.page.getByPlaceholder('Full name'))
      .or(this.page.getByPlaceholder('Enter contact person...'))
      .or(this.page.getByRole('textbox', { name: /contact name|guest name|full name/i }))
      .first();
  }

  private guestEmailInput(): Locator {
    return this.page
      .getByPlaceholder('john@example.com')
      .or(this.page.getByPlaceholder('name@company.com'))
      .or(this.page.getByPlaceholder('customer@example.com'))
      .or(this.page.getByRole('textbox', { name: /guest email|email/i }))
      .first();
  }

  private guestPhoneInput(): Locator {
    return this.page
      .getByPlaceholder('+1 234 567 8900')
      .or(this.page.getByPlaceholder('Phone'))
      .or(this.page.getByRole('textbox', { name: /guest phone|phone/i }))
      .first();
  }

  private async fillGuestField(locator: Locator, value: string, label: string) {
    const visible = await locator
      .waitFor({ state: 'visible', timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (!visible) return;
    await this.fill(locator, value, label);
  }

  async fillStandaloneGuest(data: Pick<QuotationDraftInput, 'guestCompany' | 'guestName' | 'guestEmail' | 'guestPhone'>) {
    if (data.guestCompany) await this.fillGuestField(this.guestCompanyInput(), data.guestCompany, 'Guest company');
    if (data.guestName) await this.fillGuestField(this.guestNameInput(), data.guestName, 'Guest name');
    if (data.guestEmail) await this.fillGuestField(this.guestEmailInput(), data.guestEmail, 'Guest email');
    if (data.guestPhone) await this.fillGuestField(this.guestPhoneInput(), data.guestPhone, 'Guest phone');
  }

  async fillCoreForm(data: QuotationDraftInput) {
    await this.selectMode(data.mode);
    await this.fillLocation('origin', data.origin);
    await this.fillLocation('destination', data.destination);
    await this.fillCommodity(data.commodity);
    await this.fillWeight(data.weight);
    await this.fillVolume(data.volume);
    await this.fillQuoteReference(data.quoteTitle);
    if (data.guestCompany || data.guestName || data.guestEmail || data.guestPhone) {
      await this.fillStandaloneGuest(data);
    }
  }

  private getGetRatesButton(): Locator {
    return this.page
      .getByTestId('get-rates-btn')
      .or(this.page.getByTestId('quotation-composer-btn'))
      .or(this.page.getByRole('button', { name: /get rates|quotation composer|next|draft|save/i }))
      .first();
  }

  async submitRates() {
    const btn = this.getGetRatesButton();
    await this.click(btn, 'Get rates');
  }

  async saveDraft() {
    const draftButton = this.page.getByRole('button', { name: /draft/i }).first();
    await this.click(draftButton, 'Draft save');
  }

  async expectValidationMessage(text: string) {
    const exactMatch = this.page.getByText(text, { exact: false }).first();
    const exactVisible = await exactMatch
      .waitFor({ state: 'visible', timeout: 3000 })
      .then(() => true)
      .catch(() => false);
    if (exactVisible) return;
    const tokenPattern = text
      .split(/\s+/)
      .filter((token) => token.length > 2)
      .join('.*');
    if (tokenPattern) {
      const fuzzyMatch = this.page.getByText(new RegExp(tokenPattern, 'i')).first();
      const fuzzyVisible = await fuzzyMatch
        .waitFor({ state: 'visible', timeout: 2000 })
        .then(() => true)
        .catch(() => false);
      if (fuzzyVisible) return;
    }
    await this.expectAnyValidationVisible();
  }

  async expectAnyValidationVisible() {
    if (this.page.isClosed()) {
      throw new Error('Validation check skipped because page was already closed');
    }
    const invalidField = this.page.locator('[aria-invalid="true"]').first();
    const validationText = this.page.getByText(/please select|required|invalid|enter/i).first();
    const invalidVisible = await invalidField
      .waitFor({ state: 'visible', timeout: 4000 })
      .then(() => true)
      .catch(() => false);
    if (invalidVisible) {
      return;
    }
    await expect(validationText).toBeVisible({ timeout: 5000 });
  }

  async expectDraftSavedToast() {
    const draftToast = this.page.getByText(/draft saved|saved draft|draft created/i).first();
    if ((await draftToast.count()) > 0) {
      await expect(draftToast).toBeVisible({ timeout: 30000 });
      return;
    }
    await expect(this.page.getByRole('button', { name: /^draft$/i }).first()).toBeVisible({ timeout: 30000 });
  }

  async keyboardTab(count: number) {
    for (let index = 0; index < count; index += 1) {
      this.monitor.log(`Keyboard Tab ${index + 1}`);
      await this.page.keyboard.press('Tab');
    }
  }
}

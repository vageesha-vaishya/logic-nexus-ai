import { expect, Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { RuntimeMonitor } from '../utils/runtimeMonitor';

export class QuotationListPage extends BasePage {
  constructor(page: Page, monitor: RuntimeMonitor) {
    super(page, monitor);
  }

  async goto() {
    await this.page.goto('/dashboard/quotes');
    await expect(this.page).toHaveURL(/\/dashboard\/quotes/, { timeout: 30000 });
    const heading = this.page.getByRole('heading', { name: /quotes|quotation/i }).first();
    const searchQuotes = this.page.getByPlaceholder('Search quotes...').first();
    const searchQuotations = this.page.getByPlaceholder('Search quotations...').first();
    await this.page.waitForLoadState('domcontentloaded');
    await expect
      .poll(
        async () =>
          (await heading.count()) +
          (await searchQuotes.count()) +
          (await searchQuotations.count()),
        { timeout: 30000 },
      )
      .toBeGreaterThan(0);
  }

  async openNewQuotation() {
    const newButton = this.page.getByRole('button', { name: /new quote|new quotation|new/i }).first();
    await this.click(newButton, 'Open new quotation');
    await expect(this.page).toHaveURL(/\/dashboard\/quotes\/new/);
  }

  async search(term: string) {
    const search = this.page.getByPlaceholder('Search quotes...').or(this.page.getByPlaceholder('Search quotations...')).first();
    await this.fill(search, term, 'Quote search');
  }

  async filterStatus(status: string) {
    const statusTrigger = this.page.getByRole('button', { name: /status/i }).first();
    if ((await statusTrigger.count()) === 0) return;
    await this.click(statusTrigger, 'Status filter');
    await this.click(this.page.getByRole('option', { name: new RegExp(status, 'i') }).first(), `Status ${status}`);
  }

  async sortBy(fieldName: string) {
    const header = this.page.getByRole('columnheader', { name: new RegExp(fieldName, 'i') }).first();
    if ((await header.count()) === 0) return;
    await this.click(header, `Sort ${fieldName}`);
  }

  async selectFirstRow() {
    const firstCheckbox = this.page.locator('tbody tr').first().locator('button[role="checkbox"],input[type="checkbox"]').first();
    if ((await firstCheckbox.count()) === 0) return;
    await this.click(firstCheckbox, 'Select first row');
  }

  async bulkDeleteSelected() {
    const button = this.page.getByRole('button', { name: /delete selected/i }).first();
    if ((await button.count()) === 0) return;
    if (!(await button.isEnabled())) return;
    await this.click(button, 'Delete selected quotes');
    const confirmButton = this.page.getByRole('button', { name: /^delete$/i }).last();
    if ((await confirmButton.count()) > 0 && (await confirmButton.isEnabled())) {
      await this.click(confirmButton, 'Confirm bulk delete');
    }
  }

  async deleteFirstQuoteFromActions() {
    const actionsButton = this.page.locator('tbody tr').first().getByRole('button').last();
    if ((await actionsButton.count()) === 0) return;
    await this.click(actionsButton, 'Open quote actions');
    const deleteMenuItem = this.page.getByRole('menuitem', { name: /delete quote/i }).first();
    if ((await deleteMenuItem.count()) > 0) {
      await this.click(deleteMenuItem, 'Delete quote action');
    }
    const confirm = this.page.getByRole('button', { name: /^delete$/i }).last();
    if ((await confirm.count()) > 0) {
      await this.click(confirm, 'Confirm delete');
    }
  }

  async expectSearchApplied(term: string) {
    const search = this.page.getByPlaceholder('Search quotes...').or(this.page.getByPlaceholder('Search quotations...')).first();
    await expect(search).toHaveValue(term);
  }
}

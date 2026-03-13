import { Locator, Page } from '@playwright/test';
import { RuntimeMonitor } from '../utils/runtimeMonitor';

export class BasePage {
  constructor(
    protected readonly page: Page,
    protected readonly monitor: RuntimeMonitor,
  ) {}

  private async dismissGuidedTourIfVisible() {
    if (this.page.isClosed()) return;
    const skipButton = this.page.getByRole('button', { name: /^skip$/i }).first();
    const canDismiss = await skipButton
      .count()
      .then((count) => count > 0)
      .catch(() => false);
    if (canDismiss && (await skipButton.isVisible().catch(() => false))) {
      this.monitor.log('Dismiss guided tour overlay');
      await skipButton.click().catch(() => undefined);
      await this.page.waitForTimeout(200);
    }
  }

  private async dismissMobileSidebarIfVisible() {
    if (this.page.isClosed()) return;
    const closeMenuButton = this.page.getByRole('button', { name: /close menu/i }).first();
    const closeVisible = await closeMenuButton
      .count()
      .then((count) => count > 0)
      .catch(() => false);
    if (closeVisible && (await closeMenuButton.isVisible().catch(() => false))) {
      this.monitor.log('Dismiss mobile sidebar menu');
      await closeMenuButton.click().catch(() => undefined);
    }
    const sidebarBackdrop = this.page.locator('[data-testid="sidebar-backdrop"]').first();
    if (await sidebarBackdrop.isVisible().catch(() => false)) {
      this.monitor.log('Dismiss mobile sidebar backdrop');
      await sidebarBackdrop.click().catch(() => undefined);
    }
  }

  private isRecoverableInteractionError(error: unknown) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    return (
      message.includes('not visible') ||
      message.includes('not attached') ||
      message.includes('element is detached') ||
      message.includes('timeout') ||
      message.includes('another element would receive the click') ||
      message.includes('intercepts pointer events')
    );
  }

  private async recoverInteractionState() {
    if (this.page.isClosed()) return;
    await this.dismissGuidedTourIfVisible();
    await this.dismissMobileSidebarIfVisible();
    await this.page.keyboard.press('Escape').catch(() => undefined);
    await this.page.waitForTimeout(150).catch(() => undefined);
  }

  protected async prepareForInteraction() {
    if (this.page.isClosed()) return;
    await this.dismissGuidedTourIfVisible();
    await this.dismissMobileSidebarIfVisible();
  }

  protected async click(locator: Locator, label: string) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        await this.prepareForInteraction();
        this.monitor.log(`Click ${label}${attempt > 1 ? ` (retry ${attempt - 1})` : ''}`);
        await this.monitor.highlight(locator);
        if (attempt === 1) {
          await locator.click({ timeout: 8000 });
        } else {
          await locator.click({ timeout: 8000, force: true });
        }
        return;
      } catch (error) {
        if (attempt === 2 || !this.isRecoverableInteractionError(error)) throw error;
        await this.recoverInteractionState();
      }
    }
  }

  protected async fill(locator: Locator, value: string, label: string) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        await this.prepareForInteraction();
        this.monitor.log(`Fill ${label} with "${value}"${attempt > 1 ? ` (retry ${attempt - 1})` : ''}`);
        await this.monitor.highlight(locator);
        await locator.fill(value);
        return;
      } catch (error) {
        if (attempt === 2 || !this.isRecoverableInteractionError(error)) throw error;
        await this.recoverInteractionState();
      }
    }
  }
}

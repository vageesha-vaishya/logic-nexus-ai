import { Locator, Page } from '@playwright/test';
import { RuntimeMonitor } from '../utils/runtimeMonitor';

export class BasePage {
  constructor(
    protected readonly page: Page,
    protected readonly monitor: RuntimeMonitor,
  ) {}

  private async dismissGuidedTourIfVisible() {
    const skipButton = this.page.getByRole('button', { name: /^skip$/i }).first();
    if ((await skipButton.count()) > 0 && (await skipButton.isVisible())) {
      this.monitor.log('Dismiss guided tour overlay');
      await skipButton.click();
      await this.page.waitForTimeout(200);
    }
  }

  protected async click(locator: Locator, label: string) {
    await this.dismissGuidedTourIfVisible();
    this.monitor.log(`Click ${label}`);
    await this.monitor.highlight(locator);
    await locator.click();
  }

  protected async fill(locator: Locator, value: string, label: string) {
    await this.dismissGuidedTourIfVisible();
    this.monitor.log(`Fill ${label} with "${value}"`);
    await this.monitor.highlight(locator);
    await locator.fill(value);
  }
}

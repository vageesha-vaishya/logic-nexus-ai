import { expect, Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { RuntimeMonitor } from '../utils/runtimeMonitor';

export class AuthPage extends BasePage {
  constructor(page: Page, monitor: RuntimeMonitor) {
    super(page, monitor);
  }

  async login(email: string, password: string) {
    await this.page.goto('/auth');
    const emailInput = this.page.getByTestId('email-input').or(this.page.locator('input[type="email"]'));
    const passwordInput = this.page.getByTestId('password-input').or(this.page.locator('input[type="password"]'));
    if ((await emailInput.first().count()) === 0) {
      await this.page.goto('/dashboard/quotes');
      await expect(this.page).toHaveURL(/\/dashboard\/quotes/, { timeout: 30000 });
      return;
    }

    await expect(emailInput.first()).toBeVisible({ timeout: 15000 });
    await this.fill(emailInput.first(), email, 'Email');
    await this.fill(passwordInput.first(), password, 'Password');
    const loginButton = this.page
      .getByTestId('login-btn')
      .or(this.page.getByRole('button', { name: /sign in|login/i }));
    await this.click(loginButton.first(), 'Sign in');
    await expect(this.page).toHaveURL(/\/dashboard/, { timeout: 45000 });
  }
}

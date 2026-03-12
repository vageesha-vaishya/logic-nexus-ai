import { Locator, Page, TestInfo } from '@playwright/test';

export interface RuntimeLogEntry {
  timestamp: string;
  message: string;
}

export class RuntimeMonitor {
  private readonly logs: RuntimeLogEntry[] = [];
  private readonly networkLogs: RuntimeLogEntry[] = [];

  constructor(private readonly page: Page, private readonly testInfo: TestInfo) {}

  log(message: string) {
    const entry = { timestamp: new Date().toISOString(), message };
    this.logs.push(entry);
    this.testInfo.annotations.push({ type: 'step', description: `${entry.timestamp} ${entry.message}` });
  }

  attachNetworkLogging() {
    this.page.on('request', (request) => {
      this.networkLogs.push({
        timestamp: new Date().toISOString(),
        message: `REQUEST ${request.method()} ${request.url()}`,
      });
    });
    this.page.on('response', (response) => {
      this.networkLogs.push({
        timestamp: new Date().toISOString(),
        message: `RESPONSE ${response.status()} ${response.url()}`,
      });
    });
  }

  async highlight(locator: Locator) {
    await locator.evaluate((element) => {
      const target = element as HTMLElement;
      target.style.outline = '3px solid #ef4444';
      target.style.outlineOffset = '2px';
      setTimeout(() => {
        target.style.outline = '';
        target.style.outlineOffset = '';
      }, 250);
    });
  }

  async attachArtifacts() {
    await this.testInfo.attach('runtime-step-log.json', {
      body: JSON.stringify(this.logs, null, 2),
      contentType: 'application/json',
    });
    await this.testInfo.attach('runtime-network-log.json', {
      body: JSON.stringify(this.networkLogs, null, 2),
      contentType: 'application/json',
    });
  }
}

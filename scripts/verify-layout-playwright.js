import { chromium, firefox, webkit } from 'playwright';
import fs from 'fs';

async function run() {
  const url = 'http://localhost:6007/iframe.html?path=/story/amro-templates-amroinventorydatagridtemplate--desktop-1366-validation&viewMode=story';
  const outDir = 'docs/module-layout-v2.3/reports/screenshots';
  fs.mkdirSync(outDir, { recursive: true });
  const targets = [
    ['chromium', chromium],
    ['firefox', firefox],
    ['webkit', webkit],
  ];
  const results = [];

  for (const [name, engine] of targets) {
    let browser;
    try {
      browser = await engine.launch({ headless: true });
      const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: `${outDir}/after-layout-${name}-1366x768.png`, fullPage: true });
      const result = await page.evaluate(() => {
        const doc = document.documentElement;
        const root = document.querySelector('[aria-label="AMRO inventory data grid"]');
        const detail = Array.from(document.querySelectorAll('h3')).find((el) => (el.textContent || '').includes('Record Detail'));
        return {
          hasGridRoot: Boolean(root),
          hasDetailHeader: Boolean(detail),
          horizontalOverflow: doc.scrollWidth > doc.clientWidth,
          width: doc.clientWidth,
          scrollWidth: doc.scrollWidth,
        };
      });
      results.push({ browser: name, status: 'ok', ...result });
    } catch (error) {
      results.push({ browser: name, status: 'failed', error: error instanceof Error ? error.message : String(error) });
    } finally {
      if (browser) await browser.close();
    }
  }

  fs.writeFileSync('docs/module-layout-v2.3/reports/layout-browser-check.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

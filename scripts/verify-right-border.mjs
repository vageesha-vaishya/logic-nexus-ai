import { chromium, firefox, webkit } from 'playwright';
import fs from 'fs';

const cases = [
  { name: 'desktop-1366-75', width: 1366, height: 768, zoom: 0.75 },
  { name: 'desktop-1366-100', width: 1366, height: 768, zoom: 1 },
  { name: 'desktop-1366-125', width: 1366, height: 768, zoom: 1.25 },
  { name: 'desktop-1366-150', width: 1366, height: 768, zoom: 1.5 },
  { name: 'tablet-1024-100', width: 1024, height: 768, zoom: 1 },
  { name: 'mobile-390-100', width: 390, height: 844, zoom: 1 },
];

const outDir = 'docs/module-layout-v2.3/reports/screenshots';
const url = 'http://localhost:6007/iframe.html?path=/story/amro-templates-amroinventorydatagridtemplate--desktop-1366-validation&viewMode=story';
const engines = [
  ['chromium', async () => chromium.launch({ headless: true })],
  ['firefox', async () => firefox.launch({ headless: true })],
  ['webkit', async () => webkit.launch({ headless: true })],
  ['edge', async () => chromium.launch({ channel: 'msedge', headless: true })],
];
const results = [];

fs.mkdirSync(outDir, { recursive: true });

for (const [engineName, launch] of engines) {
  let browser;
  try {
    browser = await launch();
    for (const c of cases) {
      const page = await browser.newPage({ viewport: { width: c.width, height: c.height } });
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.evaluate((z) => {
        document.body.style.zoom = String(z);
      }, c.zoom);

      const data = await page.evaluate(() => {
        const rail = document.querySelector('[data-testid="record-detail-right-border"]');
        const style = rail ? window.getComputedStyle(rail) : null;
        return {
          hasRail: Boolean(rail),
          railWidth: style ? style.width : null,
          railDisplay: style ? style.display : null,
          railBackground: style ? style.backgroundColor : null,
        };
      });

      const shot = `${outDir}/right-border-${engineName}-${c.name}.png`;
      await page.screenshot({ path: shot, fullPage: true });
      results.push({ browser: engineName, case: c.name, ...data, screenshot: shot });
      await page.close();
    }
  } catch (error) {
    results.push({
      browser: engineName,
      case: 'all',
      hasRail: false,
      railWidth: null,
      railDisplay: null,
      railBackground: null,
      screenshot: null,
      status: 'browser-unavailable',
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    if (browser) await browser.close();
  }
}

fs.writeFileSync('docs/module-layout-v2.3/reports/right-border-validation.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));

import { chromium, devices } from 'playwright';
const sites = ['https://logicnexus.sosservices.online/','https://aviation.sosservices.online/','https://sthira.sosservices.online/'];
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
for (const url of sites) {
  await page.goto(url, { waitUntil: 'networkidle' });
  const r = await page.evaluate(() => ({ vw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth }));
  console.log(`  ${url}  vw=${r.vw}  scrollWidth=${r.sw}  overflow=${r.sw > r.vw + 1}`);
}
await browser.close();

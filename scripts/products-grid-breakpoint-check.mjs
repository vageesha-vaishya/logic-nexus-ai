import { chromium, devices } from 'playwright';
const browser = await chromium.launch();
const widths = [
  { w: 1440, label: 'xl  1440px' },
  { w: 1280, label: 'xl  1280px' },
  { w: 1100, label: 'lg  1100px' },
  { w: 1024, label: 'lg  1024px' },
  { w: 768,  label: 'md   768px' },
  { w: 390,  label: 'sm   390px' },
];
for (const { w, label } of widths) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('https://sosservices.online/#products', { waitUntil: 'networkidle' });
  const articles = await page.locator('section#products article').all();
  const rows = new Map();
  for (const a of articles) {
    const b = await a.boundingBox();
    if (!b) continue;
    const y = Math.round(b.y / 10) * 10;
    rows.set(y, (rows.get(y) || 0) + 1);
  }
  const counts = Array.from(rows.values());
  console.log(`  ${label} → rows: ${JSON.stringify(counts)}`);
  await ctx.close();
}
await browser.close();

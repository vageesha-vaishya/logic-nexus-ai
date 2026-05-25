import { chromium, devices } from 'playwright';
const browser = await chromium.launch();

// Desktop check on /products/sthira/ — sibling rail should be 4-up at lg+
const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const dp = await desktop.newPage();
await dp.goto('https://sosservices.online/products/sthira/', { waitUntil: 'networkidle' });
const heading = dp.locator('text=Sibling products');
await heading.scrollIntoViewIfNeeded();
const rail = dp.locator('section').filter({ hasText: 'Sibling products' }).first();
await rail.screenshot({ path: '/tmp/5p-desktop-rail.png' });
const cards = await rail.locator('a').all();
const rows = new Map();
for (const c of cards) {
  const b = await c.boundingBox();
  if (!b) continue;
  const yKey = Math.round(b.y / 10) * 10;
  rows.set(yKey, (rows.get(yKey) || 0) + 1);
}
console.log('  desktop 1280px rail rows:', JSON.stringify(Array.from(rows.values())));

// Homepage products grid at desktop
await dp.goto('https://sosservices.online/', { waitUntil: 'networkidle' });
const pgrid = dp.locator('section#products');
await pgrid.scrollIntoViewIfNeeded();
await pgrid.screenshot({ path: '/tmp/5p-desktop-grid.png' });
const articles = await pgrid.locator('article').all();
const gridRows = new Map();
for (const c of articles) {
  const b = await c.boundingBox();
  if (!b) continue;
  const yKey = Math.round(b.y / 10) * 10;
  gridRows.set(yKey, (gridRows.get(yKey) || 0) + 1);
}
console.log('  desktop 1280px grid rows:', JSON.stringify(Array.from(gridRows.values())));

// Mobile re-check
const mobile = await browser.newContext({ ...devices['iPhone 13'] });
const mp = await mobile.newPage();
await mp.goto('https://sosservices.online/products/sthira/', { waitUntil: 'networkidle' });
const overflow = await mp.evaluate(() => ({ vw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth }));
console.log(`  mobile 390px overflow=${overflow.sw > overflow.vw + 1}  (vw=${overflow.vw}, sw=${overflow.sw})`);

await browser.close();

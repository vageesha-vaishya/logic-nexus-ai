import { chromium, devices } from 'playwright';
import { writeFile } from 'node:fs/promises';

const targets = [
  { name: 'parent-sthira-detail', url: 'https://sosservices.online/products/sthira/', anchor: 'Sibling products' },
  { name: 'logicnexus-home',      url: 'https://logicnexus.sosservices.online/',     anchor: 'How we build Logic Nexus' },
  { name: 'aviation-home',        url: 'https://aviation.sosservices.online/',       anchor: 'How we build Aviation AI Pro' },
  { name: 'sthira-home',          url: 'https://sthira.sosservices.online/',         anchor: 'How we build Sthira' },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  ...devices['iPhone 13'], // 390x844 viewport
});
const page = await ctx.newPage();

const report = [];

for (const t of targets) {
  await page.goto(t.url, { waitUntil: 'networkidle' });
  // scroll the rail's section header into view
  const heading = page.locator(`text=${t.anchor}`).first();
  await heading.scrollIntoViewIfNeeded();

  // Find the section element that wraps the rail
  const rail = page.locator('section').filter({ hasText: t.anchor }).first();

  // Capture only the rail
  const path = `/tmp/rail-mobile-${t.name}.png`;
  await rail.screenshot({ path });

  // Measure card geometry
  const cardCount = await rail.locator('a').count();
  const cardBoxes = [];
  for (let i = 0; i < cardCount; i++) {
    const a = rail.locator('a').nth(i);
    const visible = await a.isVisible();
    if (!visible) continue;
    const box = await a.boundingBox();
    cardBoxes.push({ i, box });
  }

  // Check for horizontal overflow on the whole page
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    return {
      scrollWidth: Math.max(doc.scrollWidth, body.scrollWidth),
      clientWidth: doc.clientWidth,
      hasHOverflow: Math.max(doc.scrollWidth, body.scrollWidth) > doc.clientWidth + 1,
    };
  });

  report.push({
    target: t.name,
    url: t.url,
    cardCount,
    cardBoxes,
    overflow,
    screenshot: path,
  });

  console.log(`✓ ${t.name}: ${cardCount} cards captured at ${path}`);
}

await writeFile('/tmp/rail-mobile-report.json', JSON.stringify(report, null, 2));
console.log('\nreport: /tmp/rail-mobile-report.json');
await browser.close();

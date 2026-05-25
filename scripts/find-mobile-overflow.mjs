import { chromium, devices } from 'playwright';

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();

await page.goto('https://sosservices.online/products/sthira/', { waitUntil: 'networkidle' });

const overflowers = await page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const result = [];
  const all = document.querySelectorAll('body *');
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (r.right > vw + 1 || r.left < -1) {
      // skip if any ancestor we already reported is the same overflower
      result.push({
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        cls: (el.getAttribute('class') || '').slice(0, 80),
        left: Math.round(r.left),
        right: Math.round(r.right),
        width: Math.round(r.width),
        text: (el.textContent || '').trim().slice(0, 70).replace(/\s+/g, ' '),
      });
    }
  }
  return { vw, overflowers: result.slice(0, 30) };
});

console.log(`viewport width: ${overflowers.vw}`);
console.log(`\noverflowing elements (right > vw + 1):\n`);
for (const e of overflowers.overflowers) {
  console.log(`  <${e.tag}> w=${e.width} left=${e.left} right=${e.right}  class="${e.cls}"`);
  if (e.text) console.log(`    text: "${e.text}"`);
}

await browser.close();

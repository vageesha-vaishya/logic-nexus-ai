import { chromium, devices } from 'playwright';

const sites = [
  'https://sosservices.online/',
  'https://logicnexus.sosservices.online/',
  'https://aviation.sosservices.online/',
  'https://sthira.sosservices.online/',
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();

for (const url of sites) {
  await page.goto(url, { waitUntil: 'networkidle' });
  const r = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const sw = document.documentElement.scrollWidth;
    const nav = document.querySelector('header nav');
    const navBox = nav ? nav.getBoundingClientRect() : null;
    const items = nav ? Array.from(nav.children).map((c) => (c.textContent || '').trim()) : [];
    return { vw, sw, hOverflow: sw > vw + 1, navWidth: navBox ? Math.round(navBox.width) : null, navRight: navBox ? Math.round(navBox.right) : null, items };
  });
  console.log(`${url}`);
  console.log(`  vw=${r.vw}  scrollWidth=${r.sw}  h-overflow=${r.hOverflow}`);
  console.log(`  nav width=${r.navWidth}px  right=${r.navRight}  items=${JSON.stringify(r.items)}`);
  console.log();
}

await browser.close();

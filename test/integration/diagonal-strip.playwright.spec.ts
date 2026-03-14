import { test, expect } from '@playwright/test';

test.describe('diagonal strip visual parity', () => {
  test('renders consistent diagonal geometry and no focus artifacts', async ({ page, browserName }) => {
    await page.goto('/');
    await page.setContent(`
      <style>
        body { margin: 0; font-family: Inter, Arial, sans-serif; background: #f4f5f7; }
        header { position: relative; height: 140px; background: linear-gradient(120deg, #111827, #374151); color: white; padding: 24px; overflow: hidden; }
      </style>
      <header id="hdr"><h1>Pipeline</h1></header>
    `);

    await page.addScriptTag({
      type: 'module',
      content: `
        import { appendStrip } from '/src/diagonal-strip.esm.js';
        const header = document.getElementById('hdr');
        const strip = appendStrip(header, {
          color: '#7c3aed',
          opacity: 0.9,
          stripWidth: '46px',
          angle: '18deg',
          strategy: 'css',
          breakpoints: {
            mobile: { angle: '-8deg', stripWidth: '36px' },
            tablet: { angle: '12deg', stripWidth: '42px' },
            desktop: { angle: '18deg', stripWidth: '46px' }
          }
        });
        window.__strip = strip;
      `,
    });

    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.locator('#hdr')).toHaveScreenshot(`diagonal-strip-${browserName}.png`, {
      maxDiffPixelRatio: 0.01,
    });

    await page.keyboard.press('Tab');
    const hostFocused = await page.evaluate(() => {
      const host = document.querySelector('.diagonal-strip-host');
      return document.activeElement === host;
    });
    expect(hostFocused).toBe(false);

    const forcedColorsStatus = await page.evaluate(() => {
      return window.matchMedia('(forced-colors: active)').matches;
    });
    expect(typeof forcedColorsStatus).toBe('boolean');
  });
});

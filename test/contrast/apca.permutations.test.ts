import { ensureCompliantColor, parseCssColor, apcaContrast } from '../../src/contrast/apca.js';

const channels = [0, 51, 102, 153, 204, 255];

const swatches = channels.flatMap((r) =>
  channels.flatMap((g) =>
    channels.map((b) => `rgb(${r}, ${g}, ${b})`)
  )
);

describe('APCA validation matrix', () => {
  it('keeps every permutation at or above 15 Lc after correction', () => {
    const subset = swatches.slice(0, 162);
    for (const backgroundColor of subset) {
      const result = ensureCompliantColor({
        preferredColor: '#6b21a8',
        backgroundColor,
        minRatio: 4.5,
        minLc: 15,
        largeText: false,
        ownerDocument: document,
      });
      const fg = parseCssColor(result.output, document);
      const bg = parseCssColor(backgroundColor, document);
      expect(fg).toBeTruthy();
      expect(bg).toBeTruthy();
      const lc = Math.abs(apcaContrast(fg!, bg!));
      expect(lc).toBeGreaterThanOrEqual(15);
    }
  });
});

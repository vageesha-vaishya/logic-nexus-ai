import { axe, toHaveNoViolations } from 'jest-axe';
import { appendStrip } from '../../src/diagonal-strip.esm.js';

expect.extend(toHaveNoViolations);

describe('DiagonalStrip accessibility', () => {
  it('keeps decorative host hidden from accessibility tree', async () => {
    const header = document.createElement('header');
    header.innerHTML = '<h1>Revenue</h1>';
    header.style.backgroundColor = '#ffffff';
    document.body.appendChild(header);

    const strip = appendStrip(header, { color: '#1f2937', stripWidth: '32px', angle: '12deg' });
    const host = header.querySelector('.diagonal-strip-host');

    expect(host).toHaveAttribute('aria-hidden', 'true');
    expect(host).toHaveAttribute('role', 'presentation');
    expect(host).toHaveAttribute('tabindex', '-1');

    const results = await axe(header);
    expect(results).toHaveNoViolations();
    strip.destroy();
  });
});

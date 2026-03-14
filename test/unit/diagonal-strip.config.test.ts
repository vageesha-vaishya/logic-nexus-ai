import { DiagonalStrip, appendStrip } from '../../src/diagonal-strip.esm.js';

describe('DiagonalStrip config and lifecycle', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('applies and retrieves properties with immediate updates', () => {
    const header = document.createElement('header');
    header.style.height = '80px';
    header.style.backgroundColor = '#ffffff';
    document.body.appendChild(header);

    const strip = appendStrip(header, {
      color: '#111111',
      opacity: 0.7,
      stripWidth: '40px',
      angle: '12deg',
      themeAware: false,
      strategy: 'css',
    });

    strip.setProperty('angle', '21deg');
    strip.setProperty('opacity', 0.55);

    expect(strip.getProperty('angle')).toBe('21deg');
    expect(strip.getProperty('opacity')).toBe(0.55);
    expect(header.querySelector('.diagonal-strip-host')).toBeTruthy();

    strip.destroy();
    expect(header.querySelector('.diagonal-strip-host')).toBeNull();
  });

  it('emits strip:change event with contrast metadata', () => {
    const header = document.createElement('header');
    header.style.height = '96px';
    header.style.backgroundColor = '#fafafa';
    document.body.appendChild(header);

    const strip = new DiagonalStrip(header, { color: '#555555', stripWidth: '48px', angle: '10deg' });
    const listener = jest.fn();
    strip.addEventListener('strip:change', listener as any);
    strip.setProperty('color', '#777777');

    expect(listener).toHaveBeenCalled();
    const event = listener.mock.calls.at(-1)[0];
    expect(event.detail.computedContrast).toBeDefined();
    expect(typeof event.detail.computedContrast.ratio).toBe('number');
    expect(typeof event.detail.computedContrast.lc).toBe('number');

    strip.destroy();
  });

  it('switches strategy at runtime and keeps host metrics stable', () => {
    const header = document.createElement('header');
    header.style.height = '120px';
    header.style.width = '900px';
    header.style.backgroundColor = 'rgb(230, 230, 230)';
    header.style.position = 'relative';
    header.getBoundingClientRect = () =>
      ({
        width: 900,
        height: 120,
        top: 0,
        left: 0,
        right: 900,
        bottom: 120,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as any);
    document.body.appendChild(header);

    const strip = appendStrip(header, {
      strategy: 'css',
      stripWidth: '42px',
      angle: '15deg',
      breakpoints: {
        mobile: { angle: '-10deg', stripWidth: '24px' },
        tablet: { angle: '12deg', stripWidth: '36px' },
        desktop: { angle: '18deg', stripWidth: '52px' },
      },
    });
    const host = header.querySelector('.diagonal-strip-host') as HTMLElement;
    expect(host.dataset.strategy).toBe('css');

    strip.setProperty('strategy', 'svg');
    expect(host.dataset.strategy).toBe('svg');
    expect(host.querySelector('svg')).toBeTruthy();

    strip.setProperty('strategy', 'css');
    expect(host.dataset.strategy).toBe('css');
    strip.destroy();
  });

  it('reacts to forced-colors changes by disabling opacity blending', () => {
    let listeners: Array<() => void> = [];
    const mediaQuery = {
      matches: false,
      media: '(forced-colors: active)',
      addEventListener: (_: string, cb: () => void) => listeners.push(cb),
      removeEventListener: (_: string, cb: () => void) => {
        listeners = listeners.filter((x) => x !== cb);
      },
      addListener: (cb: () => void) => listeners.push(cb),
      removeListener: (cb: () => void) => {
        listeners = listeners.filter((x) => x !== cb);
      },
      onchange: null,
      dispatchEvent: () => true,
    } as any;
    window.matchMedia = jest.fn().mockReturnValue(mediaQuery);

    const header = document.createElement('header');
    header.style.backgroundColor = '#000';
    document.body.appendChild(header);
    const strip = appendStrip(header, { opacity: 0.3, strategy: 'css' });

    expect(header.style.getPropertyValue('--dx-strip-opacity')).toBe('0.3');
    mediaQuery.matches = true;
    listeners.forEach((fn) => fn());
    expect(header.style.getPropertyValue('--dx-strip-opacity')).toBe('1');

    strip.destroy();
  });
});

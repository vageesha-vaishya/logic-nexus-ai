import {
  APCA_CONSTANTS,
  apcaContrast,
  blendColors,
  ensureCompliantColor,
  parseCssColor,
  rgbToHex,
  wcagContrastRatio,
} from '../../src/contrast/apca.js';

describe('apca utilities', () => {
  it('parses named, hex, rgb, rgba, hsl, and hsla colors', () => {
    expect(parseCssColor('black', document)).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    expect(parseCssColor('transparent', document)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    expect(parseCssColor('#abc', document)).toEqual({ r: 170, g: 187, b: 204, a: 1 });
    expect(parseCssColor('#112233', document)).toEqual({ r: 17, g: 34, b: 51, a: 1 });
    expect(parseCssColor('#112233ff', document)).toEqual({ r: 17, g: 34, b: 51, a: 1 });
    expect(parseCssColor('rgb(100, 120, 140)', document)).toEqual({ r: 100, g: 120, b: 140, a: 1 });
    expect(parseCssColor('rgba(100, 120, 140, 0.4)', document)).toEqual({ r: 100, g: 120, b: 140, a: 0.4 });
    expect(parseCssColor('rgb(50%, 25%, 10%)', document)).toEqual({ r: 128, g: 64, b: 26, a: 1 });
    expect(parseCssColor('hsl(0, 100%, 50%)', document)).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(parseCssColor('hsla(120, 100%, 50%, 0.75)', document)).toEqual({ r: 0, g: 255, b: 0, a: 0.75 });
    expect(parseCssColor('hsl(90, 100%, 50%)', document)).toEqual({ r: 128, g: 255, b: 0, a: 1 });
    expect(parseCssColor('hsl(210, 100%, 50%)', document)).toEqual({ r: 0, g: 128, b: 255, a: 1 });
    expect(parseCssColor('hsl(270, 100%, 50%)', document)).toEqual({ r: 128, g: 0, b: 255, a: 1 });
    expect(parseCssColor('hsl(330, 100%, 50%)', document)).toEqual({ r: 255, g: 0, b: 128, a: 1 });
  });

  it('handles invalid parse inputs and computed-style fallback', () => {
    expect(parseCssColor('', document)).toBeNull();
    expect(parseCssColor(undefined as any, document)).toBeNull();
    expect(parseCssColor('#12', document)).toBeNull();

    const fallbackParsed = parseCssColor('rebeccapurple', document);
    expect(fallbackParsed).toBeTruthy();
    expect(fallbackParsed?.a).toBe(1);
    expect(parseCssColor('not-a-real-color-value', null as any)).toBeNull();
    expect(parseCssColor('rgb(1,2)', document)).toBeNull();
    expect(parseCssColor('hsl(1,2)', document)).toBeNull();

    const fakeProbe = {
      style: {} as any,
      remove: jest.fn(),
    };
    const ownerDocument = {
      createElement: jest.fn(() => fakeProbe),
      body: { appendChild: jest.fn() },
      defaultView: {
        getComputedStyle: jest.fn(() => ({ color: 'rgb(1, 2, 3)' })),
      },
    } as any;
    const computedParsed = parseCssColor('brand-token-color', ownerDocument);
    expect(computedParsed).toEqual({ r: 1, g: 2, b: 3, a: 1 });
    expect(ownerDocument.createElement).toHaveBeenCalled();
    expect(ownerDocument.body.appendChild).toHaveBeenCalledWith(fakeProbe);
    expect(fakeProbe.remove).toHaveBeenCalled();

    const ownerDocumentNoParse = {
      createElement: jest.fn(() => fakeProbe),
      body: { appendChild: jest.fn() },
      defaultView: {
        getComputedStyle: jest.fn(() => ({ color: 'not-a-color' })),
      },
    } as any;
    expect(parseCssColor('brand-token-color', ownerDocumentNoParse)).toBeNull();
    expect(parseCssColor({} as any, document)).toBeNull();
  });

  it('blends colors, computes ratios, and hex conversion', () => {
    const blended = blendColors(
      { r: 255, g: 0, b: 0, a: 0.5 },
      { r: 0, g: 0, b: 255, a: 1 }
    );
    expect(blended).toEqual({ r: 128, g: 0, b: 128, a: 1 });
    expect(rgbToHex({ r: 128, g: 0, b: 128 })).toBe('#800080');

    const ratio = wcagContrastRatio(
      { r: 0, g: 0, b: 0, a: 1 },
      { r: 255, g: 255, b: 255, a: 1 }
    );
    expect(ratio).toBeGreaterThan(20);

    const blendNoAlpha = blendColors(
      { r: 10, g: 20, b: 30 } as any,
      { r: 200, g: 210, b: 220, a: 1 }
    );
    expect(blendNoAlpha).toEqual({ r: 10, g: 20, b: 30, a: 1 });
  });

  it('computes APCA polarity for dark-on-light and light-on-dark', () => {
    const darkOnLight = apcaContrast(
      { r: 0, g: 0, b: 0, a: 1 },
      { r: 255, g: 255, b: 255, a: 1 }
    );
    const lightOnDark = apcaContrast(
      { r: 255, g: 255, b: 255, a: 1 },
      { r: 0, g: 0, b: 0, a: 1 }
    );
    expect(Math.abs(darkOnLight)).toBeGreaterThan(15);
    expect(Math.abs(lightOnDark)).toBeGreaterThan(15);
  });

  it('returns non-corrected when already compliant', () => {
    const result = ensureCompliantColor({
      preferredColor: '#000000',
      backgroundColor: '#ffffff',
      minRatio: 4.5,
      minLc: 15,
      ownerDocument: document,
    });
    expect(result.corrected).toBe(false);
    expect(result.output).toBe('#000000');
    expect(result.ratio).toBeGreaterThanOrEqual(4.5);
    expect(result.lc).toBeGreaterThanOrEqual(15);
  });

  it('corrects when non-compliant and supports large text threshold', () => {
    const result = ensureCompliantColor({
      preferredColor: '#808080',
      backgroundColor: '#8a8a8a',
      minRatio: 3,
      minLc: 15,
      largeText: true,
      ownerDocument: document,
    });
    expect(result.corrected).toBe(true);
    expect(parseCssColor(result.output, document)).toBeTruthy();
    expect(result.ratio).toBeGreaterThanOrEqual(3);
    expect(result.lc).toBeGreaterThanOrEqual(15);
  });

  it('returns fallback for invalid parse and impossible thresholds', () => {
    const invalid = ensureCompliantColor({
      preferredColor: '???',
      backgroundColor: '???',
      ownerDocument: document,
    });
    expect(invalid.corrected).toBe(false);
    expect(invalid.ratio).toBe(0);
    expect(invalid.lc).toBe(0);

    const impossible = ensureCompliantColor({
      preferredColor: '#777777',
      backgroundColor: '#777777',
      minRatio: 999,
      minLc: 999,
      ownerDocument: document,
    });
    expect(impossible.corrected).toBe(true);
    expect(['#000000', '#ffffff']).toContain(impossible.output);

    const impossibleDark = ensureCompliantColor({
      preferredColor: '#111111',
      backgroundColor: '#000000',
      minRatio: 999,
      minLc: 999,
    });
    expect(impossibleDark.corrected).toBe(true);
    expect(impossibleDark.output).toBe('#ffffff');
  });

  it('exposes APCA constants', () => {
    expect(APCA_CONSTANTS.APCA_MIN_LC).toBe(15);
  });
});

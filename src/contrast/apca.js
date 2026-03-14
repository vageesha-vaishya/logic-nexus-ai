const APCA_MIN_LC = 15;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const linearize = (value) => {
  const s = value / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const luminance = ({ r, g, b }) => {
  const R = linearize(r);
  const G = linearize(g);
  const B = linearize(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
};

const srgb = (value) => clamp(Math.round(value), 0, 255);

const normalizeHex = (input) => {
  const hex = input.replace('#', '').trim();
  if (hex.length === 3) {
    return hex
      .split('')
      .map((x) => `${x}${x}`)
      .join('');
  }
  if (hex.length === 6 || hex.length === 8) {
    return hex.slice(0, 6);
  }
  return null;
};

const hslToRgb = (h, s, l) => {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp(s / 100, 0, 1);
  const lig = clamp(l / 100, 0, 1);
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lig - c / 2;
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hue < 60) {
    r1 = c;
    g1 = x;
  } else if (hue < 120) {
    r1 = x;
    g1 = c;
  } else if (hue < 180) {
    g1 = c;
    b1 = x;
  } else if (hue < 240) {
    g1 = x;
    b1 = c;
  } else if (hue < 300) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }
  return {
    r: srgb((r1 + m) * 255),
    g: srgb((g1 + m) * 255),
    b: srgb((b1 + m) * 255),
    a: 1,
  };
};

const parseRgbFunction = (value) => {
  const match = value.match(/rgba?\((.+)\)/i);
  if (!match) return null;
  const raw = match[1].replace(/\//g, ',');
  const parts = raw.split(',').map((x) => x.trim()).filter(Boolean);
  if (parts.length < 3) return null;
  const [rRaw, gRaw, bRaw, aRaw] = parts;
  const asChannel = (x) => {
    if (x.endsWith('%')) return srgb((parseFloat(x) / 100) * 255);
    return srgb(parseFloat(x));
  };
  return {
    r: asChannel(rRaw),
    g: asChannel(gRaw),
    b: asChannel(bRaw),
    a: aRaw === undefined ? 1 : clamp(parseFloat(aRaw), 0, 1),
  };
};

const parseHslFunction = (value) => {
  const match = value.match(/hsla?\((.+)\)/i);
  if (!match) return null;
  const raw = match[1].replace(/\//g, ',');
  const parts = raw.split(',').map((x) => x.trim()).filter(Boolean);
  if (parts.length < 3) return null;
  const [hRaw, sRaw, lRaw, aRaw] = parts;
  const parsed = hslToRgb(parseFloat(hRaw), parseFloat(sRaw), parseFloat(lRaw));
  parsed.a = aRaw === undefined ? 1 : clamp(parseFloat(aRaw), 0, 1);
  return parsed;
};

export const parseCssColor = (value, ownerDocument = typeof document !== 'undefined' ? document : null) => {
  if (!value || typeof value !== 'string') return null;
  const input = value.trim().toLowerCase();
  const named = {
    black: { r: 0, g: 0, b: 0, a: 1 },
    white: { r: 255, g: 255, b: 255, a: 1 },
    transparent: { r: 0, g: 0, b: 0, a: 0 },
  };
  if (named[input]) return named[input];
  if (input.startsWith('#')) {
    const hex = normalizeHex(input);
    if (!hex) return null;
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: 1,
    };
  }
  const rgb = parseRgbFunction(input);
  if (rgb) return rgb;
  const hsl = parseHslFunction(input);
  if (hsl) return hsl;

  if (ownerDocument?.defaultView?.getComputedStyle) {
    const probe = ownerDocument.createElement('span');
    probe.style.color = input;
    probe.style.position = 'absolute';
    probe.style.left = '-9999px';
    ownerDocument.body?.appendChild(probe);
    const computed = ownerDocument.defaultView.getComputedStyle(probe).color;
    probe.remove();
    const parsed = parseRgbFunction(computed || '');
    if (parsed) return parsed;
  }
  return null;
};

export const blendColors = (foreground, background) => {
  const alpha = foreground.a ?? 1;
  return {
    r: srgb(alpha * foreground.r + (1 - alpha) * background.r),
    g: srgb(alpha * foreground.g + (1 - alpha) * background.g),
    b: srgb(alpha * foreground.b + (1 - alpha) * background.b),
    a: 1,
  };
};

export const rgbToHex = ({ r, g, b }) =>
  `#${[r, g, b]
    .map((x) => srgb(x).toString(16).padStart(2, '0'))
    .join('')}`;

export const wcagContrastRatio = (foreground, background) => {
  const fg = luminance(foreground);
  const bg = luminance(background);
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
};

export const apcaContrast = (foreground, background) => {
  const yText = luminance(foreground);
  const yBg = luminance(background);
  const normBg = Math.max(yBg, 0.0005);
  const normText = Math.max(yText, 0.0005);
  const darkText = normText < normBg;
  const SAPC = darkText
    ? (normBg ** 0.56 - normText ** 0.57) * 1.14
    : (normBg ** 0.65 - normText ** 0.62) * 1.14;
  return SAPC * 100;
};

export const ensureCompliantColor = ({
  preferredColor,
  backgroundColor,
  minRatio = 4.5,
  minLc = APCA_MIN_LC,
  largeText = false,
  ownerDocument = typeof document !== 'undefined' ? document : null,
}) => {
  const parsedBg = parseCssColor(backgroundColor, ownerDocument);
  const parsedFg = parseCssColor(preferredColor, ownerDocument);
  if (!parsedBg || !parsedFg) {
    return {
      input: preferredColor,
      output: preferredColor,
      ratio: 0,
      lc: 0,
      corrected: false,
    };
  }

  const ratioTarget = largeText ? Math.max(3, minRatio) : Math.max(4.5, minRatio);
  const initialRatio = wcagContrastRatio(parsedFg, parsedBg);
  const initialLc = Math.abs(apcaContrast(parsedFg, parsedBg));
  if (initialRatio >= ratioTarget && initialLc >= minLc) {
    return {
      input: preferredColor,
      output: rgbToHex(parsedFg),
      ratio: initialRatio,
      lc: initialLc,
      corrected: false,
    };
  }

  const candidates = [
    { r: 0, g: 0, b: 0, a: 1 },
    { r: 255, g: 255, b: 255, a: 1 },
  ];

  let winner = null;
  for (const edge of candidates) {
    let left = 0;
    let right = 1;
    let local = null;
    for (let i = 0; i < 18; i += 1) {
      const mix = (left + right) / 2;
      const blend = {
        r: srgb(parsedFg.r + (edge.r - parsedFg.r) * mix),
        g: srgb(parsedFg.g + (edge.g - parsedFg.g) * mix),
        b: srgb(parsedFg.b + (edge.b - parsedFg.b) * mix),
        a: 1,
      };
      const ratio = wcagContrastRatio(blend, parsedBg);
      const lc = Math.abs(apcaContrast(blend, parsedBg));
      if (ratio >= ratioTarget && lc >= minLc) {
        local = { blend, ratio, lc, mix };
        right = mix;
      } else {
        left = mix;
      }
    }
    if (local && (!winner || local.mix < winner.mix)) {
      winner = local;
    }
  }

  if (!winner) {
    const blackRatio = wcagContrastRatio(candidates[0], parsedBg);
    const whiteRatio = wcagContrastRatio(candidates[1], parsedBg);
    const fallback = blackRatio >= whiteRatio ? candidates[0] : candidates[1];
    return {
      input: preferredColor,
      output: rgbToHex(fallback),
      ratio: Math.max(blackRatio, whiteRatio),
      lc: Math.max(Math.abs(apcaContrast(candidates[0], parsedBg)), Math.abs(apcaContrast(candidates[1], parsedBg))),
      corrected: true,
    };
  }

  return {
    input: preferredColor,
    output: rgbToHex(winner.blend),
    ratio: winner.ratio,
    lc: winner.lc,
    corrected: true,
  };
};

export const APCA_CONSTANTS = {
  APCA_MIN_LC,
};

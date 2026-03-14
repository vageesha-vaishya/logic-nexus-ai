import { CssStrategy } from './strategies/css-strategy.js';
import { SvgStrategy } from './strategies/svg-strategy.js';
import { ensureCompliantColor, parseCssColor, APCA_CONSTANTS } from './contrast/apca.js';

const BREAKPOINTS = { mobile: 768, tablet: 1024 };
const FIXED_UI_Z_INDEX = 1000;
const BASE_MIN_Z_INDEX = 10;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const asNumber = (value, fallback) => {
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : fallback;
};

const uid = () => `dx-${Math.random().toString(36).slice(2, 10)}`;

const withDeg = (value) => {
  const raw = String(value).trim().replace(/deg$/i, '');
  return clamp(asNumber(raw, 0), -45, 45);
};

const ensurePositioning = (container) => {
  const computed = container.ownerDocument.defaultView.getComputedStyle(container);
  if (computed.position === 'static') {
    container.style.position = 'relative';
  }
};

const createHost = (container, scopeId) => {
  const host = container.ownerDocument.createElement('div');
  host.className = 'diagonal-strip-host';
  host.setAttribute('aria-hidden', 'true');
  host.setAttribute('role', 'presentation');
  host.tabIndex = -1;
  host.dataset.diagonalStripHost = scopeId;
  host.style.pointerEvents = 'none';
  container.appendChild(host);
  return host;
};

const getBackgroundColor = (container) => {
  const win = container.ownerDocument.defaultView;
  const direct = win.getComputedStyle(container).backgroundColor;
  const parsed = parseCssColor(direct, container.ownerDocument);
  if (parsed) return direct;
  let node = container.parentElement;
  while (node) {
    const color = win.getComputedStyle(node).backgroundColor;
    if (parseCssColor(color, container.ownerDocument)) return color;
    node = node.parentElement;
  }
  return '#ffffff';
};

const nearestBreakpointProps = (config, viewport) => {
  const mobile = config.breakpoints?.mobile || {};
  const tablet = config.breakpoints?.tablet || {};
  const desktop = config.breakpoints?.desktop || {};
  if (viewport <= BREAKPOINTS.mobile) return { ...config, ...mobile };
  if (viewport >= BREAKPOINTS.tablet + 1) return { ...config, ...desktop };
  return { ...config, ...tablet };
};

const interpolateScalar = (leftX, leftY, rightX, rightY, x) => {
  if (rightX <= leftX) return leftY;
  const t = clamp((x - leftX) / (rightX - leftX), 0, 1);
  return leftY + (rightY - leftY) * t;
};

const parseDimension = (value) => {
  const raw = String(value ?? '').trim();
  const m = raw.match(/^(-?\d+(\.\d+)?)(px|%|vw)$/i);
  if (!m) return null;
  return { amount: parseFloat(m[1]), unit: m[3].toLowerCase() };
};

const interpolateDimension = (mobileValue, tabletValue, desktopValue, viewportWidth) => {
  const m = parseDimension(mobileValue);
  const t = parseDimension(tabletValue);
  const d = parseDimension(desktopValue);
  if (!m || !t || !d) return String(tabletValue ?? desktopValue ?? mobileValue ?? '56px');
  if (m.unit !== t.unit || t.unit !== d.unit) return String(tabletValue ?? desktopValue ?? mobileValue ?? '56px');
  if (viewportWidth <= BREAKPOINTS.mobile) return `${m.amount}${m.unit}`;
  if (viewportWidth <= BREAKPOINTS.tablet) {
    return `${interpolateScalar(BREAKPOINTS.mobile, m.amount, BREAKPOINTS.tablet, t.amount, viewportWidth)}${m.unit}`;
  }
  const rightMax = Math.max(viewportWidth, BREAKPOINTS.tablet + 1);
  return `${interpolateScalar(BREAKPOINTS.tablet + 1, t.amount, rightMax, d.amount, viewportWidth)}${m.unit}`;
};

const computeAutoZIndex = (container) => {
  const win = container.ownerDocument.defaultView;
  let maxChild = BASE_MIN_Z_INDEX;
  const children = Array.from(container.children);
  for (const child of children) {
    const zRaw = win.getComputedStyle(child).zIndex;
    const z = parseInt(zRaw, 10);
    if (Number.isFinite(z)) {
      maxChild = Math.max(maxChild, z);
    }
  }
  return clamp(maxChild + 1, BASE_MIN_Z_INDEX, FIXED_UI_Z_INDEX - 1);
};

const computeCompensation = (rect, angleDeg) => {
  const radians = (Math.PI / 180) * angleDeg;
  const deltaY = Math.abs(Math.tan(radians) * rect.width);
  const compX = Math.ceil(Math.abs(Math.tan(radians)) * rect.height) + 2;
  const compY = Math.ceil(deltaY) + 2;
  return { compX, compY };
};

const detectForcedColors = (ownerWindow) => ownerWindow.matchMedia?.('(forced-colors: active)')?.matches ?? false;

const readThemeTokens = (container) => {
  const cs = container.ownerDocument.defaultView.getComputedStyle(container.ownerDocument.documentElement);
  return {
    color: cs.getPropertyValue('--strip-color').trim() || '#5b21b6',
    opacity: asNumber(cs.getPropertyValue('--strip-opacity').trim(), 0.85),
    stripWidth: cs.getPropertyValue('--strip-width').trim() || '56px',
    angle: cs.getPropertyValue('--strip-angle').trim() || '14deg',
    strategy: cs.getPropertyValue('--strip-strategy').trim() || 'css',
  };
};

const normalizeConfig = (input) => {
  const c = input || {};
  return {
    color: c.color ?? '#5b21b6',
    opacity: clamp(asNumber(c.opacity, 0.85), 0, 1),
    stripWidth: c.stripWidth ?? '56px',
    angle: c.angle ?? '14deg',
    zIndex: typeof c.zIndex === 'number' ? c.zIndex : null,
    themeAware: Boolean(c.themeAware),
    strategy: c.strategy === 'svg' ? 'svg' : 'css',
    breakpoints: c.breakpoints ?? {},
    largeText: Boolean(c.largeText),
    minRatioNormalText: Math.max(4.5, asNumber(c.minRatioNormalText, 4.5)),
    minRatioLargeText: Math.max(3, asNumber(c.minRatioLargeText, 3)),
    minApcaLc: Math.max(APCA_CONSTANTS.APCA_MIN_LC, asNumber(c.minApcaLc, APCA_CONSTANTS.APCA_MIN_LC)),
  };
};

export class DiagonalStrip extends EventTarget {
  constructor(container, config = {}) {
    super();
    if (!container || !(container instanceof container.ownerDocument.defaultView.HTMLElement)) {
      throw new Error('DiagonalStrip requires a valid HTMLElement container');
    }
    this.container = container;
    this.scopeId = uid();
    this.ownerWindow = container.ownerDocument.defaultView;
    this.config = normalizeConfig(config);
    this.container.dataset.diagonalStripId = this.scopeId;
    ensurePositioning(container);
    this.#suppressPreviousDecorations();
    this.host = createHost(container, this.scopeId);
    this.activeStrategy = null;
    this.resizeObserver = new ResizeObserver(() => this.#sync());
    this.resizeObserver.observe(container);
    this.mediaQuery = this.ownerWindow.matchMedia('(forced-colors: active)');
    if (this.mediaQuery?.addEventListener) {
      this.mediaQuery.addEventListener('change', this.#handleForcedColorsChange);
    } else if (this.mediaQuery?.addListener) {
      this.mediaQuery.addListener(this.#handleForcedColorsChange);
    }
    if (this.config.themeAware && this.ownerWindow.MutationObserver) {
      this.themeMutationObserver = new this.ownerWindow.MutationObserver(() => this.#sync());
      this.themeMutationObserver.observe(this.container.ownerDocument.documentElement, {
        attributes: true,
        attributeFilter: ['style', 'class'],
      });
    }
    this.#initLayoutShiftObserver();
    this.#sync(true);
  }

  setProperty(key, value) {
    this.config = normalizeConfig({ ...this.config, [key]: value });
    this.#sync();
  }

  getProperty(key) {
    return this.config[key];
  }

  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.layoutShiftObserver) {
      this.layoutShiftObserver.disconnect();
      this.layoutShiftObserver = null;
    }
    if (this.mediaQuery?.removeEventListener) {
      this.mediaQuery.removeEventListener('change', this.#handleForcedColorsChange);
    } else if (this.mediaQuery?.removeListener) {
      this.mediaQuery.removeListener(this.#handleForcedColorsChange);
    }
    if (this.themeMutationObserver) {
      this.themeMutationObserver.disconnect();
      this.themeMutationObserver = null;
    }
    if (this.activeStrategy) {
      this.activeStrategy.destroy();
      this.activeStrategy = null;
    }
    if (this.host?.parentNode) {
      this.host.parentNode.removeChild(this.host);
    }
    delete this.container.dataset.diagonalStripId;
  }

  #handleForcedColorsChange = () => {
    this.#sync();
  };

  #initLayoutShiftObserver() {
    if (!this.ownerWindow.PerformanceObserver) return;
    try {
      this.layoutShiftObserver = new this.ownerWindow.PerformanceObserver((list) => {
        const entries = list.getEntries();
        const cumulative = entries.reduce((sum, entry) => sum + (entry.value || 0), 0);
        if (cumulative > 0) {
          this.dispatchEvent(
            new CustomEvent('strip:warning', {
              detail: { type: 'layout-shift', cls: cumulative },
            })
          );
        }
      });
      this.layoutShiftObserver.observe({ type: 'layout-shift', buffered: true });
    } catch (error) {
      this.layoutShiftObserver = null;
    }
  }

  #resolveResponsiveConfig() {
    const viewport = this.ownerWindow.innerWidth;
    const base = this.config.themeAware ? { ...readThemeTokens(this.container), ...this.config } : this.config;
    const mobile = { ...base, ...(base.breakpoints?.mobile || {}) };
    const tablet = { ...base, ...(base.breakpoints?.tablet || {}) };
    const desktop = { ...base, ...(base.breakpoints?.desktop || {}) };
    const nearest = nearestBreakpointProps(base, viewport);
    const angleMobile = withDeg(mobile.angle ?? base.angle);
    const angleTablet = withDeg(tablet.angle ?? base.angle);
    const angleDesktop = withDeg(desktop.angle ?? base.angle);
    let angleDeg = angleTablet;
    if (viewport <= BREAKPOINTS.mobile) {
      angleDeg = angleMobile;
    } else if (viewport <= BREAKPOINTS.tablet) {
      angleDeg = interpolateScalar(BREAKPOINTS.mobile, angleMobile, BREAKPOINTS.tablet, angleTablet, viewport);
    } else {
      angleDeg = interpolateScalar(BREAKPOINTS.tablet + 1, angleTablet, Math.max(viewport, BREAKPOINTS.tablet + 1), angleDesktop, viewport);
    }
    const stripWidthCss = interpolateDimension(mobile.stripWidth, tablet.stripWidth, desktop.stripWidth, viewport);
    return {
      ...nearest,
      angleDeg,
      stripWidthCss,
    };
  }

  #computeContrast(color, largeText) {
    const background = getBackgroundColor(this.container);
    const minRatio = largeText ? this.config.minRatioLargeText : this.config.minRatioNormalText;
    return ensureCompliantColor({
      preferredColor: color,
      backgroundColor: background,
      minRatio,
      largeText,
      minLc: this.config.minApcaLc,
      ownerDocument: this.container.ownerDocument,
    });
  }

  #sync(initial = false) {
    const start = this.ownerWindow.performance?.now?.() ?? Date.now();
    const responsive = this.#resolveResponsiveConfig();
    const forcedColors = detectForcedColors(this.ownerWindow);
    const contrast = this.#computeContrast(responsive.color, Boolean(responsive.largeText));
    const color = contrast.output || responsive.color;
    const opacity = forcedColors ? 1 : responsive.opacity;
    const rect = this.container.getBoundingClientRect();
    const compensation = computeCompensation(rect, responsive.angleDeg);
    const zIndex = Number.isInteger(responsive.zIndex) ? responsive.zIndex : computeAutoZIndex(this.container);
    const normalizedWidthPercent = clamp((rect.height > 0 ? ((asNumber(responsive.stripWidthCss, 56) / rect.height) * 100) : 18), 2, 98);
    const computed = {
      color,
      opacity,
      stripWidthCss: responsive.stripWidthCss,
      angleDeg: responsive.angleDeg,
      zIndex,
      compX: compensation.compX,
      compY: compensation.compY,
      normalizedWidthPercent,
      contrast,
    };
    this.#applyStrategy(responsive.strategy, computed);
    const elapsed = (this.ownerWindow.performance?.now?.() ?? Date.now()) - start;
    if (elapsed > 2) {
      this.dispatchEvent(
        new CustomEvent('strip:warning', {
          detail: { type: 'switch-latency', milliseconds: elapsed },
        })
      );
    }
    if (contrast.corrected) {
      this.dispatchEvent(
        new CustomEvent('strip:warning', {
          detail: {
            type: 'contrast-corrected',
            from: responsive.color,
            to: contrast.output,
            ratio: contrast.ratio,
            lc: contrast.lc,
          },
        })
      );
    }
    this.dispatchEvent(
      new CustomEvent('strip:change', {
        detail: {
          props: { ...this.config },
          computedContrast: {
            ratio: contrast.ratio,
            lc: contrast.lc,
            corrected: contrast.corrected,
            output: contrast.output,
          },
          computed,
          initial,
        },
      })
    );
  }

  #applyStrategy(strategy, computed) {
    const target = strategy === 'svg' ? 'svg' : 'css';
    if (!this.activeStrategy || this.strategyName !== target) {
      if (this.activeStrategy) {
        this.activeStrategy.destroy();
      }
      this.strategyName = target;
      this.activeStrategy = target === 'svg'
        ? new SvgStrategy(this.container, this.host, this.scopeId)
        : new CssStrategy(this.container, this.host, this.scopeId);
    }
    this.activeStrategy.apply(computed);
  }

  #suppressPreviousDecorations() {
    this.container.style.setProperty('--title-strip', 'transparent');
    this.container.style.setProperty('--header-diagonal', 'none');
    this.container.querySelectorAll('[data-diagonal-strip-host], [data-diagonal-svg], .diagonal-strip-host').forEach((el) => {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
  }
}

export const appendStrip = (container, config = {}) => new DiagonalStrip(container, config);

export default DiagonalStrip;

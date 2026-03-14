export type StripStrategy = 'css' | 'svg';

export type StripBreakpointConfig = Partial<Omit<StripConfig, 'breakpoints'>>;

export interface StripConfig {
  color?: string;
  opacity?: number;
  stripWidth?: string;
  angle?: number | `${number}deg`;
  zIndex?: number | null;
  themeAware?: boolean;
  strategy?: StripStrategy;
  breakpoints?: {
    mobile?: StripBreakpointConfig;
    tablet?: StripBreakpointConfig;
    desktop?: StripBreakpointConfig;
  };
  largeText?: boolean;
  minRatioNormalText?: number;
  minRatioLargeText?: number;
  minApcaLc?: number;
}

export interface StripChangeDetail {
  props: StripConfig;
  computedContrast: {
    ratio: number;
    lc: number;
    corrected: boolean;
    output: string;
  };
  computed: {
    color: string;
    opacity: number;
    stripWidthCss: string;
    angleDeg: number;
    zIndex: number;
    compX: number;
    compY: number;
    normalizedWidthPercent: number;
  };
  initial: boolean;
}

export interface StripWarningDetail {
  type: 'switch-latency' | 'contrast-corrected' | 'layout-shift';
  milliseconds?: number;
  from?: string;
  to?: string;
  ratio?: number;
  lc?: number;
  cls?: number;
}

export class DiagonalStrip extends EventTarget {
  constructor(container: HTMLElement, config?: StripConfig);
  setProperty<K extends keyof StripConfig>(key: K, value: StripConfig[K]): void;
  getProperty<K extends keyof StripConfig>(key: K): StripConfig[K];
  addEventListener(
    type: 'strip:change',
    listener: (event: CustomEvent<StripChangeDetail>) => void,
    options?: boolean | AddEventListenerOptions
  ): void;
  addEventListener(
    type: 'strip:warning',
    listener: (event: CustomEvent<StripWarningDetail>) => void,
    options?: boolean | AddEventListenerOptions
  ): void;
  destroy(): void;
}

export const appendStrip: (container: HTMLElement, config?: StripConfig) => DiagonalStrip;

export default DiagonalStrip;

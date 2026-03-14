# Diagonal Strip API

## Module

- Source: `src/diagonal-strip.esm.js`
- Type Definitions: `src/diagonal-strip.d.ts`
- Strategies:
  - `src/strategies/css-strategy.js`
  - `src/strategies/svg-strategy.js`
- Contrast Utility:
  - `src/contrast/apca.js`

## Types

### StripStrategy

`'css' | 'svg'`

### StripConfig

| Property | Type | Description |
| --- | --- | --- |
| `color` | `string` | Any CSS color including hex/rgb/hsl/lch/oklch |
| `opacity` | `number` | 0..1 with precision up to 0.01 |
| `stripWidth` | `string` | `px`, `%`, `vw`, `clamp(...)`, `calc(...)` |
| `angle` | `number \| \`${number}deg\`` | Angle from `-45` to `45` |
| `zIndex` | `number \| null` | Auto-managed if null |
| `themeAware` | `boolean` | Cascade defaults from root strip tokens |
| `strategy` | `StripStrategy` | `'css'` default, `'svg'` fallback |
| `breakpoints.mobile` | `Partial<StripConfig>` | <= 768 |
| `breakpoints.tablet` | `Partial<StripConfig>` | 769..1024 |
| `breakpoints.desktop` | `Partial<StripConfig>` | >= 1025 |
| `largeText` | `boolean` | Uses large-text contrast target |
| `minRatioNormalText` | `number` | Default `4.5` |
| `minRatioLargeText` | `number` | Default `3` |
| `minApcaLc` | `number` | Default `15` |

## Class: DiagonalStrip

### Constructor

`new DiagonalStrip(container: HTMLElement, config?: StripConfig)`

### Methods

- `setProperty<K extends keyof StripConfig>(key: K, value: StripConfig[K]): void`
- `getProperty<K extends keyof StripConfig>(key: K): StripConfig[K]`
- `destroy(): void`

### Events

- `strip:change`
  - `detail.props`: current config
  - `detail.computedContrast`: `{ ratio, lc, corrected, output }`
- `strip:warning`
  - types: `switch-latency`, `contrast-corrected`, `layout-shift`

## Helper

`appendStrip(container: HTMLElement, config?: StripConfig): DiagonalStrip`

## React Snippet

```tsx
import { useEffect, useRef } from 'react';
import { appendStrip } from '@/diagonal-strip.esm.js';

export function HeaderStrip() {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const strip = appendStrip(ref.current, {
      color: 'oklch(56% 0.2 295)',
      opacity: 0.86,
      stripWidth: 'clamp(28px, 5vw, 56px)',
      angle: '16deg',
      themeAware: true,
    });
    return () => strip.destroy();
  }, []);
  return <header ref={ref}>Header</header>;
}
```

## Vue Snippet

```ts
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { appendStrip } from '@/diagonal-strip.esm.js';

const headerRef = ref<HTMLElement | null>(null);
let strip: any;

onMounted(() => {
  if (!headerRef.value) return;
  strip = appendStrip(headerRef.value, { angle: '14deg', strategy: 'css' });
});

onBeforeUnmount(() => {
  strip?.destroy();
});
```

## Angular Snippet

```ts
import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { appendStrip } from '@/diagonal-strip.esm.js';

@Component({ selector: 'app-header', template: '<header #hdr>Header</header>' })
export class HeaderComponent implements AfterViewInit, OnDestroy {
  @ViewChild('hdr') hdr!: ElementRef<HTMLElement>;
  private strip: any;
  ngAfterViewInit() {
    this.strip = appendStrip(this.hdr.nativeElement, { angle: '12deg', strategy: 'svg' });
  }
  ngOnDestroy() {
    this.strip?.destroy();
  }
}
```

## Palette Table

### Light

| Token | Value |
| --- | --- |
| `--strip-color` | `#5b21b6` |
| `--strip-opacity` | `0.88` |
| `--strip-width` | `48px` |
| `--strip-angle` | `14deg` |

### Dark

| Token | Value |
| --- | --- |
| `--strip-color` | `#a78bfa` |
| `--strip-opacity` | `0.82` |
| `--strip-width` | `52px` |
| `--strip-angle` | `16deg` |

### High Contrast

| Token | Value |
| --- | --- |
| `--strip-color` | `#000000` |
| `--strip-opacity` | `1` |
| `--strip-width` | `44px` |
| `--strip-angle` | `12deg` |

## Integration Guide

1. Set root tokens:

```css
:root{
  --strip-color:#5b21b6;
  --strip-opacity:0.88;
  --strip-width:48px;
  --strip-angle:14deg;
}
```

2. Inject with one call:

```ts
import { appendStrip } from '@/diagonal-strip.esm.js';
appendStrip(document.querySelector('header')!, { themeAware: true });
```

3. Switch runtime strategy:

```ts
strip.setProperty('strategy', 'svg');
```

4. Listen for contrast correction:

```ts
strip.addEventListener('strip:warning', (ev) => {
  if (ev.detail.type === 'contrast-corrected') {
    console.warn(ev.detail);
  }
});
```

## Backwards Compatibility Policy

- Public API follows semantic versioning.
- Major versions may break constructor or event contracts.
- Minor versions add optional config properties only.
- Patch versions contain bug fixes without shape changes.

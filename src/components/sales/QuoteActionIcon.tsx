import { useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';

export type QuoteActionIconName =
  | 'newQuote'
  | 'refresh'
  | 'importExport'
  | 'defaultSimple'
  | 'saveQuote'
  | 'cancel'
  | 'saveVersion'
  | 'importUpdate'
  | 'convertToBooking'
  | 'exportThisQuote'
  | 'previewPdf'
  | 'shareQuote';

const SPRITE_ID = 'quote-action-icon-sprite';
const DEFAULT_PNG_FALLBACK =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAIUlEQVR4nO3BAQ0AAADCoPdPbQ43oAAAAAAAAAAA4G4wQAAB1QotGQAAAABJRU5ErkJggg==';

const symbolMarkup: Record<QuoteActionIconName, string> = {
  newQuote:
    '<rect x="5" y="3" width="12" height="16" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="1.8"/><line x1="9" y1="11" x2="15" y2="11" stroke="currentColor" stroke-width="1.8"/><line x1="12" y1="8" x2="12" y2="14" stroke="currentColor" stroke-width="1.8"/><path d="M17 7h2a2 2 0 0 1 2 2v9" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  refresh:
    '<path d="M20 12a8 8 0 1 1-2.4-5.7" fill="none" stroke="currentColor" stroke-width="1.8"/><polyline points="20 4 20 10 14 10" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  importExport:
    '<rect x="4" y="3.5" width="10" height="14" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="1.8"/><polyline points="14,8 18,8 18,5" fill="none" stroke="currentColor" stroke-width="1.8"/><line x1="18" y1="8" x2="12" y2="14" stroke="currentColor" stroke-width="1.8"/><line x1="18" y1="16" x2="18" y2="22" stroke="currentColor" stroke-width="1.8"/><polyline points="16,18 18,16 20,18" fill="none" stroke="currentColor" stroke-width="1.8"/><polyline points="16,20 18,22 20,20" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  defaultSimple:
    '<path d="M8 8H4V4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 8a8 8 0 1 1-1.1 4.1" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  saveQuote:
    '<path d="M4 4h13l3 3v13H4z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 4v6h7V4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 16l2.5 2.5L16 13" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  cancel:
    '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" stroke-width="1.8"/><line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" stroke-width="1.8"/>',
  saveVersion:
    '<path d="M4 4h13l3 3v13H4z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 4v6h7V4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M15 16h5v4h-5z" fill="none" stroke="currentColor" stroke-width="1.8"/><text x="17.5" y="19" text-anchor="middle" font-size="3.5" fill="currentColor">v</text>',
  importUpdate:
    '<path d="M12 4v10" fill="none" stroke="currentColor" stroke-width="1.8"/><polyline points="8,10 12,14 16,10" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M19 10a5 5 0 1 0 1.2 4.2" fill="none" stroke="currentColor" stroke-width="1.8"/><polyline points="20,6 20,10 16,10" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  convertToBooking:
    '<rect x="4" y="5" width="8" height="7" rx="1" ry="1" fill="none" stroke="currentColor" stroke-width="1.8"/><line x1="4" y1="8" x2="12" y2="8" stroke="currentColor" stroke-width="1.8"/><path d="M13 16h7" fill="none" stroke="currentColor" stroke-width="1.8"/><polyline points="17,13 20,16 17,19" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  exportThisQuote:
    '<rect x="4" y="3.5" width="10" height="14" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="1.8"/><line x1="14" y1="12" x2="20" y2="12" stroke="currentColor" stroke-width="1.8"/><polyline points="17,9 20,12 17,15" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  previewPdf:
    '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="16.5" y="14.5" width="5.5" height="7" rx="1" ry="1" fill="none" stroke="currentColor" stroke-width="1.4"/><text x="19.25" y="19" text-anchor="middle" font-size="3.3" fill="currentColor">PDF</text>',
  shareQuote:
    '<circle cx="6" cy="12" r="2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="18" cy="6" r="2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="18" cy="18" r="2" fill="none" stroke="currentColor" stroke-width="1.8"/><line x1="7.8" y1="10.9" x2="16.2" y2="7.1" stroke="currentColor" stroke-width="1.8"/><line x1="7.8" y1="13.1" x2="16.2" y2="16.9" stroke="currentColor" stroke-width="1.8"/>',
};

function ensureSprite() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(SPRITE_ID)) return;
  const sprite = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  sprite.setAttribute('id', SPRITE_ID);
  sprite.setAttribute('aria-hidden', 'true');
  sprite.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden');
  const defs = Object.entries(symbolMarkup)
    .map(([name, markup]) => `<symbol id="qa-${name}" viewBox="0 0 24 24">${markup}</symbol>`)
    .join('');
  sprite.innerHTML = defs;
  document.body.appendChild(sprite);
}

function isLegacyBrowser() {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  return /MSIE|Trident\//.test(ua);
}

interface QuoteActionIconProps {
  name: QuoteActionIconName;
  label: string;
  className?: string;
  size?: number;
  fallbackPngSrc?: string;
}

export function QuoteActionIcon({ name, label, className, size = 24, fallbackPngSrc }: QuoteActionIconProps) {
  useEffect(() => {
    ensureSprite();
  }, []);

  const legacy = useMemo(() => isLegacyBrowser(), []);

  if (legacy) {
    return (
      <img
        src={fallbackPngSrc || DEFAULT_PNG_FALLBACK}
        alt={label}
        width={size}
        height={size}
        className={cn('inline-block shrink-0', className)}
      />
    );
  }

  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={cn('inline-block shrink-0', className)}
    >
      <use href={`#qa-${name}`} xlinkHref={`#qa-${name}`} />
    </svg>
  );
}

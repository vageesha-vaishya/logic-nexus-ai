export function sanitizePayload<T>(payload: T): T {
  const seen = new WeakSet();

  function sanitize(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    const maybeNode = (globalThis as any)?.Node;
    if (
      (typeof maybeNode !== 'undefined' && obj instanceof maybeNode) ||
      (obj.nodeType && typeof obj.nodeName === 'string')
    ) {
      return undefined;
    }

    if (obj._reactInternals || obj.$$typeof) {
      return undefined;
    }

    if (seen.has(obj)) {
      return undefined;
    }
    seen.add(obj);

    if (Array.isArray(obj)) {
      return obj
        .map(item => sanitize(item))
        .filter(item => item !== undefined);
    }

    const result: any = {};
    for (const key in obj) {
      if (
        key.startsWith('_') || 
        key.startsWith('__') ||
        key.startsWith('on') && typeof obj[key] === 'function'
      ) {
        continue;
      }

      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const val = sanitize(obj[key]);
        if (val !== undefined) {
          result[key] = val;
        }
      }
    }
    return result;
  }

  return sanitize(payload);
}

const RICH_TEXT_ALLOWED_TAGS = new Set([
  'a',
  'b',
  'br',
  'div',
  'em',
  'i',
  'li',
  'ol',
  'p',
  'span',
  'strong',
  'u',
  'ul',
]);

export function sanitizeRichTextHtml(input: string): string {
  if (!input) return '';

  const withoutScriptBlocks = input.replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
  const cleaned = withoutScriptBlocks.replace(/<[^>]*>/g, (rawTag) => {
    const normalizedTag = rawTag.trim().toLowerCase();
    const closingMatch = normalizedTag.match(/^<\s*\/\s*([a-z0-9]+)\s*>$/i);
    if (closingMatch) {
      const tag = closingMatch[1];
      return RICH_TEXT_ALLOWED_TAGS.has(tag) ? `</${tag}>` : '';
    }

    const openingMatch = normalizedTag.match(/^<\s*([a-z0-9]+)([^>]*)>$/i);
    if (!openingMatch) return '';
    const tag = openingMatch[1];
    if (!RICH_TEXT_ALLOWED_TAGS.has(tag)) return '';

    if (tag === 'a') {
      const hrefMatch = rawTag.match(/\shref\s*=\s*(['"])(.*?)\1/i) || rawTag.match(/\shref\s*=\s*([^\s>]+)/i);
      const href = hrefMatch?.[2] || hrefMatch?.[1] || '';
      const safeHref = String(href).trim();
      const validHref = /^(https?:\/\/|mailto:|tel:|\/)/i.test(safeHref) ? safeHref : '';
      return validHref ? `<a href="${validHref}">` : '<a>';
    }

    return `<${tag}>`;
  });

  return cleaned.trim();
}

export function stripHtmlTags(input: string): string {
  if (!input) return '';
  return input
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sanitizeBrandingCss(input: string): string {
  if (!input) return '';
  const maxLength = 12000;
  const normalized = String(input).slice(0, maxLength);
  return normalized
    .replace(/<[^>]*>/g, '')
    .replace(/@import[\s\S]*?;/gi, '')
    .replace(/expression\s*\([^)]*\)/gi, '')
    .replace(/behavior\s*:[^;]+;?/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/url\s*\(\s*['"]?\s*javascript:[^)]+\)/gi, 'url()')
    .trim();
}

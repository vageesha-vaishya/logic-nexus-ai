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

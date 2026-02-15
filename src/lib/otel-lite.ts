export type Span = { id: string; name: string; start: number; attrs: Record<string, any>; end: () => void }

export function startSpan(name: string, attrs: Record<string, any> = {}): Span {
  const id = cryptoRandomId()
  const start = Date.now()
  const span: Span = {
    id,
    name,
    start,
    attrs,
    end: () => {
      const duration = Date.now() - start
      // Hook this to real OpenTelemetry SDK later
      // For now, emit a console log for observability
      try { console.log(`[otel-lite] span ${name} (${id})`, { duration, ...attrs }) } catch {}
    }
  }
  return span
}

function cryptoRandomId() {
  const arr = new Uint8Array(16)
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) window.crypto.getRandomValues(arr)
  else for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

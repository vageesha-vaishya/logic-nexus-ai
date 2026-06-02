// Minimal structured logger. JSON line per call so log aggregators
// (CloudWatch / Loki / etc) can parse. Fields per design §4.7.

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levelOrder: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const minLevel: LogLevel = (process.env.LOG_LEVEL?.toLowerCase() as LogLevel) || 'info';

function emit(level: LogLevel, msg: string, fields?: Record<string, unknown>): void {
  if (levelOrder[level] < levelOrder[minLevel]) return;
  const line = {
    ts: new Date().toISOString(),
    level,
    msg,
    service: 'llm-gateway',
    ...fields,
  };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(line));
}

export const logger = {
  debug: (msg: string, fields?: Record<string, unknown>) => emit('debug', msg, fields),
  info: (msg: string, fields?: Record<string, unknown>) => emit('info', msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => emit('warn', msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => emit('error', msg, fields),
};

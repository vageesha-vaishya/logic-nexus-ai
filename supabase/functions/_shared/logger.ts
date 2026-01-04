export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  timestamp: string;
  requestId?: string;
}

export class Logger {
  private context: Record<string, any>;
  private requestId?: string;

  constructor(context: Record<string, any> = {}, requestId?: string) {
    this.context = context;
    this.requestId = requestId;
  }

  private log(level: LogLevel, message: string, data?: Record<string, any>) {
    const entry: LogEntry = {
      level,
      message,
      context: { ...this.context, ...data },
      timestamp: new Date().toISOString(),
      requestId: this.requestId,
    };

    // In a production environment, you might send this to a logging service (Datadog, Sentry, etc.)
    // or insert it into a Supabase 'system_logs' table.
    // For now, structured JSON logging to stdout/stderr is best for observability in Supabase Dashboard.
    const logString = JSON.stringify(entry);

    switch (level) {
      case LogLevel.DEBUG:
      case LogLevel.INFO:
        console.log(logString);
        break;
      case LogLevel.WARN:
        console.warn(logString);
        break;
      case LogLevel.ERROR:
        console.error(logString);
        break;
    }
  }

  debug(message: string, data?: Record<string, any>) {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: Record<string, any>) {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: Record<string, any>) {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, data?: Record<string, any>) {
    this.log(LogLevel.ERROR, message, data);
  }

  // Helper to create a child logger with additional context
  child(additionalContext: Record<string, any>): Logger {
    return new Logger({ ...this.context, ...additionalContext }, this.requestId);
  }
}

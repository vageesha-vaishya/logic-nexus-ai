// Client-side Logger for React/Browser
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
}

const isProduction = import.meta.env.PROD;

class LoggerService {
  private static instance: LoggerService;
  private context: Record<string, any> = {};

  private constructor() {}

  static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }

  setContext(context: Record<string, any>) {
    this.context = { ...this.context, ...context };
  }

  private log(level: LogLevel, message: string, data?: Record<string, any>) {
    const entry: LogEntry = {
      level,
      message,
      context: { ...this.context, ...data },
      timestamp: new Date().toISOString(),
    };

    // In production, we might want to suppress DEBUG logs or send ERRORs to a monitoring service
    if (isProduction && level === LogLevel.DEBUG) {
      return;
    }

    const style = this.getStyle(level);
    console.log(`%c[${level.toUpperCase()}] ${message}`, style, entry.context || '');
  }

  private getStyle(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG: return 'color: #9E9E9E';
      case LogLevel.INFO: return 'color: #2196F3';
      case LogLevel.WARN: return 'color: #FFC107';
      case LogLevel.ERROR: return 'color: #F44336; font-weight: bold';
      default: return '';
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
}

export const logger = LoggerService.getInstance();

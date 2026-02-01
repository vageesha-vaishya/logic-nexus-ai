import { debugStore } from './debug-store';

export type DataFlowType = 'inbound' | 'outbound' | 'transformation' | 'validation';
export type DataFlowSource = 'database' | 'ui' | 'api' | 'function';

export interface DataFlowLog {
  type: 'data-flow';
  timestamp: string;
  flowType: DataFlowType;
  source: DataFlowSource;
  operation: string;
  target?: string;
  status: 'success' | 'error' | 'warning' | 'pending';
  duration?: number;
  payload?: any;
  metadata?: any;
  error?: any;
}

export class DataFlowMonitor {
  static track(event: Omit<DataFlowLog, 'type' | 'timestamp'>) {
    debugStore.addLog({
      type: 'data-flow',
      timestamp: new Date().toISOString(),
      ...event
    });
  }

  static trackInbound(source: string, operation: string, data: any, duration?: number) {
    this.track({
      flowType: 'inbound',
      source: 'database', 
      operation,
      target: source,
      status: 'success',
      duration,
      payload: data
    });
  }

  static trackOutbound(source: string, operation: string, data: any) {
    this.track({
      flowType: 'outbound',
      source: 'ui',
      operation,
      target: source,
      status: 'pending',
      payload: data
    });
  }

  static trackTransformation(name: string, input: any, output: any, duration?: number) {
    this.track({
      flowType: 'transformation',
      source: 'function',
      operation: 'transform',
      target: name,
      status: 'success',
      duration,
      payload: { input, output }
    });
  }
  
  static trackValidation(context: string, status: 'success' | 'error', errors?: any) {
    this.track({
      flowType: 'validation',
      source: 'ui',
      operation: 'validate',
      target: context,
      status,
      error: errors
    });
  }
}

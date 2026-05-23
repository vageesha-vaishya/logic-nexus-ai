import { EventEmitter } from 'events';
import { WorkOrder } from '../types/amro.types.js';

export type WorkOrderStreamEventType = 'created' | 'updated' | 'deleted';

export type WorkOrderStreamEvent = {
  type: WorkOrderStreamEventType;
  tenantId: string;
  userId: string;
  at: string;
  workOrder: Partial<WorkOrder> & { id: string };
};

class WorkOrdersStream {
  private emitter = new EventEmitter();

  subscribe(listener: (event: WorkOrderStreamEvent) => void) {
    this.emitter.on('work-order-change', listener);
    return () => {
      this.emitter.off('work-order-change', listener);
    };
  }

  publish(event: WorkOrderStreamEvent) {
    this.emitter.emit('work-order-change', event);
  }
}

export const workOrdersStream = new WorkOrdersStream();

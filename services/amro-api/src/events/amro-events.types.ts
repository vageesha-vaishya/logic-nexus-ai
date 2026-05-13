/**
 * AMRO Event Types
 * Event definitions for Kafka pub/sub for work orders and tasks
 */

/**
 * Event types supported by AMRO module
 */
export enum AmroEventType {
  WORK_ORDER_CREATED = 'amro.work_order.created',
  WORK_ORDER_UPDATED = 'amro.work_order.updated',
  WORK_ORDER_DELETED = 'amro.work_order.deleted',
  TASK_CREATED = 'amro.task.created',
  TASK_UPDATED = 'amro.task.updated',
  TASK_DELETED = 'amro.task.deleted',
  TASK_STARTED = 'amro.task.started',
  TASK_COMPLETED = 'amro.task.completed',
  MAINTENANCE_EVENT_RECORDED = 'amro.maintenance_event.recorded',
}

/**
 * Base event payload structure
 */
export interface AmroEventPayload {
  event_type: AmroEventType;
  event_id: string;
  timestamp: string;
  tenant_id: string;
  user_id: string;
  data: Record<string, any>;
  idempotency_key: string;
}

/**
 * Work Order specific events
 */
export interface AmroWorkOrderEvent extends AmroEventPayload {
  event_type:
    | AmroEventType.WORK_ORDER_CREATED
    | AmroEventType.WORK_ORDER_UPDATED
    | AmroEventType.WORK_ORDER_DELETED;
  data: {
    work_order_id: string;
    work_order_number: string;
    aircraft_id: string;
    title: string;
    status?: string;
    maintenance_type?: string;
    estimated_cost?: number;
    [key: string]: any;
  };
}

/**
 * Task specific events
 */
export interface AmroTaskEvent extends AmroEventPayload {
  event_type:
    | AmroEventType.TASK_CREATED
    | AmroEventType.TASK_UPDATED
    | AmroEventType.TASK_DELETED
    | AmroEventType.TASK_STARTED
    | AmroEventType.TASK_COMPLETED;
  data: {
    task_id: string;
    task_number: string;
    work_order_id: string;
    title: string;
    status?: string;
    assigned_technician_id?: string;
    [key: string]: any;
  };
}

/**
 * Maintenance Event specific events
 */
export interface AmroMaintenanceEvent extends AmroEventPayload {
  event_type: AmroEventType.MAINTENANCE_EVENT_RECORDED;
  data: {
    task_id: string;
    task_number: string;
    work_order_id: string;
    executed_by: string;
    evidence_captured: boolean;
    event_type?: string;
    sign_off_date?: string;
    notes?: string;
    [key: string]: any;
  };
}

/**
 * Union type for all AMRO events
 */
export type AmroEvent = AmroWorkOrderEvent | AmroTaskEvent | AmroMaintenanceEvent;

import { Consumer, Kafka, logLevel } from 'kafkajs';
import { GLPosterService } from '../services/gl/GLPosterService.js';
import { logger } from '../utils/logger.js';
import { FinanceEventType, InvoiceFinalizedEvent } from './finance-events.types.js';

const KAFKA_BROKERS = process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'];
const KAFKA_CLIENT_ID = process.env.KAFKA_CLIENT_ID || 'crm-api-finance-consumer';
const KAFKA_TOPIC_FINANCE_GL = process.env.KAFKA_TOPIC_FINANCE_GL || 'finance.gl';
const KAFKA_GROUP_ID = process.env.KAFKA_GROUP_FINANCE_GL || 'crm-api-finance-gl-consumers';
const KAFKA_CONSUMER_TIMEOUT = parseInt(process.env.KAFKA_CONSUMER_TIMEOUT || '5000', 10);

function isInvoiceFinalizedEvent(value: unknown): value is InvoiceFinalizedEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const event = value as Record<string, unknown>;
  const data = event.data as Record<string, unknown> | undefined;

  return (
    event.event_type === FinanceEventType.INVOICE_FINALIZED &&
    typeof event.event_id === 'string' &&
    typeof event.timestamp === 'string' &&
    typeof event.tenant_id === 'string' &&
    (typeof event.franchise_id === 'string' || event.franchise_id === null) &&
    typeof event.user_id === 'string' &&
    typeof event.idempotency_key === 'string' &&
    !!data &&
    typeof data.invoice_id === 'string'
  );
}

export class FinanceEventsConsumer {
  private static instance: FinanceEventsConsumer;
  private kafka: Kafka | null = null;
  private consumer: Consumer | null = null;
  private isConnected = false;

  private constructor() {}

  static getInstance(): FinanceEventsConsumer {
    if (!FinanceEventsConsumer.instance) {
      FinanceEventsConsumer.instance = new FinanceEventsConsumer();
    }
    return FinanceEventsConsumer.instance;
  }

  async initialize(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    this.kafka = new Kafka({
      clientId: KAFKA_CLIENT_ID,
      brokers: KAFKA_BROKERS,
      logLevel: logLevel.ERROR,
      requestTimeout: KAFKA_CONSUMER_TIMEOUT,
      connectionTimeout: KAFKA_CONSUMER_TIMEOUT,
      retry: {
        initialRetryTime: 100,
        retries: 3,
        maxRetryTime: 30000,
        multiplier: 2
      }
    });

    this.consumer = this.kafka.consumer({ groupId: KAFKA_GROUP_ID });
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: KAFKA_TOPIC_FINANCE_GL, fromBeginning: false });

    await this.consumer.run({
      eachMessage: async ({ message }) => {
        const rawValue = message.value?.toString();
        if (!rawValue) {
          logger.warn('Skipping finance event with empty payload');
          return;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(rawValue);
        } catch (error) {
          logger.warn('Skipping finance event with invalid JSON payload', {
            error: error instanceof Error ? error.message : String(error)
          });
          return;
        }

        if (!isInvoiceFinalizedEvent(parsed)) {
          logger.warn('Skipping unknown finance event payload shape');
          return;
        }

        try {
          await GLPosterService.postInvoiceFinalized(parsed);
          logger.info('Processed finance invoice finalized event', {
            eventId: parsed.event_id,
            tenantId: parsed.tenant_id,
            invoiceId: parsed.data.invoice_id
          });
        } catch (error) {
          logger.error('Failed processing finance invoice finalized event', {
            eventId: parsed.event_id,
            tenantId: parsed.tenant_id,
            invoiceId: parsed.data.invoice_id,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    });

    this.isConnected = true;
  }

  async shutdown(): Promise<void> {
    if (this.consumer && this.isConnected) {
      await this.consumer.disconnect();
      this.consumer = null;
      this.kafka = null;
      this.isConnected = false;
    }
  }
}

export const financeEventsConsumer = FinanceEventsConsumer.getInstance();

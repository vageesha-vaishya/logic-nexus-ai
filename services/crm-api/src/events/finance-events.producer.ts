import { randomUUID } from 'crypto';
import { Kafka, Producer, logLevel } from 'kafkajs';
import { logger } from '../utils/logger';
import { FinanceEventType, InvoiceFinalizedEvent } from './finance-events.types';
import { GLPosterService } from '../services/gl/GLPosterService';

const KAFKA_BROKERS = process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'];
const KAFKA_CLIENT_ID = process.env.KAFKA_CLIENT_ID || 'crm-api-finance-producer';
const KAFKA_TOPIC_FINANCE_GL = process.env.KAFKA_TOPIC_FINANCE_GL || 'finance.gl';
const KAFKA_PRODUCER_TIMEOUT = parseInt(process.env.KAFKA_PRODUCER_TIMEOUT || '5000', 10);

type EnqueueInvoiceFinalizedInput = {
  tenantId: string;
  franchiseId: string | null;
  userId: string;
  invoiceId: string;
  idempotencyKey?: string | null;
};

type EnqueueResult = {
  queued: true;
  mode: 'kafka' | 'in_process';
  jobId: string;
};

export class FinanceEventsProducer {
  private static instance: FinanceEventsProducer;
  private kafka: Kafka | null = null;
  private producer: Producer | null = null;
  private isConnected = false;

  private constructor() {}

  static getInstance(): FinanceEventsProducer {
    if (!FinanceEventsProducer.instance) {
      FinanceEventsProducer.instance = new FinanceEventsProducer();
    }
    return FinanceEventsProducer.instance;
  }

  async initialize(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    this.kafka = new Kafka({
      clientId: KAFKA_CLIENT_ID,
      brokers: KAFKA_BROKERS,
      logLevel: logLevel.ERROR,
      requestTimeout: KAFKA_PRODUCER_TIMEOUT,
      connectionTimeout: KAFKA_PRODUCER_TIMEOUT,
      retry: {
        initialRetryTime: 100,
        retries: 3,
        maxRetryTime: 30000,
        multiplier: 2
      }
    });

    this.producer = this.kafka.producer({
      idempotent: true,
      maxInFlightRequests: 5
    });

    await this.producer.connect();
    this.isConnected = true;
  }

  async enqueueInvoiceFinalized(input: EnqueueInvoiceFinalizedInput): Promise<EnqueueResult> {
    const jobId = `gl-sync:${input.tenantId}:INVOICE:${input.invoiceId}`;
    const event: InvoiceFinalizedEvent = {
      event_type: FinanceEventType.INVOICE_FINALIZED,
      event_id: randomUUID(),
      timestamp: new Date().toISOString(),
      tenant_id: input.tenantId,
      franchise_id: input.franchiseId,
      user_id: input.userId,
      idempotency_key: input.idempotencyKey || `${input.tenantId}-${input.invoiceId}-${randomUUID()}`,
      data: {
        invoice_id: input.invoiceId
      }
    };

    if (this.producer && this.isConnected) {
      await this.publishEvent(KAFKA_TOPIC_FINANCE_GL, event);
      return {
        queued: true,
        mode: 'kafka',
        jobId
      };
    }

    setTimeout(() => {
      void GLPosterService.postInvoiceFinalized(event).catch((error) => {
        logger.error('In-process GL posting failed', {
          tenantId: input.tenantId,
          invoiceId: input.invoiceId,
          error: error instanceof Error ? error.message : String(error)
        });
      });
    }, 0);

    return {
      queued: true,
      mode: 'in_process',
      jobId
    };
  }

  private async publishEvent(topic: string, event: InvoiceFinalizedEvent): Promise<void> {
    if (!this.producer) {
      throw new Error('Producer not initialized');
    }

    await this.producer.send({
      topic,
      messages: [
        {
          key: event.tenant_id,
          value: JSON.stringify(event),
          headers: {
            event_type: event.event_type,
            event_id: event.event_id,
            idempotency_key: event.idempotency_key,
            timestamp: event.timestamp
          }
        }
      ]
    });
  }

  async shutdown(): Promise<void> {
    if (this.producer && this.isConnected) {
      await this.producer.disconnect();
      this.producer = null;
      this.kafka = null;
      this.isConnected = false;
    }
  }
}

export const financeEventsProducer = FinanceEventsProducer.getInstance();

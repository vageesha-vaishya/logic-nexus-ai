import type { EventEnvelope, NotificationChannel, PaymentGatewayProvider } from '../../domain/types';
import type { EventBusPort, NotificationPort, PaymentGatewayPort } from '../ports';

export interface EventAndIntegrationServiceDependencies {
  eventBus: EventBusPort;
  paymentGateways: PaymentGatewayPort[];
  notifier: NotificationPort;
}

export class EventAndIntegrationService {
  constructor(private readonly deps: EventAndIntegrationServiceDependencies) {}

  async publishDomainEvent<TPayload>(event: EventEnvelope<TPayload>): Promise<void> {
    await this.deps.eventBus.publish(event);
  }

  async chargeWithProvider(input: {
    provider: PaymentGatewayProvider;
    paymentMethodReference: string;
    amount: number;
    currency: string;
    idempotencyKey: string;
  }): Promise<{ paymentId: string; status: string; token: string }> {
    const gateway = this.deps.paymentGateways.find((candidate) => candidate.provider === input.provider);
    if (!gateway) {
      throw new Error(`Unsupported payment provider: ${input.provider}`);
    }

    const tokenized = await gateway.tokenize(input.paymentMethodReference);
    const charged = await gateway.charge({
      token: tokenized.token,
      amount: input.amount,
      currency: input.currency,
      idempotencyKey: input.idempotencyKey,
    });

    return { paymentId: charged.id, status: charged.status, token: tokenized.token };
  }

  async notify(channel: NotificationChannel, payload: Record<string, unknown>): Promise<{ messageId: string }> {
    return this.deps.notifier.send(channel, payload);
  }
}

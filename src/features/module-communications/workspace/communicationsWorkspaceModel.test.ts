import { describe, expect, it } from 'vitest';
import {
  buildDeliveryStateCounts,
  canAcceptSendAction,
  getFallbackOutcomeLabel,
  isRecipientPreferenceSatisfied,
  isSandboxedTemplatePreview,
  type CommunicationsMessageTrace,
} from './communicationsWorkspaceModel';

describe('communicationsWorkspaceModel', () => {
  it('enforces recipient preference checks before send actions', () => {
    expect(isRecipientPreferenceSatisfied(true, false)).toBe(true);
    expect(isRecipientPreferenceSatisfied(false, false)).toBe(false);
    expect(isRecipientPreferenceSatisfied(true, true)).toBe(false);
    expect(canAcceptSendAction(true)).toBe(true);
    expect(canAcceptSendAction(false)).toBe(false);
  });

  it('builds delivery status visualization counts for all lifecycle states', () => {
    const messages: CommunicationsMessageTrace[] = [
      {
        id: 'a',
        subject: 'A',
        channel: 'email',
        deliveryState: 'queued',
        correlationId: 'corr-1',
        fallbackChannel: null,
        retryOutcome: 'none',
        recipientPreferenceSatisfied: true,
        providerAdapter: 'adapter-a',
      },
      {
        id: 'b',
        subject: 'B',
        channel: 'chat',
        deliveryState: 'dead_letter',
        correlationId: 'corr-2',
        fallbackChannel: 'email',
        retryOutcome: 'terminal',
        recipientPreferenceSatisfied: true,
        providerAdapter: 'adapter-b',
      },
    ];
    const counts = buildDeliveryStateCounts(messages);
    expect(counts.queued).toBe(1);
    expect(counts.dead_letter).toBe(1);
    expect(counts.delivered).toBe(0);
  });

  it('exposes fallback outcomes with correlation-safe messaging', () => {
    const recoveredMessage: CommunicationsMessageTrace = {
      id: 'c',
      subject: 'C',
      channel: 'sms',
      deliveryState: 'failed',
      correlationId: 'corr-3',
      fallbackChannel: 'email',
      retryOutcome: 'recovered',
      recipientPreferenceSatisfied: true,
      providerAdapter: 'adapter-c',
    };
    const terminalMessage: CommunicationsMessageTrace = {
      ...recoveredMessage,
      retryOutcome: 'terminal',
    };
    expect(getFallbackOutcomeLabel(recoveredMessage)).toContain('Recovered via email');
    expect(getFallbackOutcomeLabel(terminalMessage)).toContain('Terminal after fallback email');
  });

  it('validates sandboxed template preview boundaries', () => {
    expect(isSandboxedTemplatePreview('<sandbox-preview><p>ok</p></sandbox-preview>')).toBe(true);
    expect(isSandboxedTemplatePreview('<p>inline-preview</p>')).toBe(false);
  });
});

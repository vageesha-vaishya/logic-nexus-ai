export type CommunicationsDeliveryState = 'queued' | 'sent' | 'delivered' | 'failed' | 'dead_letter';

export type CommunicationsChannel = 'email' | 'chat' | 'webhook' | 'sms';

export type CommunicationsMessageTrace = {
  id: string;
  subject: string;
  channel: CommunicationsChannel;
  deliveryState: CommunicationsDeliveryState;
  correlationId: string;
  fallbackChannel: CommunicationsChannel | null;
  retryOutcome: 'none' | 'retrying' | 'recovered' | 'terminal';
  recipientPreferenceSatisfied: boolean;
  providerAdapter: string;
};

export type CommunicationsTemplate = {
  id: string;
  name: string;
  channel: CommunicationsChannel;
  locale: string;
  version: string;
  sandboxPreviewHtml: string;
};

export type CommunicationsCampaignQueueItem = {
  id: string;
  campaignName: string;
  queuedRecipients: number;
  scheduledAt: string;
  status: 'draft' | 'queued' | 'processing' | 'completed';
};

export type CommunicationsThread = {
  id: string;
  participant: string;
  channel: CommunicationsChannel;
  lastMessageAt: string;
  unreadCount: number;
};

export function isRecipientPreferenceSatisfied(isOptedIn: boolean, isSuppressed: boolean): boolean {
  return isOptedIn && !isSuppressed;
}

export function canAcceptSendAction(recipientPreferenceSatisfied: boolean): boolean {
  return recipientPreferenceSatisfied;
}

export function buildDeliveryStateCounts(messages: CommunicationsMessageTrace[]) {
  return messages.reduce(
    (accumulator, message) => {
      accumulator[message.deliveryState] += 1;
      return accumulator;
    },
    {
      queued: 0,
      sent: 0,
      delivered: 0,
      failed: 0,
      dead_letter: 0,
    } as Record<CommunicationsDeliveryState, number>
  );
}

export function getFallbackOutcomeLabel(message: CommunicationsMessageTrace): string {
  if (!message.fallbackChannel) return 'Primary channel only';
  if (message.retryOutcome === 'recovered') return `Recovered via ${message.fallbackChannel}`;
  if (message.retryOutcome === 'terminal') return `Terminal after fallback ${message.fallbackChannel}`;
  return `Fallback ${message.fallbackChannel} ${message.retryOutcome}`;
}

export function isSandboxedTemplatePreview(preview: string): boolean {
  return preview.startsWith('<sandbox-preview');
}

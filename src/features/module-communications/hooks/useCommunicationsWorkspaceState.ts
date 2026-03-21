import { useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type {
  CommunicationsCampaignQueueItem,
  CommunicationsChannel,
  CommunicationsMessageTrace,
  CommunicationsTemplate,
  CommunicationsThread,
} from '../workspace/communicationsWorkspaceModel';
import {
  buildDeliveryStateCounts,
  canAcceptSendAction,
  getFallbackOutcomeLabel,
  isRecipientPreferenceSatisfied,
  isSandboxedTemplatePreview,
} from '../workspace/communicationsWorkspaceModel';

const initialMessages: CommunicationsMessageTrace[] = [
  {
    id: 'msg-1',
    subject: 'Shipment Milestone Notification',
    channel: 'email',
    deliveryState: 'queued',
    correlationId: 'corr-cm-001',
    fallbackChannel: 'chat',
    retryOutcome: 'retrying',
    recipientPreferenceSatisfied: true,
    providerAdapter: 'sendgrid-primary',
  },
  {
    id: 'msg-2',
    subject: 'Compliance Escalation Notice',
    channel: 'chat',
    deliveryState: 'delivered',
    correlationId: 'corr-cm-002',
    fallbackChannel: null,
    retryOutcome: 'none',
    recipientPreferenceSatisfied: true,
    providerAdapter: 'teams-adapter',
  },
  {
    id: 'msg-3',
    subject: 'Invoice Overdue Reminder',
    channel: 'sms',
    deliveryState: 'failed',
    correlationId: 'corr-cm-003',
    fallbackChannel: 'email',
    retryOutcome: 'terminal',
    recipientPreferenceSatisfied: false,
    providerAdapter: 'twilio-sms',
  },
  {
    id: 'msg-4',
    subject: 'Quote Acceptance Confirmation',
    channel: 'webhook',
    deliveryState: 'dead_letter',
    correlationId: 'corr-cm-004',
    fallbackChannel: 'email',
    retryOutcome: 'terminal',
    recipientPreferenceSatisfied: true,
    providerAdapter: 'webhook-dispatcher',
  },
  {
    id: 'msg-5',
    subject: 'Booking Confirmation',
    channel: 'email',
    deliveryState: 'sent',
    correlationId: 'corr-cm-005',
    fallbackChannel: null,
    retryOutcome: 'none',
    recipientPreferenceSatisfied: true,
    providerAdapter: 'sendgrid-primary',
  },
];

const initialTemplates: CommunicationsTemplate[] = [
  {
    id: 'tpl-1',
    name: 'Shipment Update',
    channel: 'email',
    locale: 'en-US',
    version: '3.4',
    sandboxPreviewHtml: '<sandbox-preview><h1>Shipment update</h1></sandbox-preview>',
  },
  {
    id: 'tpl-2',
    name: 'Compliance Escalation',
    channel: 'chat',
    locale: 'en-US',
    version: '2.1',
    sandboxPreviewHtml: '<sandbox-preview><p>Escalation message</p></sandbox-preview>',
  },
];

const initialCampaignQueue: CommunicationsCampaignQueueItem[] = [
  {
    id: 'cmpq-1',
    campaignName: 'Q2 Receivables Reminder',
    queuedRecipients: 184,
    scheduledAt: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
    status: 'queued',
  },
  {
    id: 'cmpq-2',
    campaignName: 'Port Delay Advisory',
    queuedRecipients: 76,
    scheduledAt: new Date(Date.now() + 1000 * 60 * 85).toISOString(),
    status: 'processing',
  },
];

const initialThreads: CommunicationsThread[] = [
  {
    id: 'thr-1',
    participant: 'Acme Imports',
    channel: 'chat',
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    unreadCount: 2,
  },
  {
    id: 'thr-2',
    participant: 'Northwind Trading',
    channel: 'email',
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 43).toISOString(),
    unreadCount: 0,
  },
];

export function useCommunicationsWorkspaceState() {
  const { hasPermission, isPlatformAdmin, hasRole } = useAuth();
  const [messages, setMessages] = useState<CommunicationsMessageTrace[]>(initialMessages);
  const [selectedMessageId, setSelectedMessageId] = useState<string>(initialMessages[0]?.id ?? '');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(initialTemplates[0]?.id ?? '');
  const [recipientOptIn, setRecipientOptIn] = useState<boolean>(true);
  const [recipientSuppressed, setRecipientSuppressed] = useState<boolean>(false);
  const [requestedChannel, setRequestedChannel] = useState<CommunicationsChannel>('email');
  const [threads] = useState<CommunicationsThread[]>(initialThreads);
  const [templates] = useState<CommunicationsTemplate[]>(initialTemplates);
  const [campaignQueue] = useState<CommunicationsCampaignQueueItem[]>(initialCampaignQueue);

  const selectedMessage = useMemo(
    () => messages.find((item) => item.id === selectedMessageId) ?? messages[0] ?? null,
    [messages, selectedMessageId]
  );
  const selectedTemplate = useMemo(
    () => templates.find((item) => item.id === selectedTemplateId) ?? templates[0] ?? null,
    [templates, selectedTemplateId]
  );

  const isCommunicationsAuthorized = useMemo(() => {
    if (isPlatformAdmin()) return true;
    return hasPermission('email.manage') && (hasRole('platform_admin') || hasRole('tenant_admin'));
  }, [hasPermission, hasRole, isPlatformAdmin]);

  const recipientPreferenceSatisfied = useMemo(
    () => isRecipientPreferenceSatisfied(recipientOptIn, recipientSuppressed),
    [recipientOptIn, recipientSuppressed]
  );

  const canSubmitSendAction = useMemo(
    () => isCommunicationsAuthorized && canAcceptSendAction(recipientPreferenceSatisfied),
    [isCommunicationsAuthorized, recipientPreferenceSatisfied]
  );

  const deliveryStateCounts = useMemo(() => buildDeliveryStateCounts(messages), [messages]);

  const fallbackOutcomes = useMemo(
    () =>
      messages.map((message) => ({
        id: message.id,
        correlationId: message.correlationId,
        outcome: getFallbackOutcomeLabel(message),
      })),
    [messages]
  );

  const sandboxTemplatePreview = useMemo(
    () => ({
      template: selectedTemplate,
      isSandboxed: selectedTemplate ? isSandboxedTemplatePreview(selectedTemplate.sandboxPreviewHtml) : false,
    }),
    [selectedTemplate]
  );

  const submitSendRequest = () => {
    if (!canSubmitSendAction) return false;
    const now = new Date().toISOString();
    const nextMessage: CommunicationsMessageTrace = {
      id: `msg-${messages.length + 1}`,
      subject: 'Outbound API-triggered message',
      channel: requestedChannel,
      deliveryState: 'queued',
      correlationId: `corr-cm-${String(messages.length + 1).padStart(3, '0')}`,
      fallbackChannel: requestedChannel === 'email' ? 'chat' : 'email',
      retryOutcome: 'none',
      recipientPreferenceSatisfied: true,
      providerAdapter: `${requestedChannel}-adapter`,
    };
    setMessages((previous) => [nextMessage, ...previous]);
    setSelectedMessageId(nextMessage.id);
    return now;
  };

  return {
    messages,
    selectedMessage,
    selectedMessageId,
    setSelectedMessageId,
    templates,
    selectedTemplateId,
    setSelectedTemplateId,
    threads,
    campaignQueue,
    recipientOptIn,
    setRecipientOptIn,
    recipientSuppressed,
    setRecipientSuppressed,
    requestedChannel,
    setRequestedChannel,
    isCommunicationsAuthorized,
    recipientPreferenceSatisfied,
    canSubmitSendAction,
    deliveryStateCounts,
    fallbackOutcomes,
    sandboxTemplatePreview,
    submitSendRequest,
  };
}

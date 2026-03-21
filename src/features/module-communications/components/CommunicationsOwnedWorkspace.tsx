import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { CommunicationsSendActionContract } from './CommunicationsSendActionContract';
import { useCommunicationsWorkspaceState } from '../hooks/useCommunicationsWorkspaceState';
import type { CommunicationsChannel } from '../workspace/communicationsWorkspaceModel';

const channelLabel: Record<CommunicationsChannel, string> = {
  email: 'Email',
  chat: 'Chat',
  webhook: 'Webhook',
  sms: 'SMS',
};

function deliveryBadgeVariant(status: 'queued' | 'sent' | 'delivered' | 'failed' | 'dead_letter') {
  if (status === 'delivered') return 'secondary';
  if (status === 'failed' || status === 'dead_letter') return 'destructive';
  return 'outline';
}

export function CommunicationsOwnedWorkspace() {
  const state = useCommunicationsWorkspaceState();

  return (
    <section className="space-y-4">
      <Card data-communications-owned-surface="message-orchestration-console">
        <CardHeader className="pb-2">
          <CardTitle>Message Orchestration Console</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label>Trace Message</Label>
              <Select value={state.selectedMessageId} onValueChange={state.setSelectedMessageId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select message trace" />
                </SelectTrigger>
                <SelectContent>
                  {state.messages.map((message) => (
                    <SelectItem key={message.id} value={message.id}>
                      {message.subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Provider Adapter</p>
              <p className="text-sm font-medium">{state.selectedMessage?.providerAdapter ?? 'N/A'}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Correlation Identifier</p>
              <p className="text-sm font-medium">{state.selectedMessage?.correlationId ?? 'N/A'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={deliveryBadgeVariant(state.selectedMessage?.deliveryState ?? 'queued')}>
              {(state.selectedMessage?.deliveryState ?? 'queued').replace('_', ' ')}
            </Badge>
            <Badge variant="outline">{state.isCommunicationsAuthorized ? 'Communications Authorized' : 'Authorization Required'}</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card data-communications-owned-surface="template-manager">
          <CardHeader className="pb-2">
            <CardTitle>Template Manager</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Template</Label>
              <Select value={state.selectedTemplateId} onValueChange={state.setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {state.templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name} v{template.version}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>Channel: {state.sandboxTemplatePreview.template ? channelLabel[state.sandboxTemplatePreview.template.channel] : 'N/A'}</div>
              <div>Locale: {state.sandboxTemplatePreview.template?.locale ?? 'N/A'}</div>
            </div>
            <div className="rounded-md border p-2" data-communications-boundary="sandboxed-template-preview">
              <p className="mb-2 text-xs text-muted-foreground">
                {state.sandboxTemplatePreview.isSandboxed ? 'Sandboxed preview active' : 'Sandbox preview invalid'}
              </p>
              <iframe
                title="Template Preview Sandbox"
                srcDoc={state.sandboxTemplatePreview.template?.sandboxPreviewHtml ?? ''}
                sandbox="allow-same-origin"
                className="h-24 w-full rounded border"
              />
            </div>
          </CardContent>
        </Card>

        <Card data-communications-owned-surface="channel-health-dashboard">
          <CardHeader className="pb-2">
            <CardTitle>Channel Health Dashboard</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border p-2 text-sm">Queued: {state.deliveryStateCounts.queued}</div>
              <div className="rounded-md border p-2 text-sm">Sent: {state.deliveryStateCounts.sent}</div>
              <div className="rounded-md border p-2 text-sm">Delivered: {state.deliveryStateCounts.delivered}</div>
              <div className="rounded-md border p-2 text-sm">Failed: {state.deliveryStateCounts.failed}</div>
              <div className="rounded-md border p-2 text-sm">Dead Letter: {state.deliveryStateCounts.dead_letter}</div>
            </div>
            <p className="text-xs text-muted-foreground">Delivery status visualization separates queued, sent, delivered, failed, and dead-letter outcomes.</p>
          </CardContent>
        </Card>
      </div>

      <Card data-communications-owned-surface="delivery-trace-views">
        <CardHeader className="pb-2">
          <CardTitle>Delivery Trace Views</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {state.fallbackOutcomes.map((outcome) => (
            <div key={outcome.id} className="flex items-center justify-between rounded-md border p-2" data-correlation-id={outcome.correlationId}>
              <p className="text-sm">{outcome.outcome}</p>
              <Badge variant="outline">{outcome.correlationId}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card data-communications-owned-surface="conversation-threads">
          <CardHeader className="pb-2">
            <CardTitle>Conversation Threads</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {state.threads.map((thread) => (
              <div key={thread.id} className="flex items-center justify-between rounded-md border p-2">
                <div>
                  <p className="text-sm font-medium">{thread.participant}</p>
                  <p className="text-xs text-muted-foreground">{channelLabel[thread.channel]}</p>
                </div>
                <Badge variant={thread.unreadCount > 0 ? 'outline' : 'secondary'}>{thread.unreadCount} unread</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card data-communications-owned-surface="outbound-campaign-queues">
          <CardHeader className="pb-2">
            <CardTitle>Outbound Campaign Queues</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {state.campaignQueue.map((campaign) => (
              <div key={campaign.id} className="rounded-md border p-2">
                <p className="text-sm font-medium">{campaign.campaignName}</p>
                <p className="text-xs text-muted-foreground">
                  {campaign.queuedRecipients} recipients · {campaign.status}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card data-communications-boundary="provider-controls-owned">
        <CardHeader className="pb-2">
          <CardTitle>Provider Diagnostics Boundary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label>Requested Channel</Label>
              <Select value={state.requestedChannel} onValueChange={(value) => state.setRequestedChannel(value as CommunicationsChannel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="chat">Chat</SelectItem>
                  <SelectItem value="webhook">Webhook</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="recipient-optin">Recipient Opt-in</Label>
              <Switch id="recipient-optin" checked={state.recipientOptIn} onCheckedChange={state.setRecipientOptIn} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="recipient-suppressed">Suppressed Recipient</Label>
              <Switch id="recipient-suppressed" checked={state.recipientSuppressed} onCheckedChange={state.setRecipientSuppressed} />
            </div>
          </div>
          <div className="flex items-center gap-2" data-communications-boundary="recipient-preferences-enforced">
            <Button onClick={state.submitSendRequest} disabled={!state.canSubmitSendAction}>
              Submit Send Action
            </Button>
            <Badge variant={state.recipientPreferenceSatisfied ? 'secondary' : 'destructive'}>
              {state.recipientPreferenceSatisfied ? 'Recipient Preferences Satisfied' : 'Recipient Preference Blocked'}
            </Badge>
          </div>
          <CommunicationsSendActionContract
            enabled={state.canSubmitSendAction}
            summary="Other verticals can trigger sends through action APIs but cannot render provider controls."
          />
        </CardContent>
      </Card>
      <Separator />
    </section>
  );
}

import { Badge } from '@/components/ui/badge';
import { Flame, Frown, Meh, RefreshCw, Shield, ShieldAlert, ShieldCheck, Smile } from 'lucide-react';

import type { Email } from './types';

export function SecurityBadge({ email }: { email: Email }) {
  const status = email.security_status;
  if (!status || status === 'pending') return null;
  if (status === 'clean')
    return (
      <Badge variant="outline" className="text-[10px] h-4 px-1 border-green-500 text-green-600 bg-green-50">
        <ShieldCheck className="h-3 w-3 mr-1" />
        Clean
      </Badge>
    );
  if (status === 'suspicious')
    return (
      <Badge variant="outline" className="text-[10px] h-4 px-1 border-orange-500 text-orange-600 bg-orange-50">
        <Shield className="h-3 w-3 mr-1" />
        Suspicious
      </Badge>
    );
  if (status === 'malicious')
    return (
      <Badge variant="outline" className="text-[10px] h-4 px-1 border-red-500 text-red-600 bg-red-50">
        <ShieldAlert className="h-3 w-3 mr-1" />
        Malicious
      </Badge>
    );
  if (status === 'scanning')
    return (
      <Badge variant="outline" className="text-[10px] h-4 px-1 border-blue-500 text-blue-600 bg-blue-50">
        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
        Scanning
      </Badge>
    );
  return null;
}

export function UrgencyBadge({ urgency }: { urgency?: string }) {
  if (!urgency || urgency === 'low') return null;
  const cls =
    urgency === 'high'
      ? 'border-red-500 text-red-600 bg-red-50'
      : urgency === 'medium'
      ? 'border-orange-500 text-orange-600 bg-orange-50'
      : '';
  return (
    <Badge variant="outline" className={`text-[10px] h-4 px-1 ${cls}`}>
      <Flame className="h-3 w-3 mr-1" />
      {urgency.charAt(0).toUpperCase() + urgency.slice(1)}
    </Badge>
  );
}

export function SentimentBadge({ sentiment }: { sentiment?: string }) {
  if (!sentiment) return null;
  const cls =
    sentiment === 'positive'
      ? 'border-green-500 text-green-600 bg-green-50'
      : sentiment === 'negative'
      ? 'border-red-500 text-red-600 bg-red-50'
      : 'border-border text-muted-foreground bg-muted/30';
  const Icon = sentiment === 'positive' ? Smile : sentiment === 'negative' ? Frown : Meh;
  return (
    <Badge variant="outline" className={`text-[10px] h-4 px-1 ${cls}`}>
      <Icon className="h-3 w-3 mr-1" />
      {sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}
    </Badge>
  );
}

export function DuplicateLeadBadge() {
  return (
    <Badge variant="outline" className="text-[10px] h-4 px-1 border-amber-500 text-amber-700 bg-amber-50">
      Duplicate Lead
    </Badge>
  );
}

export function clampText(text: string, maxChars: number): string {
  const t = text || '';
  if (t.length <= maxChars) return t;
  return t.slice(0, Math.max(0, maxChars - 1)) + '…';
}

export function getPriorityColorClass(p?: string): string {
  switch ((p || 'normal').toLowerCase()) {
    case 'red':
      return 'text-red-500';
    case 'yellow':
      return 'text-yellow-500';
    case 'green':
      return 'text-green-500';
    case 'brown':
      return 'text-amber-700';
    default:
      return 'text-muted-foreground';
  }
}

import { Badge } from '@/components/ui/badge';

interface CRMAuditEventBadgeProps {
  action: string;
  size?: 'sm' | 'md' | 'lg';
}

const ACTION_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  create: { bg: 'bg-green-100', text: 'text-green-800', label: 'Created' },
  update: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Updated' },
  delete: { bg: 'bg-red-100', text: 'text-red-800', label: 'Deleted' },
  move: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Moved' },
  approve: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Approved' },
  reject: { bg: 'bg-pink-100', text: 'text-pink-800', label: 'Rejected' },
  view: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Viewed' }
};

export function CRMAuditEventBadge({ action, size = 'md' }: CRMAuditEventBadgeProps) {
  const config = ACTION_COLORS[action.toLowerCase()] || ACTION_COLORS.update;

  const sizeClass = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1'
  }[size];

  return (
    <Badge className={`${config.bg} ${config.text} ${sizeClass}`}>
      {config.label}
    </Badge>
  );
}

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Check } from 'lucide-react';
import { useVersionStatus } from '@/hooks/useVersionStatus';

type VersionStatus = 'draft' | 'sent' | 'internal_review' | 'accepted' | 'rejected' | 'expired' | 'cancelled';

interface VersionStatusSelectorProps {
  versionId: string;
  currentStatus: VersionStatus;
  onStatusChange?: () => void;
}

const statusLabels: Record<VersionStatus, string> = {
  draft: 'Draft',
  sent: 'Sent to Customer',
  internal_review: 'Internal Review',
  accepted: 'Accepted',
  rejected: 'Rejected',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

const statusColors: Record<VersionStatus, string> = {
  draft: 'bg-secondary text-secondary-foreground',
  sent: 'bg-blue-500 text-white',
  internal_review: 'bg-yellow-500 text-white',
  accepted: 'bg-green-500 text-white',
  rejected: 'bg-red-500 text-white',
  expired: 'bg-gray-500 text-white',
  cancelled: 'bg-gray-700 text-white',
};

export function VersionStatusSelector({
  versionId,
  currentStatus,
  onStatusChange,
}: VersionStatusSelectorProps) {
  const { getAvailableTransitions, updateVersionStatus, isUpdating } = useVersionStatus();
  const availableTransitions = getAvailableTransitions(currentStatus);

  const handleStatusChange = async (newStatus: VersionStatus) => {
    const success = await updateVersionStatus(versionId, newStatus);
    if (success && onStatusChange) {
      onStatusChange();
    }
  };

  // If no transitions available, just show the badge
  if (availableTransitions.length === 0) {
    return (
      <Badge className={statusColors[currentStatus]}>
        {statusLabels[currentStatus]}
      </Badge>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={isUpdating}
        >
          <Badge className={statusColors[currentStatus]}>
            {statusLabels[currentStatus]}
          </Badge>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {availableTransitions.map((status) => (
          <DropdownMenuItem
            key={status}
            onClick={() => handleStatusChange(status)}
          >
            <span className="flex items-center justify-between w-full">
              {statusLabels[status]}
              {status === currentStatus && <Check className="h-4 w-4 ml-2" />}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FolderInput, Loader2, List } from 'lucide-react';
import { useQueueManagement } from '@/hooks/useQueueManagement';

interface QueueEmailAssignerProps {
  emailId: string;
  currentQueue?: string | null;
  onAssigned?: () => void;
  variant?: 'button' | 'icon';
}

export function QueueEmailAssigner({
  emailId,
  currentQueue,
  onAssigned,
  variant = 'button',
}: QueueEmailAssignerProps) {
  const { queues, loading, assignEmailToQueue } = useQueueManagement();
  const [assigning, setAssigning] = useState(false);

  const handleAssign = async (queueName: string) => {
    setAssigning(true);
    const success = await assignEmailToQueue(emailId, queueName);
    setAssigning(false);
    if (success && onAssigned) {
      onAssigned();
    }
  };

  if (loading) {
    return (
      <Button variant="ghost" size="sm" disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === 'button' ? (
          <Button variant="outline" size="sm" disabled={assigning}>
            {assigning ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <FolderInput className="h-4 w-4 mr-2" />
            )}
            {currentQueue ? `Queue: ${currentQueue}` : 'Assign to Queue'}
          </Button>
        ) : (
          <Button variant="ghost" size="icon" disabled={assigning} className="h-8 w-8">
            {assigning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <List className="h-4 w-4" />
            )}
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Assign to Queue</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {queues.length === 0 ? (
          <DropdownMenuItem disabled>
            No queues available
          </DropdownMenuItem>
        ) : (
          queues.map((queue) => (
            <DropdownMenuItem
              key={queue.queue_id}
              onClick={() => handleAssign(queue.queue_name)}
              className={currentQueue === queue.queue_name ? 'bg-accent' : ''}
            >
              <div className="flex items-center justify-between w-full">
                <span>{queue.queue_name}</span>
                <span className="text-xs text-muted-foreground">
                  {queue.email_count} emails
                </span>
              </div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

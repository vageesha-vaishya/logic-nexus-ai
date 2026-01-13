import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, RefreshCw, Inbox, Mail, Star, Paperclip } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueueManagement } from '@/hooks/useQueueManagement';
import { QueueEmailAssigner } from './QueueEmailAssigner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface QueueEmail {
  id: string;
  subject: string;
  from_email: string;
  from_name: string | null;
  snippet: string | null;
  received_at: string;
  is_read: boolean;
  is_starred: boolean;
  has_attachments: boolean;
  queue: string | null;
  priority: string | null;
  ai_category: string | null;
  ai_sentiment: string | null;
}

interface QueueEmailListProps {
  onSelectEmail?: (email: QueueEmail) => void;
  selectedEmailId?: string | null;
}

export function QueueEmailList({ onSelectEmail, selectedEmailId }: QueueEmailListProps) {
  const [emails, setEmails] = useState<QueueEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQueue, setSelectedQueue] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { queues, fetchQueues } = useQueueManagement();
  const { toast } = useToast();

  const fetchQueueEmails = useCallback(async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('emails')
        .select('id, subject, from_email, from_name, snippet, received_at, is_read, is_starred, has_attachments, queue, priority, ai_category, ai_sentiment')
        .not('queue', 'is', null)
        .order('received_at', { ascending: false })
        .limit(100);

      if (selectedQueue !== 'all') {
        query = query.eq('queue', selectedQueue);
      }

      if (searchQuery) {
        query = query.or(`subject.ilike.%${searchQuery}%,from_email.ilike.%${searchQuery}%,snippet.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      setEmails((data as QueueEmail[]) || []);
    } catch (error: any) {
      console.error('Error fetching queue emails:', error);
      toast({
        title: 'Error',
        description: 'Failed to load queue emails',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [selectedQueue, searchQuery, toast]);

  useEffect(() => {
    fetchQueueEmails();
  }, [fetchQueueEmails]);

  const handleRefresh = () => {
    fetchQueueEmails();
    fetchQueues();
  };

  const handleEmailAssigned = () => {
    fetchQueueEmails();
    fetchQueues();
  };

  return (
    <Card className="h-full flex flex-col">
      <div className="p-4 border-b space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Inbox className="h-5 w-5" />
            Queue Emails
          </h3>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>
        
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search queue emails..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={selectedQueue} onValueChange={setSelectedQueue}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select queue" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Queues</SelectItem>
              {queues.map((q) => (
                <SelectItem key={q.queue_id} value={q.queue_name}>
                  {q.queue_name} ({q.email_count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
              Loading...
            </div>
          ) : emails.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No emails in this queue</p>
            </div>
          ) : (
            <div className="divide-y">
              {emails.map((email) => (
                <button
                  key={email.id}
                  className={cn(
                    'w-full flex flex-col gap-1 p-4 text-left hover:bg-muted/50 transition-colors',
                    selectedEmailId === email.id && 'bg-muted',
                    !email.is_read && 'bg-primary/5'
                  )}
                  onClick={() => onSelectEmail?.(email)}
                >
                  <div className="flex items-center justify-between w-full gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className={cn('font-medium text-sm truncate', !email.is_read && 'font-bold')}>
                        {email.from_name || email.from_email}
                      </span>
                      {email.queue && (
                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 shrink-0">
                          {email.queue}
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(email.received_at), 'MMM d, h:mm a')}
                    </span>
                  </div>
                  
                  <div className={cn('text-sm truncate', !email.is_read && 'font-semibold')}>
                    {email.subject || '(No Subject)'}
                  </div>
                  
                  <div className="text-xs text-muted-foreground line-clamp-1">
                    {email.snippet}
                  </div>
                  
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center gap-2">
                      {email.has_attachments && <Paperclip className="h-3 w-3 text-muted-foreground" />}
                      {email.is_starred && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                      {email.ai_category && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1">
                          {email.ai_category}
                        </Badge>
                      )}
                      {email.ai_sentiment && (
                        <Badge 
                          variant="outline" 
                          className={cn(
                            'text-[10px] h-4 px-1',
                            email.ai_sentiment === 'negative' && 'border-orange-500 text-orange-500',
                            email.ai_sentiment === 'very_negative' && 'border-red-500 text-red-500',
                            email.ai_sentiment === 'positive' && 'border-green-500 text-green-500'
                          )}
                        >
                          {email.ai_sentiment}
                        </Badge>
                      )}
                    </div>
                    <QueueEmailAssigner
                      emailId={email.id}
                      currentQueue={email.queue}
                      onAssigned={handleEmailAssigned}
                      variant="icon"
                    />
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

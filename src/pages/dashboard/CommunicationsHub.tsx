import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Mail, MessageSquare, Globe, Phone, Twitter, Linkedin, Send } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Channel = 'all' | 'email' | 'whatsapp' | 'x' | 'telegram' | 'linkedin' | 'web';

interface Message {
  id: string;
  tenant_id: string;
  channel: string;
  direction: string;
  subject: string | null;
  body_text: string;
  queue: string | null;
  is_read: boolean;
  is_starred: boolean;
  has_attachments: boolean;
  created_at: string;
  ai_sentiment?: string | null;
  ai_intent?: string | null;
  ai_urgency?: string | null;
}

export default function CommunicationsHub() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [channel, setChannel] = useState<Channel>('all');
  const [queues, setQueues] = useState<string[]>([]);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const { toast } = useToast();
  const { roles } = useAuth();

  const tenantId = useMemo(() => {
    const admin = roles.find(r => r.role === 'tenant_admin' && r.tenant_id);
    return admin?.tenant_id || roles.find(r => r.tenant_id)?.tenant_id || null;
  }, [roles]);

  const fetchQueues = async () => {
    try {
      if (!tenantId) return;
      const { data, error } = await (supabase as any)
        .from('queues')
        .select('name')
        .eq('tenant_id', tenantId)
        .order('name', { ascending: true });
      if (error) throw error;
      setQueues((data || []).map((q: any) => q.name));
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const fetchMessages = async () => {
    try {
      setLoading(true);
      let query = (supabase as any).from('messages').select('*').order('created_at', { ascending: false }).limit(100);
      if (channel !== 'all') query = query.eq('channel', channel);
      if (search) {
        query = query.or(`subject.ilike.%${search}%,body_text.ilike.%${search}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      setMessages(data || []);
    } catch (e: any) {
      toast({ title: 'Error fetching messages', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const assignToQueue = async (messageId: string, queueName: string) => {
    try {
      setAssigningId(messageId);
      const { error } = await (supabase as any)
        .from('messages')
        .update({ queue: queueName })
        .eq('id', messageId);
      if (error) throw error;
      toast({ title: 'Assigned', description: `Moved to ${queueName}` });
      fetchMessages();
    } catch (e: any) {
      toast({ title: 'Error assigning', description: e.message, variant: 'destructive' });
    } finally {
      setAssigningId(null);
    }
  };

  useEffect(() => {
    fetchQueues();
  }, [tenantId]);

  useEffect(() => {
    fetchMessages();
  }, [channel]);

  const renderChannelBadge = (c: string) => {
    if (c === 'email') return <Badge><Mail className="h-3 w-3 mr-1" />Email</Badge>;
    if (c === 'web') return <Badge><Globe className="h-3 w-3 mr-1" />Web</Badge>;
    if (c === 'whatsapp') return <Badge><Phone className="h-3 w-3 mr-1" />WhatsApp</Badge>;
    if (c === 'x') return <Badge><Twitter className="h-3 w-3 mr-1" />X</Badge>;
    if (c === 'linkedin') return <Badge><Linkedin className="h-3 w-3 mr-1" />LinkedIn</Badge>;
    if (c === 'telegram') return <Badge><Send className="h-3 w-3 mr-1" />Telegram</Badge>;
    return <Badge><MessageSquare className="h-3 w-3 mr-1" />{c}</Badge>;
  };

  return (
    <DashboardLayout>
      <Card>
        <CardHeader>
          <CardTitle>Inbox</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <Input placeholder="Search subject/body" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Button onClick={fetchMessages} disabled={loading}>{loading ? 'Loading' : 'Search'}</Button>
            <Tabs value={channel} onValueChange={(v) => setChannel(v as Channel)}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="email">Email</TabsTrigger>
                <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
                <TabsTrigger value="x">X</TabsTrigger>
                <TabsTrigger value="telegram">Telegram</TabsTrigger>
                <TabsTrigger value="linkedin">LinkedIn</TabsTrigger>
                <TabsTrigger value="web">Web</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="space-y-2">
            {messages.map((m) => (
              <div key={m.id} className="flex items-center justify-between border rounded p-3">
                <div className="flex items-center gap-3">
                  {renderChannelBadge(m.channel)}
                  <div className="max-w-xl">
                    <div className="font-medium">{m.subject || '(no subject)'}</div>
                    <div className="text-sm text-muted-foreground line-clamp-1">{m.body_text}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{m.queue || 'Unassigned'}</Badge>
                  <Select onValueChange={(q) => assignToQueue(m.id, q)}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Move to queue" />
                    </SelectTrigger>
                    <SelectContent>
                      {queues.map((q) => (
                        <SelectItem key={q} value={q}>{q}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="secondary" disabled={assigningId === m.id} onClick={() => setSelectedMessage(m)}>
                    {assigningId === m.id ? 'Assigning' : 'Open'}
                  </Button>
                </div>
              </div>
            ))}
            {messages.length === 0 && !loading && (
              <div className="text-sm text-muted-foreground">No messages</div>
            )}
          </div>
        </CardContent>
      </Card>
      <Dialog open={!!selectedMessage} onOpenChange={(o) => !o && setSelectedMessage(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Message Detail</DialogTitle>
          </DialogHeader>
          {selectedMessage && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {renderChannelBadge(selectedMessage.channel)}
                <Badge variant="outline">{selectedMessage.queue || 'Unassigned'}</Badge>
                <span className="text-xs text-muted-foreground">{new Date(selectedMessage.created_at).toLocaleString()}</span>
              </div>
              <div className="font-medium">{selectedMessage.subject || '(no subject)'}</div>
              <div className="text-sm whitespace-pre-wrap">{selectedMessage.body_text}</div>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-xs">Sentiment: {selectedMessage.ai_sentiment || 'n/a'}</div>
                <div className="text-xs">Intent: {selectedMessage.ai_intent || 'n/a'}</div>
                <div className="text-xs">Urgency: {selectedMessage.ai_urgency || 'n/a'}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Users, Edit, RefreshCw } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';

interface Queue {
  id: string;
  name: string;
  description: string;
  email: string;
  type: 'holding' | 'round_robin';
  is_active: boolean;
  member_count?: number;
}

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export default function QueueManagement() {
  const { supabase, context } = useCRM();
  const [queues, setQueues] = useState<Queue[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  
  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [selectedQueue, setSelectedQueue] = useState<Queue | null>(null);
  const [queueMembers, setQueueMembers] = useState<string[]>([]); // Array of user IDs

  const [newQueue, setNewQueue] = useState({
    name: '',
    description: '',
    email: '',
    type: 'holding' as 'holding' | 'round_robin',
    is_active: true,
  });

  useEffect(() => {
    fetchQueues();
    fetchUsers();
  }, []);

  const fetchQueues = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('queues')
        .select('*, queue_members(count)')
        .order('name');

      if (error) throw error;
      
      const formattedQueues = data?.map(q => ({
        ...q,
        type: q.type as 'holding' | 'round_robin',
        member_count: q.queue_members?.[0]?.count || 0
      })) || [];
      
      setQueues(formattedQueues as Queue[]);
    } catch (error: any) {
      // Check for missing table error (PGRST205)
      if (error?.code === 'PGRST205' || error?.message?.includes('relation "public.queues" does not exist')) {
        toast.error('System Update Required: Queues table not found. Please run database migrations.');
      } else {
        toast.error('Failed to load queues');
      }
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .order('first_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchQueueMembers = async (queueId: string) => {
    try {
      const { data, error } = await supabase
        .from('queue_members')
        .select('user_id')
        .eq('queue_id', queueId);

      if (error) throw error;
      setQueueMembers(data?.map(m => m.user_id) || []);
    } catch (error: any) {
      console.error('Error fetching members:', error);
    }
  };

  const handleCreateQueue = async () => {
    if (!newQueue.name) {
      toast.error('Queue name is required');
      return;
    }

    if (!context.tenantId) {
      toast.error('No tenant context available. Please ensure you have the correct role assigned.');
      return;
    }

    try {
      const { error } = await supabase
        .from('queues')
        .insert({
          ...newQueue,
          tenant_id: context.tenantId,
        });

      if (error) throw error;

      toast.success('Queue created successfully');
      setIsCreateOpen(false);
      setNewQueue({
        name: '',
        description: '',
        email: '',
        type: 'holding',
        is_active: true,
      });
      fetchQueues();
    } catch (error: any) {
      toast.error('Failed to create queue');
      console.error('Error:', error);
    }
  };

  const handleDeleteQueue = async (id: string) => {
    if (!confirm('Are you sure you want to delete this queue?')) return;

    try {
      const { error } = await supabase
        .from('queues')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Queue deleted');
      fetchQueues();
    } catch (error: any) {
      toast.error('Failed to delete queue');
    }
  };

  const openMembersDialog = async (queue: Queue) => {
    setSelectedQueue(queue);
    await fetchQueueMembers(queue.id);
    setIsMembersOpen(true);
  };

  const handleUpdateMembers = async () => {
    if (!selectedQueue) return;

    try {
      // 1. Delete existing members
      const { error: deleteError } = await supabase
        .from('queue_members')
        .delete()
        .eq('queue_id', selectedQueue.id);

      if (deleteError) throw deleteError;

      // 2. Insert new members
      if (queueMembers.length > 0) {
        const { error: insertError } = await supabase
          .from('queue_members')
          .insert(
            queueMembers.map(userId => ({
              queue_id: selectedQueue.id,
              user_id: userId
            }))
          );

        if (insertError) throw insertError;
      }

      toast.success('Queue members updated');
      setIsMembersOpen(false);
      fetchQueues(); // Refresh counts
    } catch (error: any) {
      toast.error('Failed to update members');
      console.error('Error:', error);
    }
  };

  const toggleMember = (userId: string) => {
    setQueueMembers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  if (!context.isPlatformAdmin && !context.isTenantAdmin) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">You don't have permission to access this page</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Queue Management</h1>
            <p className="text-muted-foreground">Manage lead assignment queues and round-robin groups</p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Queue
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {queues.map((queue) => (
            <Card key={queue.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg font-semibold">{queue.name}</CardTitle>
                  <Badge variant={queue.type === 'round_robin' ? 'default' : 'secondary'}>
                    {queue.type === 'round_robin' ? 'Round Robin' : 'Holding Queue'}
                  </Badge>
                </div>
                <CardDescription>{queue.description || 'No description'}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Users className="mr-2 h-4 w-4" />
                    {queue.member_count} Members
                  </div>
                  {queue.email && (
                    <div className="text-sm text-muted-foreground truncate">
                      Email: {queue.email}
                    </div>
                  )}
                  
                  <div className="flex justify-between pt-2">
                    <Button variant="outline" size="sm" onClick={() => openMembersDialog(queue)}>
                      <Users className="mr-2 h-4 w-4" />
                      Manage Members
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteQueue(queue.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Create Queue Dialog */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Queue</DialogTitle>
              <DialogDescription>Add a new queue for lead assignment</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Queue Name *</Label>
                <Input
                  id="name"
                  value={newQueue.name}
                  onChange={(e) => setNewQueue({ ...newQueue, name: e.target.value })}
                  placeholder="e.g. US Sales Team"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Queue Type</Label>
                <Select
                  value={newQueue.type}
                  onValueChange={(value: 'holding' | 'round_robin') => setNewQueue({ ...newQueue, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="holding">Holding Queue (Manual Pick)</SelectItem>
                    <SelectItem value="round_robin">Round Robin Group (Auto-Assign)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {newQueue.type === 'holding' 
                    ? 'Leads stay in the queue until manually assigned.' 
                    : 'Leads are automatically distributed to members.'}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={newQueue.description}
                  onChange={(e) => setNewQueue({ ...newQueue, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Queue Email</Label>
                <Input
                  id="email"
                  value={newQueue.email}
                  onChange={(e) => setNewQueue({ ...newQueue, email: e.target.value })}
                  placeholder="sales-us@example.com"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateQueue}>Create Queue</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Manage Members Dialog */}
        <Dialog open={isMembersOpen} onOpenChange={setIsMembersOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Manage Members - {selectedQueue?.name}</DialogTitle>
              <DialogDescription>Select users to include in this queue</DialogDescription>
            </DialogHeader>
            <div className="max-h-[300px] overflow-y-auto space-y-2 py-4 border rounded-md px-2">
              {users.map(user => (
                <div key={user.id} className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded">
                  <Switch
                    checked={queueMembers.includes(user.id)}
                    onCheckedChange={() => toggleMember(user.id)}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{user.first_name} {user.last_name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsMembersOpen(false)}>Cancel</Button>
              <Button onClick={handleUpdateMembers}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

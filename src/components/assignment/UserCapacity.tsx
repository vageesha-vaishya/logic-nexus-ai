import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Users, Edit } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface UserCapacityData {
  id: string;
  user_id: string;
  max_leads: number;
  current_leads: number;
  is_available: boolean;
  profiles: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

export function UserCapacity() {
  const { supabase, context } = useCRM();
  const [capacities, setCapacities] = useState<UserCapacityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCapacity, setSelectedCapacity] = useState<any>(null);
  const [maxLeads, setMaxLeads] = useState(50);

  useEffect(() => {
    fetchCapacities();
  }, []);

  const fetchCapacities = async () => {
    try {
      let query = supabase
        .from('user_capacity')
        .select('*');

      if (context.tenantId) query = query.eq('tenant_id', context.tenantId);

      const { data: capacityData, error } = await query;
      if (error) throw error;

      // Fetch profiles separately
      if (capacityData && capacityData.length > 0) {
        const userIds = capacityData.map(c => c.user_id);
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .in('id', userIds);

        const profilesMap = new Map(profilesData?.map(p => [p.id, p]));
        
        const enrichedData = capacityData.map(capacity => ({
          ...capacity,
          profiles: profilesMap.get(capacity.user_id) || { first_name: '', last_name: '', email: '' }
        }));

        setCapacities(enrichedData as any);
      }
    } catch (error: any) {
      toast.error('Failed to load user capacities');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAvailability = async (capacityId: string, isAvailable: boolean) => {
    try {
      const { error } = await supabase
        .from('user_capacity')
        .update({ is_available: !isAvailable })
        .eq('id', capacityId);

      if (error) throw error;
      toast.success('Availability updated');
      fetchCapacities();
    } catch (error: any) {
      toast.error('Failed to update availability');
      console.error('Error:', error);
    }
  };

  const handleUpdateMaxLeads = async () => {
    if (!selectedCapacity) return;

    try {
      const { error } = await supabase
        .from('user_capacity')
        .update({ max_leads: maxLeads })
        .eq('id', selectedCapacity.id);

      if (error) throw error;
      toast.success('Capacity updated');
      setDialogOpen(false);
      fetchCapacities();
    } catch (error: any) {
      toast.error('Failed to update capacity');
      console.error('Error:', error);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading user capacities...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">User Capacity</h3>
        <p className="text-sm text-muted-foreground">
          Manage lead assignment capacity and availability for each user
        </p>
      </div>

      {capacities.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No user capacities configured. Capacities are created automatically when users are assigned leads.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {capacities.map((capacity) => {
            const utilizationPercent = (capacity.current_leads / capacity.max_leads) * 100;
            
            return (
              <Card key={capacity.id}>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        <div>
                          <h4 className="font-semibold">
                            {capacity.profiles.first_name} {capacity.profiles.last_name}
                          </h4>
                          <p className="text-xs text-muted-foreground">{capacity.profiles.email}</p>
                        </div>
                      </div>
                      <Badge variant={capacity.is_available ? 'default' : 'secondary'}>
                        {capacity.is_available ? 'Available' : 'Unavailable'}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Lead Capacity</span>
                        <span className="font-medium">
                          {capacity.current_leads} / {capacity.max_leads}
                        </span>
                      </div>
                      <Progress value={utilizationPercent} />
                    </div>

                    <div className="flex gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <Label className="text-xs">Available</Label>
                        <Switch
                          checked={capacity.is_available}
                          onCheckedChange={() =>
                            handleToggleAvailability(capacity.id, capacity.is_available)
                          }
                        />
                      </div>
                      <Dialog
                        open={dialogOpen && selectedCapacity?.id === capacity.id}
                        onOpenChange={(open) => {
                          setDialogOpen(open);
                          if (open) {
                            setSelectedCapacity(capacity);
                            setMaxLeads(capacity.max_leads);
                          }
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Update Capacity</DialogTitle>
                            <DialogDescription>
                              Set maximum lead capacity for {capacity.profiles.first_name}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="max_leads">Maximum Leads</Label>
                              <Input
                                id="max_leads"
                                type="number"
                                value={maxLeads}
                                onChange={(e) => setMaxLeads(parseInt(e.target.value))}
                              />
                            </div>
                            <div className="flex gap-2 justify-end">
                              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                                Cancel
                              </Button>
                              <Button onClick={handleUpdateMaxLeads}>Save</Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

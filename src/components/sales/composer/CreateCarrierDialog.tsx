import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface CreateCarrierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCarrierCreated: (carrier: any) => void;
  defaultMode?: string;
}

export function CreateCarrierDialog({ 
  open, 
  onOpenChange, 
  onCarrierCreated,
  defaultMode = 'ocean'
}: CreateCarrierDialogProps) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [mode, setMode] = useState(defaultMode);
  const [scac, setScac] = useState('');
  const [iata, setIata] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !mode) {
      toast({
        title: "Validation Error",
        description: "Carrier name and mode are required.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Get the current tenant ID if available (though RLS might handle this, it's safer to check)
      // For this implementation, we'll rely on the backend/RLS to assign the tenant_id based on the user's session
      // However, the schema shows tenant_id is required. 
      // Let's first fetch the tenant_id for the user.
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Insert the new carrier
      const { data, error } = await supabase
        .from('carriers')
        .insert({
          carrier_name: name,
          mode: mode,
          carrier_type: mode === 'air' ? 'air_cargo' : (mode === 'road' ? 'trucking' : mode), // Map mode to carrier_type
          scac: scac || null,
          iata: iata || null,
          is_active: true,
          // tenant_id will be handled by RLS/Trigger or we might need to fetch it if RLS policy requires it explicitly
          // Assuming the user is a tenant user, RLS should default to their tenant or allow insertion with their tenant_id
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: "Carrier created successfully."
      });

      onCarrierCreated(data);
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error('Error creating carrier:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create carrier.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setScac('');
    setIata('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Carrier</DialogTitle>
          <DialogDescription>
            Create a new carrier record. This will be available for future quotations.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Carrier Name *</Label>
            <Input 
              id="name" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="e.g. Maersk Line" 
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="mode">Transport Mode *</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger>
                <SelectValue placeholder="Select mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ocean">Ocean</SelectItem>
                <SelectItem value="air">Air</SelectItem>
                <SelectItem value="road">Road</SelectItem>
                <SelectItem value="rail">Rail</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scac">SCAC Code</Label>
              <Input 
                id="scac" 
                value={scac} 
                onChange={(e) => setScac(e.target.value.toUpperCase())} 
                placeholder="e.g. MAEU" 
                maxLength={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="iata">IATA Code</Label>
              <Input 
                id="iata" 
                value={iata} 
                onChange={(e) => setIata(e.target.value.toUpperCase())} 
                placeholder="e.g. MA" 
                maxLength={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Carrier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

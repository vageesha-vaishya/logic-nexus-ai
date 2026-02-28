import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EditCarrierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  carrier: any;
  onCarrierUpdated: () => void;
}

export function EditCarrierDialog({ 
  open, 
  onOpenChange, 
  carrier,
  onCarrierUpdated
}: EditCarrierDialogProps) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [mode, setMode] = useState('');
  const [scac, setScac] = useState('');
  const [iata, setIata] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (carrier) {
      setName(carrier.carrier_name || '');
      setMode(carrier.mode || 'ocean');
      setScac(carrier.scac || '');
      setIata(carrier.iata || '');
    }
  }, [carrier]);

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
      const { error } = await supabase
        .from('carriers')
        .update({
          carrier_name: name,
          mode: mode,
          carrier_type: mode === 'air' ? 'air_cargo' : (mode === 'road' ? 'trucking' : mode),
          scac: scac || null,
          iata: iata || null,
        })
        .eq('id', carrier.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Carrier updated successfully."
      });

      onCarrierUpdated();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating carrier:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update carrier.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Carrier</DialogTitle>
          <DialogDescription>
            Modify existing carrier details.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Carrier Name *</Label>
            <Input 
              id="edit-name" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="e.g. Maersk Line" 
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="edit-mode">Transport Mode *</Label>
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
              <Label htmlFor="edit-scac">SCAC Code</Label>
              <Input 
                id="edit-scac" 
                value={scac} 
                onChange={(e) => setScac(e.target.value.toUpperCase())} 
                placeholder="e.g. MAEU" 
                maxLength={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-iata">IATA Code</Label>
              <Input 
                id="edit-iata" 
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
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CreateLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLocationCreated: (location: any) => void;
}

export function CreateLocationDialog({ 
  open, 
  onOpenChange, 
  onLocationCreated 
}: CreateLocationDialogProps) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [code, setCode] = useState('');
  const [type, setType] = useState('seaport');
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !city || !country) {
      toast({
        title: "Validation Error",
        description: "Name, city, and country are required.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Insert the new location
      const { data, error } = await supabase
        .from('ports_locations')
        .insert({
          location_name: name,
          city: city,
          country: country,
          location_code: code || null,
          location_type: type,
          is_active: true,
          // tenant_id handled by RLS or default
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: "Location created successfully."
      });

      onLocationCreated(data);
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error('Error creating location:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create location.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setCity('');
    setCountry('');
    setCode('');
    setType('seaport');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Location</DialogTitle>
          <DialogDescription>
            Create a new port or location record.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="loc-name">Location Name *</Label>
            <Input 
              id="loc-name" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="e.g. Port of Los Angeles" 
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City *</Label>
              <Input 
                id="city" 
                value={city} 
                onChange={(e) => setCity(e.target.value)} 
                placeholder="e.g. Los Angeles" 
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country *</Label>
              <Input 
                id="country" 
                value={country} 
                onChange={(e) => setCountry(e.target.value)} 
                placeholder="e.g. USA" 
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">Location Code</Label>
              <Input 
                id="code" 
                value={code} 
                onChange={(e) => setCode(e.target.value.toUpperCase())} 
                placeholder="e.g. USLAX" 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="seaport">Seaport</SelectItem>
                  <SelectItem value="airport">Airport</SelectItem>
                  <SelectItem value="rail_terminal">Rail Terminal</SelectItem>
                  <SelectItem value="inland_port">Inland Port</SelectItem>
                  <SelectItem value="warehouse">Warehouse</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Location"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

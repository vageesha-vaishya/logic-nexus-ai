import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EditLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: any;
  onLocationUpdated: (updatedLocation: any) => void;
}

export function EditLocationDialog({ 
  open, 
  onOpenChange, 
  location,
  onLocationUpdated 
}: EditLocationDialogProps) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [code, setCode] = useState('');
  const [type, setType] = useState('seaport');
  const { toast } = useToast();

  useEffect(() => {
    if (location) {
      setName(location.location_name || '');
      setCity(location.city || '');
      setCountry(location.country || '');
      setCode(location.location_code || '');
      setType(location.location_type || 'seaport');
    }
  }, [location]);

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

      // Update the location
      const { data, error } = await supabase
        .from('ports_locations')
        .update({
          location_name: name,
          city: city,
          country: country,
          location_code: code || null,
          location_type: type,
        })
        .eq('id', location.id)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: "Location updated successfully."
      });

      onLocationUpdated(data);
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating location:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update location.",
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
          <DialogTitle>Edit Location</DialogTitle>
          <DialogDescription>
            Update the details for this location.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-loc-name">Location Name *</Label>
            <Input 
              id="edit-loc-name" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="e.g. Port of Los Angeles" 
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-city">City *</Label>
              <Input 
                id="edit-city" 
                value={city} 
                onChange={(e) => setCity(e.target.value)} 
                placeholder="e.g. Los Angeles" 
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-country">Country *</Label>
              <Input 
                id="edit-country" 
                value={country} 
                onChange={(e) => setCountry(e.target.value)} 
                placeholder="e.g. USA" 
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-code">Location Code</Label>
              <Input 
                id="edit-code" 
                value={code} 
                onChange={(e) => setCode(e.target.value.toUpperCase())} 
                placeholder="e.g. USLAX" 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-type">Type</Label>
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
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

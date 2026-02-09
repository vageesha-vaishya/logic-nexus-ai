
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface LegalHoldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hold?: any;
  onSuccess: () => void;
}

export function LegalHoldDialog({ open, onOpenChange, hold, onSuccess }: LegalHoldDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    name: "",
    target_type: "email_address",
    target_value: "",
    end_date: "",
    is_active: true
  });

  useEffect(() => {
    if (hold) {
      setFormData({
        name: hold.name,
        target_type: hold.target_type,
        target_value: hold.target_value,
        end_date: hold.end_date ? hold.end_date.split('T')[0] : "",
        is_active: hold.is_active
      });
    } else {
      setFormData({
        name: "",
        target_type: "email_address",
        target_value: "",
        end_date: "",
        is_active: true
      });
    }
  }, [hold, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        name: formData.name,
        target_type: formData.target_type,
        target_value: formData.target_value,
        end_date: formData.end_date ? new Date(formData.end_date).toISOString() : null,
        is_active: formData.is_active
      };

      if (hold) {
        const { error } = await supabase
          .from("compliance_legal_holds")
          .update(payload)
          .eq("id", hold.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("compliance_legal_holds")
          .insert(payload);
        if (error) throw error;
      }

      toast({ title: "Success", description: `Legal Hold ${hold ? "updated" : "created"} successfully` });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{hold ? "Edit Legal Hold" : "New Legal Hold"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Hold Name / Reason</Label>
            <Input 
              required 
              value={formData.name} 
              onChange={e => setFormData({...formData, name: e.target.value})} 
              placeholder="e.g., Pending Litigation Case #123"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Target Type</Label>
              <Select 
                value={formData.target_type} 
                onValueChange={v => setFormData({...formData, target_type: v})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email_address">Email Address</SelectItem>
                  <SelectItem value="domain">Domain</SelectItem>
                  <SelectItem value="subject_keyword">Subject Keyword</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
                <Label>Target Value</Label>
                <Input 
                    required
                    value={formData.target_value}
                    onChange={e => setFormData({...formData, target_value: e.target.value})}
                    placeholder="e.g., john@example.com"
                />
            </div>
          </div>

          <div className="space-y-2">
            <Label>End Date (Optional)</Label>
            <Input 
              type="date" 
              value={formData.end_date} 
              onChange={e => setFormData({...formData, end_date: e.target.value})} 
            />
            <p className="text-xs text-muted-foreground">Leave blank for indefinite hold.</p>
          </div>

          <div className="flex items-center gap-2">
            <Switch 
                checked={formData.is_active}
                onCheckedChange={c => setFormData({...formData, is_active: c})}
            />
            <Label>Hold Active</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Save Hold"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

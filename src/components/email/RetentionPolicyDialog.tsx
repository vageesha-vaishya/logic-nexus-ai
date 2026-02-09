
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface RetentionPolicyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policy?: any;
  onSuccess: () => void;
}

export function RetentionPolicyDialog({ open, onOpenChange, policy, onSuccess }: RetentionPolicyDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    name: "",
    scope: "global",
    scope_value: "",
    retention_days: "365",
    action: "archive",
    is_active: true
  });

  useEffect(() => {
    if (policy) {
      setFormData({
        name: policy.name,
        scope: policy.scope,
        scope_value: policy.scope_value || "",
        retention_days: String(policy.retention_days),
        action: policy.action,
        is_active: policy.is_active
      });
    } else {
      setFormData({
        name: "",
        scope: "global",
        scope_value: "",
        retention_days: "365",
        action: "archive",
        is_active: true
      });
    }
  }, [policy, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        name: formData.name,
        scope: formData.scope,
        scope_value: formData.scope === 'global' ? null : formData.scope_value,
        retention_days: parseInt(formData.retention_days),
        action: formData.action,
        is_active: formData.is_active
      };

      if (policy) {
        const { error } = await supabase
          .from("compliance_retention_policies")
          .update(payload)
          .eq("id", policy.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("compliance_retention_policies")
          .insert(payload);
        if (error) throw error;
      }

      toast({ title: "Success", description: `Policy ${policy ? "updated" : "created"} successfully` });
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
          <DialogTitle>{policy ? "Edit Retention Policy" : "New Retention Policy"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Policy Name</Label>
            <Input 
              required 
              value={formData.name} 
              onChange={e => setFormData({...formData, name: e.target.value})} 
              placeholder="e.g., 1 Year Archive"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Scope</Label>
              <Select 
                value={formData.scope} 
                onValueChange={v => setFormData({...formData, scope: v})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global (All Emails)</SelectItem>
                  <SelectItem value="folder">Specific Folder</SelectItem>
                  <SelectItem value="sender_domain">Sender Domain</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
                <Label>Scope Value</Label>
                <Input 
                    disabled={formData.scope === 'global'}
                    value={formData.scope_value}
                    onChange={e => setFormData({...formData, scope_value: e.target.value})}
                    placeholder={formData.scope === 'folder' ? "e.g., trash" : formData.scope === 'sender_domain' ? "example.com" : "N/A"}
                />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Retention Period (Days)</Label>
              <Input 
                type="number" 
                min="1"
                required
                value={formData.retention_days} 
                onChange={e => setFormData({...formData, retention_days: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <Label>Action</Label>
              <Select 
                value={formData.action} 
                onValueChange={v => setFormData({...formData, action: v})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="archive">Archive</SelectItem>
                  <SelectItem value="delete">Move to Trash</SelectItem>
                  <SelectItem value="permanent_delete">Permanently Delete</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch 
                checked={formData.is_active}
                onCheckedChange={c => setFormData({...formData, is_active: c})}
            />
            <Label>Policy Active</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Save Policy"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

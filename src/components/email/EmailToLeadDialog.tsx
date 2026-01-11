import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LeadForm, LeadFormData } from "@/components/crm/LeadForm";
import { useCRM } from "@/hooks/useCRM";
import { toast } from "sonner";

interface Email {
  id: string;
  subject: string;
  from_email: string;
  from_name: string;
  body_text?: string;
  snippet?: string;
  received_at: string;
}

interface EmailToLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: Email;
  onSuccess?: () => void;
}

export function EmailToLeadDialog({ open, onOpenChange, email, onSuccess }: EmailToLeadDialogProps) {
  const { supabase, context } = useCRM();

  const parseName = (fullName: string) => {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) {
      return { first_name: parts[0], last_name: "" };
    }
    return {
      first_name: parts.slice(0, -1).join(" "),
      last_name: parts[parts.length - 1],
    };
  };

  const { first_name, last_name } = parseName(email.from_name || email.from_email);

  const initialData: Partial<LeadFormData> = {
    first_name,
    last_name: last_name || "Unknown", // Last name is often required
    email: email.from_email,
    description: `Created from email: ${email.subject}\n\n${email.body_text || email.snippet || ""}`,
    source: "email",
    status: "new",
    tenant_id: context.tenantId || undefined,
    franchise_id: context.franchiseId || undefined,
  };

  const handleSubmit = async (data: LeadFormData) => {
    try {
      // 1. Create the lead
      const { data: lead, error } = await supabase
        .from("leads")
        .insert({
          ...data,
          // Ensure tenant/franchise context is respected if not in data
          tenant_id: data.tenant_id || context.tenantId,
          franchise_id: data.franchise_id || context.franchiseId,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Lead created successfully");
      
      // 2. Optionally link the specific email to the lead if the schema supports it
      // But since we rely on email address matching, this might be implicit.
      // If there was an explicit link table, we'd update it here.
      
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Error creating lead:", error);
      toast.error(error.message || "Failed to create lead");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Convert Email to Lead</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <LeadForm
            initialData={initialData}
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

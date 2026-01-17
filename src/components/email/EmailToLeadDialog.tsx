import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LeadForm, LeadFormData } from "@/components/crm/LeadForm";
import { useCRM } from "@/hooks/useCRM";
import { toast } from "sonner";
import { cleanEmail, cleanPhone } from "@/lib/data-cleaning";
import { sanitizeLeadDataForInsert, extractEmailAddress } from "./email-to-lead-helpers";

interface EmailForConversion {
  id: string;
  subject: string;
  from_email: string;
  from_name?: string;
  body_text?: string;
  body_html?: string;
  snippet?: string;
  received_at: string;
}

interface EmailToLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: EmailForConversion;
  onSuccess?: (leadId?: string) => void;
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

  const getBodyText = (email: EmailForConversion) => {
    if (email.body_text) return email.body_text;
    if (email.body_html) {
      const doc = new DOMParser().parseFromString(email.body_html, 'text/html');
      return doc.body.textContent || "";
    }
    return email.snippet || "";
  };

  const extractedEmail = extractEmailAddress(email.from_email);
  const { first_name, last_name } = parseName(email.from_name || email.from_email);

  const initialData: Partial<LeadFormData> = {
    first_name,
    last_name: last_name || "Unknown", // Last name is often required
    email: extractedEmail || "",
    description: `Created from email: ${email.subject}\n\n${getBodyText(email)}`,
    source: "email",
    status: "new",
    tenant_id: context.tenantId || undefined,
    franchise_id: context.franchiseId || undefined,
  };

  const handleSubmit = async (data: LeadFormData) => {
    try {
      // Check for existing lead by email
      if (data.email) {
        const normalizedEmail = cleanEmail(data.email).value || data.email.trim().toLowerCase();
        let query = supabase
          .from("leads")
          .select("id")
          .eq("email", normalizedEmail);
        if (context.tenantId) query = query.eq("tenant_id", context.tenantId);
        if (context.franchiseId) query = query.eq("franchise_id", context.franchiseId);
        const { data: existingLead } = await query.maybeSingle();

        if (existingLead) {
          toast.info("Lead already exists with this email");
          onOpenChange(false);
          onSuccess?.(existingLead.id);
          return;
        }
      }

      // Check for existing lead by phone
      if (data.phone) {
        const normalizedPhone = cleanPhone(data.phone).value || data.phone.trim();
        let query = supabase
          .from("leads")
          .select("id")
          .eq("phone", normalizedPhone);
        if (context.tenantId) query = query.eq("tenant_id", context.tenantId);
        if (context.franchiseId) query = query.eq("franchise_id", context.franchiseId);
        const { data: existingByPhone } = await query.maybeSingle();

        if (existingByPhone) {
          toast.info("Lead already exists with this phone");
          onOpenChange(false);
          onSuccess?.(existingByPhone.id);
          return;
        }
      }

      const { service_id, attachments } = data;
      const attachmentNames = Array.isArray(attachments)
        ? attachments.map((f: File) => f.name)
        : [];
      const customFields: Record<string, unknown> = {
        service_id: service_id || undefined,
        ...(attachmentNames.length ? { attachments_names: attachmentNames } : {}),
      };

      const { data: lead, error } = await supabase
        .from("leads")
        .insert({
          ...sanitizeLeadDataForInsert(data),
          email: data.email ? (cleanEmail(data.email).value || data.email.trim().toLowerCase()) : null,
          phone: data.phone ? (cleanPhone(data.phone).value || data.phone.trim()) : null,
          // Ensure tenant/franchise context is respected if not in data
          tenant_id: data.tenant_id || context.tenantId,
          franchise_id: data.franchise_id || context.franchiseId,
          custom_fields: Object.keys(customFields).filter((k) => customFields[k] !== undefined).length
            ? Object.fromEntries(
                Object.entries(customFields).filter(([, v]) => v !== undefined),
              )
            : null,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Lead created successfully");
      
      // Record automated activity for conversion
      try {
        await supabase
          .from("lead_activities")
          .insert({
            lead_id: lead.id,
            type: "email_converted",
            metadata: {
              email_id: email.id,
              subject: email.subject,
              from_email: email.from_email,
              received_at: email.received_at,
            },
            tenant_id: context.tenantId || null,
          });
      } catch (err) {
        console.error("Error recording lead email conversion activity", err);
      }
      
      // 2. Optionally link the specific email to the lead if the schema supports it
      // But since we rely on email address matching, this might be implicit.
      // If there was an explicit link table, we'd update it here.
      
      onOpenChange(false);
      onSuccess?.(lead.id);
    } catch (error: unknown) {
      let message = "Failed to create lead";
      if (error && typeof error === "object" && "message" in error && typeof (error as { message: unknown }).message === "string") {
        message = (error as { message: string }).message || message;
      }
      console.error("Error creating lead from email", error);
      toast.error(message);
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

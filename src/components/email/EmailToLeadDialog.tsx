import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { LeadForm, LeadFormData } from "@/components/crm/LeadForm";
import { useCRM } from "@/hooks/useCRM";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import config from "@/config/Interested_Transport_Mode_checker_config.json";
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
  const [suggestedService, setSuggestedService] = useState<string>("");
  const [isSuggesting, setIsSuggesting] = useState(false);

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

  const initialData: Partial<LeadFormData> & { custom_fields?: any } = {
    first_name,
    last_name: last_name || "Unknown", // Last name is often required
    email: extractedEmail || "",
    description: `Created from email: ${email.subject}\n\n${getBodyText(email)}`,
    source: "email",
    status: "new",
    tenant_id: context.tenantId || undefined,
    franchise_id: context.franchiseId || undefined,
    // Pass the suggested service so it persists even if LeadForm remounts
    custom_fields: suggestedService ? { service_id: suggestedService } : undefined,
  };

  useEffect(() => {
    // Reset suggestion when email changes or dialog closes to prevent stale data
    setSuggestedService("");
    setIsSuggesting(false);
  }, [email.id, open]);

  useEffect(() => {
    let abortController = new AbortController();

    const fetchSuggestion = async () => {
      // Use email.id to avoid unnecessary re-runs if the object reference changes but content is same
      if (!email || (!email.subject && !email.body_text && !email.body_html)) return;
      
      setIsSuggesting(true);
      // Do NOT clear suggestedService here to avoid flashing empty state if we have one
      // setSuggestedService(""); 
      
      try {
        const subject = email.subject || "";
        const content = getBodyText(email);
        
        let prompt = config.system_prompt;
        // Replace placeholders - handle potential missing subject/content gracefully
        prompt = prompt.replace("<subject>", subject).replace("<content>", content);
        
        // Generate Request ID for tracing
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const requestTimestamp = new Date().toISOString();
        
        console.log(`[EmailToLeadDialog] [INFO] [${requestTimestamp}] Request initiated: ${requestId}`);
        console.log(`[EmailToLeadDialog] [DEBUG] [${requestTimestamp}] Request Payload:`, { prompt });

        const startTime = Date.now();

        const { data, error } = await supabase.functions.invoke('suggest-transport-mode', {
          body: { prompt, requestId }, // Pass requestId if server wants to log it too
          headers: { 'x-client-info': 'email-to-lead' }
        });

        if (abortController.signal.aborted) return;
        
        if (error) {
            console.error(`[EmailToLeadDialog] [ERROR] [${new Date().toISOString()}] API Error for ${requestId}:`, error);
            throw error;
        }
        
        // Handle application-level errors returned with 200 OK
        if (data?.error) {
          console.error(`[EmailToLeadDialog] [ERROR] [${new Date().toISOString()}] Application Error for ${requestId}:`, data.error);
          throw new Error(data.error);
        }
        
        const text = data?.text || "";
        const meta = data?.meta || {};
        const service = meta.service || "UnknownService";
        const model = meta.model || "UnknownModel";
        const duration = meta.duration_ms || (Date.now() - startTime);

        // Structured Logging as requested
        console.log(`[${service}] [${model}] [${requestId}] Prompt: ${prompt}`);
        console.log(`[${service}] [${model}] [${requestId}] ResponseTime: ${duration} ms`);
        console.log(`[${service}] [${model}] [${requestId}] Response: ${text}`);
        
        // Extract content within brackets if present
        const match = text.match(/\[(.*?)\]/);
        let recommendation = match ? match[1] : text;
        
        // Cleanup if it still has "Recommended Transport:" prefix
        if (recommendation.includes("Recommended Transport:")) {
            recommendation = recommendation.replace("Recommended Transport:", "").trim();
        }
        
        if (recommendation) {
            console.log(`[EmailToLeadDialog] [INFO] [${new Date().toISOString()}] Setting suggested service for ${requestId}:`, recommendation);
            setSuggestedService(recommendation);
        } else {
            console.warn(`[EmailToLeadDialog] [WARNING] [${new Date().toISOString()}] No recommendation found in response for ${requestId}`);
        }
      } catch (err) {
        if (!abortController.signal.aborted) {
          console.error(`[EmailToLeadDialog] [ERROR] [${new Date().toISOString()}] Error getting transport suggestion:`, err);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsSuggesting(false);
        }
      }
    };
    
    if (open) {
      fetchSuggestion();
    }

    return () => {
      abortController.abort();
    };
  }, [open, email.id, supabase]);

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
          <DialogDescription>
            Review the email details and confirm the lead information below.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <LeadForm
            initialData={initialData}
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
            suggestedService={suggestedService}
            isSuggestingService={isSuggesting}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

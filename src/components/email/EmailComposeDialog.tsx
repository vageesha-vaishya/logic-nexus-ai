import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Send, Paperclip, X, Bold, Italic, Underline, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, Link as LinkIcon, Eraser, Loader2, Trash2, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { invokeFunction } from "@/lib/supabase-functions";
import { useCRM } from "@/hooks/useCRM";

const emailComposeSchema = z.object({
  accountId: z.string().min(1, "Please select an account"),
  to: z.string().min(1, "Recipient is required").refine(
    (val) => val.split(",").every(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())),
    { message: "One or more email addresses are invalid" }
  ),
  cc: z.string().optional().refine(
    (val) => !val || val.split(",").every(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())),
    { message: "One or more CC email addresses are invalid" }
  ),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Message body is required"),
});

type EmailComposeValues = z.infer<typeof emailComposeSchema>;

interface EmailComposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  replyTo?: {
    to: string;
    subject: string;
    body?: string;
  };
  initialTo?: string[];
  initialSubject?: string;
  initialBody?: string;
  existingActivityId?: string;
  onSent?: () => void;
  entityType?: string;
  entityId?: string;
}

export function EmailComposeDialog({ open, onOpenChange, replyTo, initialTo, initialSubject, initialBody, existingActivityId, onSent, entityType, entityId }: EmailComposeDialogProps) {
  const [accounts, setAccounts] = useState<any[]>([]);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [sending, setSending] = useState(false);
  const { toast } = useToast();
  const { context } = useCRM();
  const [composeDefaults, setComposeDefaults] = useState<{ font?: string; sizePt?: number; ribbon?: boolean; signatureHtml?: string }>({
    font: "Calibri, Segoe UI, Arial, sans-serif",
    sizePt: 11,
    ribbon: true,
    signatureHtml: "",
  });

  // Attachments state
  const [attachments, setAttachments] = useState<{ name: string; path: string; type: string; url: string }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<EmailComposeValues>({
    resolver: zodResolver(emailComposeSchema),
    defaultValues: {
      accountId: "",
      to: replyTo?.to || (initialTo ? initialTo.join(", ") : ""),
      cc: "",
      subject: replyTo?.subject || initialSubject || "",
      body: replyTo?.body || initialBody || "Hi, \n\n This is a test email from Logic Nexus AI.",
    },
  });

  useEffect(() => {
    if (open) {
      fetchAccounts();
      let contentHtml = "";

      if (replyTo) {
        form.setValue("to", replyTo.to);
        
        // Smart subject handling
        let newSubject = replyTo.subject;
        if (!newSubject.toLowerCase().startsWith("re:") && !newSubject.toLowerCase().startsWith("fwd:")) {
           newSubject = `Re: ${newSubject}`;
        }
        form.setValue("subject", newSubject);
        
        if (replyTo.body) {
          if (newSubject.toLowerCase().startsWith("fwd:")) {
             form.setValue("body", replyTo.body);
             contentHtml = plainToHtml(replyTo.body);
          } else {
             // Reply
             const quoted = `\n\n--- Original Message ---\n${replyTo.body}`;
             form.setValue("body", quoted);
             contentHtml = plainToHtml(quoted);
          }
        }
      } else {
        // Handle initial values
        if (initialSubject) form.setValue("subject", initialSubject);
        if (initialBody) {
          form.setValue("body", initialBody);
          contentHtml = plainToHtml(initialBody);
        } else {
          const defaultBody = form.getValues("body") || "Hi, \n\n This is a test email from Logic Nexus AI.";
          form.setValue("body", defaultBody);
          contentHtml = plainToHtml(defaultBody);
        }
      }

      // Initialize editor content
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.innerHTML = contentHtml || plainToHtml(form.getValues("body") || "");
        }
      }, 0);
    }
  }, [open, replyTo, initialSubject, initialBody, form]);

  useEffect(() => {
    // Apply compose defaults when account changes
    const selectedAccountId = form.watch("accountId");
    try {
      const acc = accounts.find((a) => a.id === selectedAccountId);
      const settings = (acc?.settings || {}) as any;
      const nextDefaults = {
        font: settings.compose_default_font || "Calibri, Segoe UI, Arial, sans-serif",
        sizePt: settings.compose_default_size_pt || 11,
        ribbon: settings.compose_ribbon_enabled !== false,
        signatureHtml: settings.signature_html || "",
      };
      setComposeDefaults(nextDefaults);
      // Apply styles to editor
      if (editorRef.current) {
        editorRef.current.style.fontFamily = nextDefaults.font as string;
        editorRef.current.style.fontSize = `${nextDefaults.sizePt}pt`;
        // Initialize with signature if empty
        const current = editorRef.current.innerHTML?.trim();
        if (!current || current === "<br>") {
          const baseHtml = plainToHtml(form.getValues("body") || "");
          editorRef.current.innerHTML = nextDefaults.signatureHtml
            ? `${baseHtml}${baseHtml ? '<br><br>' : ''}${nextDefaults.signatureHtml}`
            : baseHtml;
          form.setValue("body", editorRef.current.innerHTML);
        }
      }
    } catch {
      // ignore
    }
  }, [form.watch("accountId"), accounts]);

  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from("email_accounts")
        .select("*")
        .eq("is_active", true)
        .order("is_primary", { ascending: false });

      if (error) throw error;
      setAccounts(data || []);
      if (data && data.length > 0) {
        const connected = data.find((a: any) => (a.provider === "gmail" ? (a.access_token || a.refresh_token) : true));
        form.setValue("accountId", (connected || data[0])?.id || "");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsUploading(true);
      const files = Array.from(e.target.files);
      
      for (const file of files) {
        // Limit file size to 4MB to prevent Edge Function timeouts/memory issues
        if (file.size > 4 * 1024 * 1024) {
          toast({
            title: "File too large",
            description: `${file.name} exceeds the 4MB limit. Please reduce its size.`,
            variant: "destructive",
          });
          continue;
        }

        try {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
          const filePath = `${fileName}`;
          
          const { error: uploadError } = await supabase.storage
            .from('email-attachments')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('email-attachments')
            .getPublicUrl(filePath);

          setAttachments(prev => [...prev, {
            name: file.name,
            path: filePath,
            type: file.type,
            url: publicUrl
          }]);
        } catch (error: any) {
          console.error("Upload error:", error);
          toast({
            title: "Upload Failed",
            description: `Failed to upload ${file.name}: ${error.message}`,
            variant: "destructive",
          });
        }
      }
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      
      if (file.size > 4 * 1024 * 1024) {
        toast({
          title: "Image too large",
          description: "Inline images must be under 4MB.",
          variant: "destructive",
        });
        if (imageInputRef.current) imageInputRef.current.value = '';
        return;
      }

      try {
          const fileExt = file.name.split('.').pop();
          const fileName = `inline_${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
          const filePath = `${fileName}`;
          
          const { error: uploadError } = await supabase.storage
            .from('email-attachments')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('email-attachments')
            .getPublicUrl(filePath);

          if (editorRef.current) {
            editorRef.current.focus();
            document.execCommand('insertImage', false, publicUrl);
            form.setValue("body", editorRef.current.innerHTML);
          }
      } catch (error: any) {
          toast({ title: "Image Upload Failed", description: error.message, variant: "destructive" });
      }
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (values: EmailComposeValues) => {
    setSending(true);
    try {
      const selected = accounts.find((a) => a.id === values.accountId);
      if (selected?.provider === "gmail" && !selected?.access_token && !selected?.refresh_token) {
        throw new Error("Selected Gmail account is not connected. Please connect it in Accounts.");
      }

      // Call edge function to send email
      const { data, error } = await invokeFunction("send-email", {
        body: {
          accountId: values.accountId,
          to: values.to.split(",").map(e => e.trim()),
          cc: values.cc ? values.cc.split(",").map(e => e.trim()) : [],
          subject: values.subject,
          body: values.body,
          attachments: attachments.map(a => ({
            filename: a.name,
            path: a.path,
            contentType: a.type
          })),
        },
      });

      if (error) {
        let description = error.message;
        const ctx = (error as any)?.context;
        if (ctx) {
          try {
            const parsed = typeof ctx === 'string' ? JSON.parse(ctx) : ctx;
            description = parsed?.error || parsed?.message || description;
          } catch {
            // ignore
          }
        }
        
        if (description.includes("non-2xx")) {
          const status = (error as any)?.context?.status;
          if (status === 504) {
             description = "Email service timed out. The provider (Gmail/Office365) took too long to respond. Please try again later.";
          } else if (status === 413) {
             description = "Email content too large. Please reduce attachment size or avoid pasting large images directly.";
          } else if (status === 500) {
             description = "Email service error. Please try again later.";
          } else if (status === 401) {
              description = "Session expired. Please log out and log in again.";
           } else {
             description = `Email service unavailable (Status: ${status || 'Unknown'}). Please check your connection.`;
          }
        }
        
        throw new Error(description);
      }
      if (data && (data as any).success === false) {
        throw new Error((data as any).error || "Failed to send email");
      }

      // Create activity log automatically
      if (entityType && entityId) {
        try {
          let tenantId = context.tenantId;
          let franchiseId = context.franchiseId;

          const tableMap: Record<string, string> = {
            lead: 'leads',
            contact: 'contacts',
            account: 'accounts',
            opportunity: 'opportunities',
          };
          const tableName = tableMap[entityType];

          if (tableName) {
            const { data: entityData, error: entityError } = await (supabase as any)
              .from(tableName)
              .select('tenant_id, franchise_id')
              .eq('id', entityId)
              .single();

            if (entityData) {
              tenantId = entityData.tenant_id;
              franchiseId = entityData.franchise_id;
            } else if (entityError) {
              console.warn("Could not fetch entity context for activity creation:", entityError);
            }
          }

          const activityData: any = {
            activity_type: 'email',
            status: 'completed',
            priority: 'medium',
            subject: values.subject,
            description: values.body.replace(/<[^>]+>/g, "").substring(0, 500), // Plain text preview
            completed_at: new Date().toISOString(),
            tenant_id: tenantId,
            franchise_id: franchiseId,
            created_by: (await supabase.auth.getUser()).data.user?.id,
            custom_fields: {
              to: values.to,
              cc: values.cc,
              email_body: values.body
            }
          };

          if (entityType === 'lead') activityData.lead_id = entityId;
          if (entityType === 'contact') activityData.contact_id = entityId;
          if (entityType === 'account') activityData.account_id = entityId;
          if (entityType === 'opportunity') activityData.opportunity_id = entityId;

          if (tenantId) {
             let activityError;
             if (existingActivityId) {
                const { data: existingActivity } = await supabase
                  .from('activities')
                  .select('custom_fields')
                  .eq('id', existingActivityId)
                  .single();

                const mergedCustomFields = {
                  ...(existingActivity?.custom_fields as object || {}),
                  ...activityData.custom_fields
                };

                const updateData = {
                  ...activityData,
                  custom_fields: mergedCustomFields
                };

                const { error } = await supabase.from('activities').update(updateData).eq('id', existingActivityId);
                activityError = error;
             } else {
                const { error } = await supabase.from('activities').insert(activityData);
                activityError = error;
             }

             if (activityError) {
               console.error("Failed to create/update activity:", activityError);
               toast({
                 title: "Warning",
                 description: "Email sent, but failed to update activity log.",
                 variant: "destructive",
               });
             }
          }
        } catch (err) {
          console.error("Error creating activity log:", err);
        }
      }

      toast({
        title: "Success",
        description: "Email sent successfully",
      });

      onSent?.();
      onOpenChange(false);
      form.reset();
      setAttachments([]);
      if (editorRef.current) editorRef.current.innerHTML = "";
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const exec = (cmd: string, val?: string) => {
    try {
      document.execCommand(cmd, false, val);
    } catch {
      // ignore
    }
  };

  const applyLink = () => {
    const url = prompt("Enter URL:");
    if (url) exec("createLink", url);
  };

  const clearFormatting = () => {
    exec("removeFormat");
  };

  const plainToHtml = (text: string) => {
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return esc(text).replace(/\n/g, "<br>");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden font-outlook flex flex-col">
        <DialogHeader>
          <DialogTitle>Compose Email</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 overflow-y-auto space-y-4 pr-1">
            <FormField
              control={form.control}
              name="accountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>From</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger aria-label="From account">
                        <SelectValue placeholder="Select email account" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.display_name || account.email_address}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="to"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>To *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="recipient@example.com (comma separated for multiple)"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cc"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CC</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="cc@example.com (comma separated for multiple)"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Email subject"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>Message</FormLabel>
                  {composeDefaults.ribbon && (
                  <div className="flex flex-wrap items-center gap-1">
                    <Button type="button" variant="ghost" size="sm" onClick={() => exec("bold")} aria-label="Bold"> <Bold className="w-4 h-4" /> </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => exec("italic")} aria-label="Italic"> <Italic className="w-4 h-4" /> </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => exec("underline")} aria-label="Underline"> <Underline className="w-4 h-4" /> </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => exec("insertUnorderedList")} aria-label="Unordered List"> <List className="w-4 h-4" /> </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => exec("insertOrderedList")} aria-label="Ordered List"> <ListOrdered className="w-4 h-4" /> </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => exec("justifyLeft")} aria-label="Align Left"> <AlignLeft className="w-4 h-4" /> </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => exec("justifyCenter")} aria-label="Align Center"> <AlignCenter className="w-4 h-4" /> </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => exec("justifyRight")} aria-label="Align Right"> <AlignRight className="w-4 h-4" /> </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => imageInputRef.current?.click()} aria-label="Insert Image"> <ImageIcon className="w-4 h-4" /> </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={applyLink} aria-label="Insert Link"> <LinkIcon className="w-4 h-4" /> </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={clearFormatting} aria-label="Clear Formatting"> <Eraser className="w-4 h-4" /> </Button>
                  </div>
                  )}
                  <FormControl>
                    <div
                      ref={editorRef}
                      contentEditable
                      className="min-h-[200px] border rounded-md p-3 font-outlook focus:outline-none"
                      onInput={(e) => field.onChange((e.target as HTMLDivElement).innerHTML)}
                      style={{ whiteSpace: "pre-wrap" }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachments.map((file, i) => (
                  <div key={i} className="flex items-center gap-2 bg-secondary p-2 rounded-md text-sm">
                    <span className="max-w-[220px] truncate">{file.name}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeAttachment(i)} aria-label={`Remove attachment ${file.name}`}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="shrink-0 border-t pt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-background">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                multiple
                onChange={handleFileSelect}
              />
              <input
                type="file"
                ref={imageInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleImageSelect}
              />
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                  {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Paperclip className="w-4 h-4 mr-2" />}
                  Attach File
                </Button>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={sending}>
                  <Send className="w-4 h-4 mr-2" />
                  {sending ? "Sending..." : "Send"}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
// import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Paperclip, X, Bold, Italic, Underline, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, Link as LinkIcon, Eraser, Loader2, Trash2, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { invokeFunction } from "@/lib/supabase-functions";
import { useCRM } from "@/hooks/useCRM";
import { useRef } from "react";

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
  const [selectedAccount, setSelectedAccount] = useState("");
  const [to, setTo] = useState(replyTo?.to || (initialTo ? initialTo.join(", ") : ""));
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(replyTo?.subject || initialSubject || "");
  const [body, setBody] = useState(replyTo?.body || initialBody || "Hi, \n\n This is a test email from Logic Nexus AI.");
  const [editorHtml, setEditorHtml] = useState<string>("");
  const editorRef = { current: null as HTMLDivElement | null };
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

  useEffect(() => {
    if (open) {
      fetchAccounts();
      let contentHtml = "";

      if (replyTo) {
        setTo(replyTo.to);
        
        // Smart subject handling
        let newSubject = replyTo.subject;
        if (!newSubject.toLowerCase().startsWith("re:") && !newSubject.toLowerCase().startsWith("fwd:")) {
           newSubject = `Re: ${newSubject}`;
        }
        setSubject(newSubject);
        
        if (replyTo.body) {
          if (newSubject.toLowerCase().startsWith("fwd:")) {
             setBody(replyTo.body);
             contentHtml = plainToHtml(replyTo.body);
             setEditorHtml(contentHtml);
          } else {
             // Reply
             const quoted = `\n\n--- Original Message ---\n${replyTo.body}`;
             setBody(quoted);
             contentHtml = plainToHtml(quoted);
             setEditorHtml(contentHtml);
          }
        }
      } else {
        // Handle initial values
        if (initialSubject) setSubject(initialSubject);
        if (initialBody) {
          setBody(initialBody);
          contentHtml = plainToHtml(initialBody);
          setEditorHtml(contentHtml);
        } else if (!body) {
          const defaultBody = "Hi, \n\n This is a test email from Logic Nexus AI.";
          setBody(defaultBody);
          contentHtml = plainToHtml(defaultBody);
          setEditorHtml(contentHtml);
        }
      }

      // Initialize editor content
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.innerHTML = contentHtml || editorHtml || plainToHtml(body || "");
        }
      }, 0);
    }
  }, [open, replyTo, initialSubject, initialBody]);

  useEffect(() => {
    // Apply compose defaults when account changes
    try {
      const acc = accounts.find((a) => a.id === selectedAccount);
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
        if (!current) {
          const baseHtml = editorHtml || plainToHtml(body || "");
          editorRef.current.innerHTML = nextDefaults.signatureHtml
            ? `${baseHtml}${baseHtml ? '<br><br>' : ''}${nextDefaults.signatureHtml}`
            : baseHtml;
          setEditorHtml(editorRef.current.innerHTML);
        }
      }
    } catch {
      // ignore
    }
  }, [selectedAccount, accounts]);

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
        setSelectedAccount((connected || data[0])?.id || "");
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
            setEditorHtml(editorRef.current.innerHTML);
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

  const handleSend = async () => {
    if (!selectedAccount || !to || !subject) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      const selected = accounts.find((a) => a.id === selectedAccount);
      if (selected?.provider === "gmail" && !selected?.access_token && !selected?.refresh_token) {
        throw new Error("Selected Gmail account is not connected. Please connect it in Accounts.");
      }

      // Call edge function to send email
      const { data, error } = await invokeFunction("send-email", {
        body: {
          accountId: selectedAccount,
          to: to.split(",").map(e => e.trim()),
          cc: cc ? cc.split(",").map(e => e.trim()) : [],
          subject,
          body: editorHtml || plainToHtml(body),
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
              console.error("Email send Unauthorized. Full error:", error);
              if ((error as any)?.context) {
                  console.error("Debug info (context):", (error as any).context);
              }
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
            // shipment: 'shipments' // Activity table doesn't support shipment_id directly yet
          };
          const tableName = tableMap[entityType];

          // Always try to fetch entity context to ensure activity matches entity scope
          if (tableName) {
            const { data: entityData, error: entityError } = await (supabase as any)
              .from(tableName)
              .select('tenant_id, franchise_id')
              .eq('id', entityId)
              .single();

            if (entityData) {
              // Use entity's tenant/franchise to ensure visibility consistency
              // This is crucial for Tenant Admins (who have null franchiseId in context)
              // creating activities for Franchise Leads.
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
            subject: subject,
            description: (editorHtml || body || "").replace(/<[^>]+>/g, "").substring(0, 500), // Plain text preview
            completed_at: new Date().toISOString(),
            tenant_id: tenantId,
            franchise_id: franchiseId,
            created_by: (await supabase.auth.getUser()).data.user?.id,
            custom_fields: {
              to: to,
              cc: cc,
              email_body: editorHtml || body || ""
            }
          };

          if (entityType === 'lead') activityData.lead_id = entityId;
          if (entityType === 'contact') activityData.contact_id = entityId;
          if (entityType === 'account') activityData.account_id = entityId;
          if (entityType === 'opportunity') activityData.opportunity_id = entityId;

          if (tenantId) {
             let activityError;
             if (existingActivityId) {
                // Fetch existing activity to merge custom_fields
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
          } else {
             console.warn("Skipping activity creation: tenantId missing");
          }
        } catch (err) {
          console.error("Error creating activity log:", err);
          toast({
             title: "Warning",
             description: "Email sent, but failed to create activity log.",
             variant: "destructive",
           });
        }
      }

      toast({
        title: "Success",
        description: "Email sent successfully",
      });

      onSent?.();
      onOpenChange(false);
      resetForm();
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

  const resetForm = () => {
    setTo("");
    setCc("");
    setSubject("");
    setBody("Hi, \n\n This is a test email from Logic Nexus AI.");
    setEditorHtml("");
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

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          <div>
            <Label>From</Label>
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger>
                <SelectValue placeholder="Select email account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.display_name || account.email_address}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>To *</Label>
            <Input
              placeholder="recipient@example.com (comma separated for multiple)"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>

          <div>
            <Label>CC</Label>
            <Input
              placeholder="cc@example.com (comma separated for multiple)"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
            />
          </div>

          <div>
            <Label>Subject *</Label>
            <Input
              placeholder="Email subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Message</Label>
            {composeDefaults.ribbon && (
            <div className="flex flex-wrap items-center gap-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => exec("bold")}> <Bold className="w-4 h-4" /> </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => exec("italic")}> <Italic className="w-4 h-4" /> </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => exec("underline")}> <Underline className="w-4 h-4" /> </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => exec("insertUnorderedList")}> <List className="w-4 h-4" /> </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => exec("insertOrderedList")}> <ListOrdered className="w-4 h-4" /> </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => exec("justifyLeft")}> <AlignLeft className="w-4 h-4" /> </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => exec("justifyCenter")}> <AlignCenter className="w-4 h-4" /> </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => exec("justifyRight")}> <AlignRight className="w-4 h-4" /> </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => imageInputRef.current?.click()}> <ImageIcon className="w-4 h-4" /> </Button>
              <Button type="button" variant="ghost" size="sm" onClick={applyLink}> <LinkIcon className="w-4 h-4" /> </Button>
              <Button type="button" variant="ghost" size="sm" onClick={clearFormatting}> <Eraser className="w-4 h-4" /> </Button>
            </div>
            )}
            <div
              ref={(el) => { editorRef.current = el; }}
              contentEditable
              className="min-h-[200px] border rounded-md p-3 font-outlook focus:outline-none"
              onInput={(e) => setEditorHtml((e.target as HTMLDivElement).innerHTML)}
              style={{ whiteSpace: "pre-wrap" }}
            />
          </div>

          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((file, i) => (
                <div key={i} className="flex items-center gap-2 bg-secondary p-2 rounded-md text-sm">
                  <span className="max-w-[220px] truncate">{file.name}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeAttachment(i)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

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
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
              {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Paperclip className="w-4 h-4 mr-2" />}
              Attach File
            </Button>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={sending}>
              <Send className="w-4 h-4 mr-2" />
              {sending ? "Sending..." : "Send"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

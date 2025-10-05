import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
// import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Paperclip, X, Bold, Italic, Underline, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, Link as LinkIcon, Eraser } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCRM } from "@/hooks/useCRM";

interface EmailComposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  replyTo?: {
    to: string;
    subject: string;
    body?: string;
  };
}

export function EmailComposeDialog({ open, onOpenChange, replyTo }: EmailComposeDialogProps) {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [to, setTo] = useState(replyTo?.to || "");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(replyTo?.subject || "");
  const [body, setBody] = useState(replyTo?.body || "");
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

  // Templates state
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  useEffect(() => {
    if (open) {
      fetchAccounts();
      fetchTemplates();
      if (replyTo) {
        setTo(replyTo.to);
        setSubject(replyTo.subject.startsWith("Re:") ? replyTo.subject : `Re: ${replyTo.subject}`);
        if (replyTo.body) {
          setBody(`\n\n--- Original Message ---\n${replyTo.body}`);
          setEditorHtml(plainToHtml(`\n\n--- Original Message ---\n${replyTo.body}`));
        }
      }
      // Initialize editor content
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.innerHTML = editorHtml || plainToHtml(body || "");
        }
      }, 0);
    }
  }, [open, replyTo]);

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
    } catch {}
  }, [selectedAccount, accounts]);

  // Fetch email accounts
  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from("email_accounts")
        .select("id, email_address, display_name, settings")
        .eq("tenant_id", context?.tenantId);
      if (error) throw error;
      setAccounts(data || []);
      if (data && data.length > 0) setSelectedAccount(data[0].id);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // Fetch templates
  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("email_templates")
        .select("id, name, subject, body_html, category, is_active")
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      setTemplates(data || []);
    } catch (err: any) {
      // Soft-fail without toast to avoid noise in compose
      console.warn("Failed to fetch templates", err.message);
    }
  };

  // Apply selected template to subject/body
  const applyTemplate = () => {
    const tmpl = templates.find((t) => t.id === selectedTemplateId);
    if (!tmpl) {
      toast({ title: "No template selected", description: "Choose a template to apply." });
      return;
    }
    try {
      const acc = accounts.find((a) => a.id === selectedAccount);
      const senderName = acc?.display_name || acc?.email_address || "";
      const mergedSubject = (tmpl.subject || "").replace(/\{\{\s*sender_name\s*\}\}/gi, senderName);
      const mergedHtml = (tmpl.body_html || "")
        .replace(/\{\{\s*sender_name\s*\}\}/gi, senderName);

      setSubject(mergedSubject);
      const withSignature = composeDefaults.signatureHtml
        ? `${mergedHtml}${mergedHtml ? '<br><br>' : ''}${composeDefaults.signatureHtml}`
        : mergedHtml;
      if (editorRef.current) {
        editorRef.current.innerHTML = withSignature || "";
      }
      setEditorHtml(withSignature || "");
      toast({ title: "Template applied", description: tmpl.name });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const exec = (cmd: string, value?: string) => {
    try {
      document.execCommand(cmd, false, value);
      setEditorHtml(editorRef.current?.innerHTML || "");
    } catch {}
  };

  const insertLink = () => {
    const url = prompt("Enter URL");
    if (url) exec("createLink", url);
  };

  const clearFormatting = () => {
    exec("removeFormat");
  };

  const plainToHtml = (text: string) => {
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return esc(text).replace(/\n/g, "<br>");
  };

  const handleSend = async () => {
    if (!to || !subject) {
      toast({ title: "Missing fields", description: "Recipient and subject are required.", variant: "destructive" });
      return;
    }
    try {
      setSending(true);
      const { error } = await supabase.from("email_outbox").insert([
        {
          from_account_id: selectedAccount,
          to,
          cc: cc || null,
          subject,
          body_html: editorHtml || null,
          tenant_id: context?.tenantId,
        },
      ]);
      if (error) throw error;
      toast({ title: "Queued", description: "Email queued for sending." });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto font-outlook">
        <DialogHeader>
          <DialogTitle>Compose Email</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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

          {/* Template selection */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
            <div className="md:col-span-2">
              <Label>Template</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}{t.category ? ` — ${t.category}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex md:justify-end">
              <Button variant="outline" onClick={applyTemplate}>Apply</Button>
            </div>
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
              <Button type="button" variant="ghost" size="sm" onClick={insertLink}> <LinkIcon className="w-4 h-4" /> </Button>
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

          <div className="flex items-center justify-between pt-4">
            <Button variant="outline" size="sm">
              <Paperclip className="w-4 h-4 mr-2" />
              Attach File
            </Button>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSend} disabled={sending}>
                <Send className="w-4 h-4 mr-2" />
                {sending ? "Sending..." : "Send"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

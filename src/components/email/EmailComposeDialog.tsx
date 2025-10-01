import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Paperclip, X } from "lucide-react";
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
  const [sending, setSending] = useState(false);
  const { toast } = useToast();
  const { context } = useCRM();

  useEffect(() => {
    if (open) {
      fetchAccounts();
      if (replyTo) {
        setTo(replyTo.to);
        setSubject(replyTo.subject.startsWith("Re:") ? replyTo.subject : `Re: ${replyTo.subject}`);
        if (replyTo.body) {
          setBody(`\n\n--- Original Message ---\n${replyTo.body}`);
        }
      }
    }
  }, [open, replyTo]);

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
        setSelectedAccount(data[0].id);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
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
      // Call edge function to send email
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          accountId: selectedAccount,
          to: to.split(",").map(e => e.trim()),
          cc: cc ? cc.split(",").map(e => e.trim()) : [],
          subject,
          body,
        },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Email sent successfully",
      });

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
    setBody("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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

          <div>
            <Label>Subject *</Label>
            <Input
              placeholder="Email subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div>
            <Label>Message</Label>
            <Textarea
              placeholder="Write your message here..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
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

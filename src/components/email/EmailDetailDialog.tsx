import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Reply, Forward, Archive, Trash2, Star, Paperclip, MoreHorizontal, ChevronUp, Maximize2, Minimize2, UserPlus, Shield, ShieldAlert, ShieldCheck, AlertTriangle, Lock, Unlock } from "lucide-react";
import { format } from "date-fns";
import { useState, useCallback, useEffect } from "react";
import { EmailComposeDialog } from "./EmailComposeDialog";
import { EmailToLeadDialog } from "./EmailToLeadDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Email {
  id: string;
  account_id?: string;
  subject: string;
  from_email: string;
  from_name: string;
  body_text?: string;
  body_html?: string;
  body_encrypted?: string;
  received_at: string;
  is_starred: boolean;
  has_attachments: boolean;
  attachments?: any[];
  labels?: string[];
  snippet?: string;
  security_status?: 'pending' | 'scanning' | 'clean' | 'suspicious' | 'malicious';
  quarantine_reason?: string;
}

interface EmailDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: Email;
  onRefresh: () => void;
}

export function EmailDetailDialog({ open, onOpenChange, email, onRefresh }: EmailDetailDialogProps) {
  const [showReply, setShowReply] = useState(false);
  const [showFullBody, setShowFullBody] = useState(false);
  const [showFullDetails, setShowFullDetails] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showConvertToLead, setShowConvertToLead] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  
  // Phase 1: Zero-Trust Security State
  const [mfaRequired, setMfaRequired] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [decryptedBody, setDecryptedBody] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);

  useEffect(() => {
    checkSecurityRequirements();
  }, [email.id, email.account_id]);

  const checkSecurityRequirements = async () => {
    if (!email.account_id) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if this is a delegated access requiring MFA
      const { data: delegation } = await supabase
        .from('email_account_delegations')
        .select('requires_mfa')
        .eq('account_id', email.account_id)
        .eq('delegate_user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (delegation && delegation.requires_mfa) {
        setMfaRequired(true);
        // If MFA is required, lock the content initially unless we already have a secure session
        // For Phase 1, we aggressively lock to verify the flow
        setIsLocked(true);
      } else {
        setMfaRequired(false);
        setIsLocked(false);
      }
    } catch (error) {
      console.error("Failed to check security requirements", error);
    }
  };

  const handleUnlock = async () => {
    setIsDecrypting(true);
    try {
      // 1. Check AAL Level
      const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      
      if (data?.currentLevel !== 'aal2') {
        toast.error("Security Check Failed", {
          description: "This email requires 2-Factor Authentication. Please sign in with MFA."
        });
        // In a real app, we would redirect to MFA challenge here
        return;
      }

      // 2. Call Decryption RPC
      // Cast params to any to avoid type errors if RPC types aren't regenerated yet
      const { data: decryptedData, error } = await supabase.rpc('get_decrypted_email_body', {
        p_email_id: email.id
      } as any);

      if (error) throw error;

      if (decryptedData) {
        setDecryptedBody(decryptedData);
        setIsLocked(false);
        toast.success("Content Decrypted", { description: "Identity verified successfully." });
      }
    } catch (error: any) {
      console.error("Decryption failed:", error);
      toast.error("Access Denied", { description: error.message });
    } finally {
      setIsDecrypting(false);
    }
  };


  const scanEmail = async () => {
    try {
      setIsScanning(true);
      toast.info("Scanning email...", { description: "Please wait while we check for threats." });
      
      const { data, error } = await supabase.functions.invoke("email-scan", {
        body: { email_id: email.id },
      });

      if (error) throw error;
      
      toast(data?.scan_result?.security_status === 'clean' ? "Scan Complete: Clean" : "Scan Complete: Threat Detected", {
        description: `Status: ${data?.scan_result?.security_status || 'Unknown'}`,
        className: data?.scan_result?.security_status === 'clean' ? "" : "bg-destructive text-destructive-foreground"
      });
      
      onRefresh();
    } catch (error: any) {
      console.error('Scan failed:', error);
      toast.error("Scan Failed", { description: error.message });
    } finally {
      setIsScanning(false);
    }
  };
  
  const getSecurityIcon = () => {
    switch (email.security_status) {
      case 'clean': return <ShieldCheck className="w-4 h-4 text-green-500" />;
      case 'malicious': return <ShieldAlert className="w-4 h-4 text-red-500" />;
      case 'suspicious': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'scanning': return <Shield className="w-4 h-4 animate-pulse text-blue-500" />;
      default: return <Shield className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const handleDownload = useCallback(async (path: string, filename: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('email-attachments')
        .download(path);
      
      if (error) throw error;
      
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Download started");
    } catch (err: any) {
      console.error('Download failed:', err);
      toast.error("Download failed", {
        description: err.message || "Could not download attachment"
      });
    }
  }, []);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={`${expanded ? "max-w-[95vw] max-h-[95vh]" : "max-w-4xl max-h-[85vh]"} overflow-auto min-w-[320px] min-h-[320px] font-outlook`}
          style={{ resize: "both" }}
        >
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <DialogTitle className="text-2xl mb-2 break-words overflow-x-hidden">{email.subject}</DialogTitle>
                <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
                  <span className="font-medium">{email.from_name || email.from_email}</span>
                  <span>•</span>
                  <span>{format(new Date(email.received_at), "MMM d, yyyy 'at' h:mm a")}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)} title={expanded ? "Reduce view size" : "Enlarge view area"}>
                  {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={scanEmail}
                  disabled={isScanning || email.security_status === 'scanning'}
                  title={`Security Status: ${email.security_status || 'Unknown'} (Click to scan)`}
                >
                  {getSecurityIcon()}
                </Button>
                <Button variant="ghost" size="sm">
                  <Star className={`w-4 h-4 ${email.is_starred ? "fill-warning text-warning" : ""}`} />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowConvertToLead(true)} title="Convert to Lead">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Convert
                </Button>
              </div>
            </div>
          </DialogHeader>

          <Separator />

          {(email.security_status === 'malicious' || email.security_status === 'suspicious') && (
            <div className={`mx-6 mt-4 p-3 rounded-md border flex items-start gap-3 ${
              email.security_status === 'malicious' 
                ? "bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-900/50 dark:text-red-300" 
                : "bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-900/50 dark:text-yellow-300"
            }`}>
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-sm">
                  {email.security_status === 'malicious' ? "Threat Detected" : "Suspicious Content"}
                </h4>
                <p className="text-sm mt-1">
                  {email.quarantine_reason || "This email has been flagged by our security system."}
                </p>
              </div>
            </div>
          )}

          {email.labels && email.labels.length > 0 && (
            <div className={showFullDetails ? "flex gap-2 flex-wrap" : "relative max-h-12 overflow-hidden"}>
              <div className="flex gap-2 flex-wrap">
                {email.labels.map((label, idx) => (
                  <Badge key={idx} variant="outline">
                    {label}
                  </Badge>
                ))}
              </div>
              {!showFullDetails && (
                <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-background to-transparent" />
              )}
            </div>
          )}

          {email.labels && email.labels.length > 6 && (
            <div className="mt-2 flex justify-end">
              {showFullDetails ? (
                <Button variant="ghost" size="sm" onClick={() => setShowFullDetails(false)}>
                  <ChevronUp className="w-4 h-4" />
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setShowFullDetails(true)}>
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              )}
            </div>
          )}

          <div className={showFullBody ? "email-content prose prose-sm max-w-none break-words overflow-x-hidden" : "email-content prose prose-sm max-w-none break-words overflow-x-hidden relative"}>
            {isLocked ? (
              <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-muted rounded-lg bg-muted/10">
                <Lock className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Encrypted Content</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
                  This email is protected by Zero-Trust encryption. Multi-Factor Authentication (MFA) is required to decrypt and view the contents.
                </p>
                <Button onClick={handleUnlock} disabled={isDecrypting}>
                  {isDecrypting ? (
                    "Decrypting..."
                  ) : (
                    <>
                      <Unlock className="w-4 h-4 mr-2" />
                      Verify Identity & Decrypt
                    </>
                  )}
                </Button>
              </div>
            ) : decryptedBody ? (
               <div dangerouslySetInnerHTML={{ __html: decryptedBody }} />
            ) : !showFullBody ? (
              <div className="font-sans text-muted-foreground">
                {email.snippet || email.body_text?.slice(0, 300) || "No preview available"}
              </div>
            ) : email.body_html ? (
              <div dangerouslySetInnerHTML={{ __html: email.body_html }} />
            ) : email.body_text ? (
              <pre className="whitespace-pre-wrap font-sans break-words overflow-x-hidden">{email.body_text}</pre>
            ) : (
              <div className="italic text-muted-foreground">No content available</div>
            )}
            {!showFullBody && !isLocked && (
              <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-background to-transparent" />
            )}
          </div>

          <div className="mt-2 flex justify-end">
            {showFullBody ? (
              <Button variant="ghost" size="sm" onClick={() => setShowFullBody(false)}>
                <ChevronUp className="w-4 h-4" />
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setShowFullBody(true)}>
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            )}
          </div>

          {email.has_attachments && email.attachments && email.attachments.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Paperclip className="w-4 h-4" />
                  Attachments ({email.attachments.length})
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {email.attachments.map((attachment: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 p-2 border rounded-lg">
                      <Paperclip className="w-4 h-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{attachment.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(attachment.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDownload(attachment.path || attachment.url, attachment.name)}
                      >
                        Download
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button onClick={() => setShowReply(true)}>
                <Reply className="w-4 h-4 mr-2" />
                Reply
              </Button>
              <Button variant="outline">
                <Forward className="w-4 h-4 mr-2" />
                Forward
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Archive className="w-4 h-4 mr-2" />
                Archive
              </Button>
              <Button variant="outline" size="sm">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <EmailComposeDialog
        open={showReply}
        onOpenChange={setShowReply}
        replyTo={{
          to: email.from_email,
          subject: email.subject,
          body: email.body_text,
        }}
      />

      <EmailToLeadDialog
        open={showConvertToLead}
        onOpenChange={setShowConvertToLead}
        email={email}
        onSuccess={() => {
          // Optional: Maybe add a label or note that lead was created
          onRefresh();
        }}
      />
    </>
  );
}

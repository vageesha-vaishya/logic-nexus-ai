import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Reply, 
  Forward, 
  Archive, 
  Trash2, 
  Star, 
  Paperclip, 
  MoreHorizontal, 
  ChevronUp,
  Printer,
  FolderInput,
  UserPlus,
  ShieldAlert,
  Flame,
  Smile,
  Frown,
  Meh
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { EmailComposeDialog } from "./EmailComposeDialog";
import { EmailToLeadDialog } from "./EmailToLeadDialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

import { Email } from "@/types/email";

export interface EmailDetailViewProps {
  email: Email;
  thread?: Email[];
  onReply?: (email: Email) => void;
  onForward?: (email: Email) => void;
  onArchive?: (id: string) => void;
  onDelete?: (id: string) => void;
  onMove?: (id: string, folder: string) => void;
  customFolders?: string[];
}

function EmailMessage({ 
  email, 
  onReply, 
  onForward, 
  onArchive, 
  onDelete,
  onMove,
  customFolders = []
}: Omit<EmailDetailViewProps, 'thread'>) {
  const [showReply, setShowReply] = useState(false);
  const [showFullBody, setShowFullBody] = useState(false);
  const [showFullDetails, setShowFullDetails] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleConvertSuccess = (leadId?: string) => {
    if (leadId) {
      toast({
        title: "Lead Ready",
        description: "You can view the lead now.",
        action: (
          <ToastAction altText="View Lead" onClick={() => navigate(`/dashboard/leads/${leadId}`)}>
            View Lead
          </ToastAction>
        ),
      });
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Print Email - ${email.subject}</title>
            <style>
              body { font-family: sans-serif; padding: 20px; }
              .header { margin-bottom: 20px; border-bottom: 1px solid #ccc; padding-bottom: 10px; }
              .meta { color: #666; font-size: 0.9em; margin-bottom: 5px; }
              .body { white-space: pre-wrap; }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>${email.subject}</h2>
              <div class="meta">From: ${email.from_name || email.from_email}</div>
              <div class="meta">To: ${email.to_emails ? email.to_emails.join(', ') : 'Me'}</div>
              <div class="meta">Date: ${format(new Date(email.received_at), "PPpp")}</div>
            </div>
            <div class="body">
              ${email.body_html || email.body_text}
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  const handleDownload = async (path: string, filename: string) => {
    try {
      // If path starts with http/https, it's a public URL or already a full URL (legacy or external)
      if (path.startsWith('http')) {
        window.open(path, '_blank');
        return;
      }

      // Otherwise assume it's in the email-attachments bucket
      const { data, error } = await supabase.storage
        .from('email-attachments')
        .createSignedUrl(path, 60);

      if (error) throw error;

      // Create a temporary link to force download
      const link = document.createElement('a');
      link.href = data.signedUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error: any) {
      console.error("Download error:", error);
      toast({
        title: "Download Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const clampStyle = showFullBody
    ? {}
    : {
        display: "-webkit-box",
        WebkitLineClamp: 3,
        WebkitBoxOrient: "vertical" as const,
        overflow: "hidden",
      };

  return (
    <div className="w-full">
      {email.threat_level && email.threat_level !== 'safe' && (
        <Alert variant={email.threat_level === 'malicious' ? "destructive" : "default"} className={cn("mb-4", email.threat_level === 'suspicious' && "border-yellow-500 bg-yellow-50 text-yellow-900")}>
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle className="capitalize">{email.threat_level} Email Detected</AlertTitle>
          <AlertDescription>
            This email has been flagged as <strong>{email.threat_level}</strong> by our AI security system.
            {email.threat_score && ` (Threat Score: ${email.threat_score})`}
            {email.threat_details?.reasoning && (
              <div className="mt-1 text-xs opacity-90">
                Reason: {email.threat_details.reasoning}
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h2 className="text-2xl mb-2 break-words overflow-x-hidden">{email.subject}</h2>
          <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
            <span className="font-medium">{email.from_name || email.from_email}</span>
            <span>•</span>
            <span>{format(new Date(email.received_at), "MMM d, yyyy 'at' h:mm a")}</span>
            
            {email.ai_urgency && email.ai_urgency !== 'low' && (
              <Badge 
                variant="outline" 
                className={cn("text-[10px] h-4 px-1 ml-2", 
                  email.ai_urgency === 'high' ? "border-red-500 text-red-600 bg-red-50" : 
                  email.ai_urgency === 'medium' ? "border-orange-500 text-orange-600 bg-orange-50" : ""
                )}
              >
                <Flame className="h-3 w-3 mr-1" />
                {email.ai_urgency.charAt(0).toUpperCase() + email.ai_urgency.slice(1)}
              </Badge>
            )}
            
            {email.ai_sentiment && (
              <Badge 
                variant="outline" 
                className={cn("text-[10px] h-4 px-1", 
                  email.ai_sentiment === 'positive' ? "border-green-500 text-green-600 bg-green-50" : 
                  email.ai_sentiment === 'negative' ? "border-red-500 text-red-600 bg-red-50" : 
                  "border-gray-400 text-gray-600 bg-gray-50"
                )}
              >
                {email.ai_sentiment === 'positive' ? <Smile className="h-3 w-3 mr-1" /> :
                 email.ai_sentiment === 'negative' ? <Frown className="h-3 w-3 mr-1" /> :
                 <Meh className="h-3 w-3 mr-1" />}
                {email.ai_sentiment.charAt(0).toUpperCase() + email.ai_sentiment.slice(1)}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowConvert(true)} title="Convert to Lead">
            <UserPlus className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <Star className={`w-4 h-4 ${email.is_starred ? "fill-warning text-warning" : ""}`} />
          </Button>
        </div>
      </div>

      <Separator className="my-3" />

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
        {email.body_html ? (
          <div style={clampStyle} dangerouslySetInnerHTML={{ __html: email.body_html }} />
        ) : showFullBody ? (
          <pre className="whitespace-pre-wrap font-sans break-words overflow-x-hidden">{email.body_text}</pre>
        ) : (
          <div className="font-sans" style={{ whiteSpace: "pre-wrap", ...clampStyle }}>
            {email.body_text}
          </div>
        )}
        {!showFullBody && (
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
          <Separator className="my-3" />
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

      <Separator className="my-3" />

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button onClick={() => onReply ? onReply(email) : setShowReply(true)}>
            <Reply className="w-4 h-4 mr-2" />
            Reply
          </Button>
          <Button variant="outline" onClick={() => onForward ? onForward(email) : null}>
            <Forward className="w-4 h-4 mr-2" />
            Forward
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onArchive?.(email.id)}>
            <Archive className="w-4 h-4 mr-2" />
            Archive
          </Button>

          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <FolderInput className="w-4 h-4 mr-2" />
                Move to
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Move to folder</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onMove?.(email.id, 'inbox')}>
                Inbox
              </DropdownMenuItem>
              {customFolders.map(folder => (
                <DropdownMenuItem key={folder} onClick={() => onMove?.(email.id, folder)}>
                  {folder}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" onClick={() => onDelete?.(email.id)}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

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
        open={showConvert}
        onOpenChange={setShowConvert}
        email={email}
        onSuccess={handleConvertSuccess}
      />
    </div>
  );
}

export function EmailDetailView(props: EmailDetailViewProps) {
  const { thread, email, ...rest } = props;
  // If thread is provided and has items, use it. Otherwise use the single email.
  const emailsToRender = thread && thread.length > 0 ? thread : [email];

  return (
    <div className="h-full w-full overflow-auto p-4 space-y-8">
      {emailsToRender.map((e, index) => (
        <div key={e.id} className={index < emailsToRender.length - 1 ? "border-b-2 pb-6" : ""}>
          <EmailMessage email={e} {...rest} />
        </div>
      ))}
    </div>
  );
}

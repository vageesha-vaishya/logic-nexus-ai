import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Reply, Forward, Archive, Trash2, Star, Paperclip, MoreHorizontal, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { EmailComposeDialog } from "./EmailComposeDialog";

interface Email {
  id: string;
  subject: string;
  from_email: string;
  from_name: string;
  body_text?: string;
  body_html?: string;
  received_at: string;
  is_starred: boolean;
  has_attachments: boolean;
  attachments?: any[];
  labels?: string[];
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
  const clampStyle = showFullBody
    ? {}
    : {
        display: "-webkit-box",
        WebkitLineClamp: 3,
        WebkitBoxOrient: "vertical" as const,
        overflow: "hidden",
      };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
                <Button variant="ghost" size="sm">
                  <Star className={`w-4 h-4 ${email.is_starred ? "fill-warning text-warning" : ""}`} />
                </Button>
              </div>
            </div>
          </DialogHeader>

          <Separator />

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
                      <Button variant="ghost" size="sm">Download</Button>
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
    </>
  );
}

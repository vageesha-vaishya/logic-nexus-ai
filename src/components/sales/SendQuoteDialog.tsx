import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Mail, Loader2, Send, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { invokeFunction, invokeAnonymous, emitEvent, enrichPayload } from '@/lib/supabase-functions';
import { EmitEventSchema } from '@/lib/schemas/events';

interface SendQuoteDialogProps {
  quoteId: string;
  quoteNumber: string;
  versionId?: string; // Optional, if we want to send a specific version
  customerEmail?: string;
  onSuccess?: () => void;
}

export function SendQuoteDialog({ quoteId, quoteNumber, versionId, customerEmail, onSuccess }: SendQuoteDialogProps) {
  const [open, setOpen] = useState(false);
  const [recipient, setRecipient] = useState(customerEmail || '');
  const [subject, setSubject] = useState(`Quotation #${quoteNumber}`);
  const [message, setMessage] = useState(`Dear Customer,\n\nPlease find attached the quotation #${quoteNumber} for your review.\n\nBest regards,\nLogistics Team`);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!recipient) {
      toast.error('Recipient email is required');
      return;
    }

    setSending(true);
    const toastId = toast.loading('Generating PDF and sending email...');

    try {
      // 1. Generate PDF
      console.log('[SendQuote] Generating PDF...');
      // Use invokeAnonymous to avoid "Invalid JWT" errors if the session token is stale/invalid
      // The function uses Service Role internally, so it doesn't rely on the user's RLS context
      const pdfResponse = await invokeAnonymous('generate-quote-pdf', enrichPayload({
        quoteId, 
        versionId,
        engine_v2: true,
        source: 'send-email',
        action: 'generate-pdf'
      }));

      const pdfData = pdfResponse;

      if (!pdfData || !pdfData.content) {
        const issues = Array.isArray(pdfData?.issues) ? String(pdfData.issues.join('; ')) : null;
        if (issues) {
          throw new Error(issues);
        }
        throw new Error('PDF Generation returned no content');
      }

      // 2. Send Email
      console.log('[SendQuote] Sending email...');
      const { data: emailData, error: emailError } = await invokeFunction('send-email', {
        body: {
          to: recipient,
          subject: subject,
          text: message,
          html: `<p>${message.replace(/\n/g, '<br>')}</p>`,
          attachments: [
            {
              filename: `Quote-${quoteNumber}.pdf`,
              content: pdfData.content,
              encoding: 'base64',
              contentType: 'application/pdf'
            }
          ],
          source: 'send-email',
          action: 'dispatch-email'
        }
      });

      if (emailError) throw new Error(`Email sending failed: ${emailError.message}`);
      
      const evt = { eventName: 'EmailSent', payload: { quote_id: quoteId, version_id: versionId } };
      const parsed = EmitEventSchema.safeParse(evt);
      if (parsed.success) {
        await emitEvent(parsed.data.eventName, parsed.data.payload);
      }

      toast.success('Quote sent successfully', { id: toastId });
      setOpen(false);
      if (onSuccess) onSuccess();

    } catch (error: any) {
      console.error('[SendQuote] Error:', error);
      toast.error('Failed to send quote', { 
        id: toastId,
        description: error.message 
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" className="gap-2">
          <Mail className="h-4 w-4" />
          Send Quote
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Quote #{quoteNumber}</DialogTitle>
          <DialogDescription>
            Email this quotation to the customer. A PDF will be automatically attached.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="recipient">Recipient Email</Label>
            <Input 
              id="recipient" 
              placeholder="customer@example.com" 
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input 
              id="subject" 
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea 
              id="message" 
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 p-3 bg-muted rounded-md text-sm text-muted-foreground">
             <FileText className="h-4 w-4" />
             <span>Quote-{quoteNumber}.pdf will be attached</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

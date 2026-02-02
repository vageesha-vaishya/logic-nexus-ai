import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { 
  Loader2, 
  Send, 
  MessageSquare, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  FileText, 
  PenTool, 
  Download 
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { generateContractPDF, Clause } from '@/services/contractPdfService';
import { eSignatureService } from '@/services/eSignatureService';
import { Vendor, VendorContract } from '@/types/vendor';

interface Comment {
  id: string;
  user_id: string;
  comment: string;
  created_at: string;
  user_email?: string;
}

interface ContractManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: VendorContract | null;
  vendor: Vendor | null;
  onUpdate: () => void;
}

export function ContractManagementDialog({ open, onOpenChange, contract, vendor, onUpdate }: ContractManagementDialogProps) {
  const { supabase } = useCRM();
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [signatureStatus, setSignatureStatus] = useState(contract?.signature_status || 'pending');
  
  // Clause & PDF State
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [selectedClauses, setSelectedClauses] = useState<Set<string>>(new Set());
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    if (open && contract) {
      fetchComments();
      fetchClauses();
      setSignatureStatus(contract.signature_status || 'pending');
    }
  }, [open, contract]);

  const fetchComments = async () => {
    if (!contract) return;
    try {
      const { data, error } = await supabase
        .from('vendor_contract_comments')
        .select(`
          *,
          user:user_id (email)
        `)
        .eq('contract_id', contract.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      const formattedComments = data.map((c: any) => ({
        ...c,
        user_email: c.user?.email
      }));
      
      setComments(formattedComments);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const fetchClauses = async () => {
    try {
      const { data, error } = await supabase
        .from('contract_clauses')
        .select('*')
        .eq('is_active', true);
        
      if (error) throw error;
      setClauses(data || []);
    } catch (error) {
      console.error('Error fetching clauses:', error);
    }
  };

  const handleSendComment = async () => {
    if (!newComment.trim() || !contract) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('vendor_contract_comments')
        .insert([{
          contract_id: contract.id,
          user_id: user.id,
          comment: newComment
        }]);

      if (error) throw error;
      
      setNewComment('');
      fetchComments();
      toast.success('Comment added');
    } catch (error) {
      toast.error('Failed to add comment');
    }
  };

  const handleGeneratePDF = async () => {
    if (!contract || !vendor) return;
    setGeneratingPdf(true);
    try {
      const selectedClausesList = clauses.filter(c => selectedClauses.has(c.id));
      const doc = generateContractPDF(contract, vendor.name, selectedClausesList);
      doc.save(`${contract.title.replace(/\s+/g, '_')}_contract.pdf`);
      toast.success('Contract PDF generated successfully');
    } catch (error) {
      console.error(error);
      toast.error('Failed to generate PDF');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleSendForSignature = async () => {
    if (!contract || !vendor) return;
    setLoading(true);
    try {
      const email = vendor.contact_info.email || 'vendor@example.com';
      await eSignatureService.sendEnvelope(contract.id, email);
      setSignatureStatus('sent');
      toast.success(`Contract sent to ${email} for signature`);
      onUpdate();
    } catch (error) {
      toast.error('Failed to send contract');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateSigning = async () => {
    if (!contract || !vendor) return;
    setLoading(true);
    try {
      await eSignatureService.simulateSigning(contract.id, vendor.primary_contact || vendor.name);
      setSignatureStatus('signed');
      toast.success('Contract signed successfully (Simulation)');
      onUpdate();
    } catch (error) {
      toast.error('Failed to sign contract');
    } finally {
      setLoading(false);
    }
  };

  const toggleClause = (id: string) => {
    const newSelected = new Set(selectedClauses);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedClauses(newSelected);
  };

  if (!contract) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {contract.title}
            <Badge variant="outline">{contract.contract_number}</Badge>
            {signatureStatus === 'signed' && <Badge variant="default" className="bg-green-600">Signed</Badge>}
            {signatureStatus === 'sent' && <Badge variant="secondary" className="bg-blue-100 text-blue-800">Out for Signature</Badge>}
          </DialogTitle>
          <DialogDescription>
            Manage contract lifecycle, redlining, and execution.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="negotiation" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="negotiation">Negotiation & Comments</TabsTrigger>
            <TabsTrigger value="document">Document Generation</TabsTrigger>
            <TabsTrigger value="signature">e-Signature</TabsTrigger>
          </TabsList>

          {/* NEGOTIATION TAB */}
          <TabsContent value="negotiation" className="flex-1 flex flex-col min-h-0 mt-4">
            <ScrollArea className="flex-1 pr-4 border rounded-md p-4">
              {comments.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No comments yet. Start the negotiation.
                </div>
              ) : (
                <div className="space-y-4">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={`https://avatar.vercel.sh/${comment.user_email}`} />
                        <AvatarFallback>U</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{comment.user_email}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(comment.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mt-1">{comment.comment}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            <div className="pt-4 flex gap-2">
              <Input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment or redline note..."
                onKeyDown={(e) => e.key === 'Enter' && handleSendComment()}
              />
              <Button onClick={handleSendComment} size="icon">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </TabsContent>

          {/* DOCUMENT GENERATION TAB */}
          <TabsContent value="document" className="flex-1 overflow-auto mt-4 space-y-4">
            <div className="border rounded-md p-4">
              <h4 className="font-medium mb-4 flex items-center gap-2">
                <FileText className="h-4 w-4" /> Select Clauses to Include
              </h4>
              {clauses.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No clauses found in library. Add clauses via the Clause Library.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {clauses.map((clause) => (
                    <div key={clause.id} className="flex items-start space-x-2 border p-3 rounded hover:bg-slate-50">
                      <Checkbox 
                        id={clause.id} 
                        checked={selectedClauses.has(clause.id)}
                        onCheckedChange={() => toggleClause(clause.id)}
                      />
                      <div className="grid gap-1.5 leading-none">
                        <label
                          htmlFor={clause.id}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {clause.name}
                        </label>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {clause.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button onClick={handleGeneratePDF} disabled={generatingPdf}>
                {generatingPdf ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Generate Contract PDF
              </Button>
            </div>
          </TabsContent>

          {/* SIGNATURE TAB */}
          <TabsContent value="signature" className="flex-1 mt-4">
             <div className="border rounded-md p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium">Signature Status</h3>
                    <p className="text-sm text-muted-foreground">Current state of the contract envelope.</p>
                  </div>
                  <Badge className={`text-base px-4 py-1 ${
                    signatureStatus === 'signed' ? 'bg-green-600' : 
                    signatureStatus === 'sent' ? 'bg-blue-600' : 'bg-gray-500'
                  }`}>
                    {signatureStatus.toUpperCase()}
                  </Badge>
                </div>

                <Separator />

                <div className="space-y-4">
                  {signatureStatus === 'pending' && (
                    <div className="bg-blue-50 p-4 rounded-md flex items-start gap-3 text-blue-800">
                      <Clock className="h-5 w-5 mt-0.5" />
                      <div>
                        <h4 className="font-medium">Ready to Send</h4>
                        <p className="text-sm">Contract is drafted and ready for signature collection.</p>
                      </div>
                    </div>
                  )}

                  {signatureStatus === 'sent' && (
                    <div className="bg-yellow-50 p-4 rounded-md flex items-start gap-3 text-yellow-800">
                      <Send className="h-5 w-5 mt-0.5" />
                      <div>
                        <h4 className="font-medium">Awaiting Signature</h4>
                        <p className="text-sm">Envelope sent to {vendor?.contact_info?.email || 'Vendor'}. Waiting for response.</p>
                      </div>
                    </div>
                  )}

                  {signatureStatus === 'signed' && (
                    <div className="bg-green-50 p-4 rounded-md flex items-start gap-3 text-green-800">
                      <CheckCircle2 className="h-5 w-5 mt-0.5" />
                      <div>
                        <h4 className="font-medium">Fully Executed</h4>
                        <p className="text-sm">Contract signed by {contract.signed_by || 'Vendor'} on {contract.signed_at ? new Date(contract.signed_at).toLocaleDateString() : 'Unknown date'}.</p>
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Actions</h4>
                  <div className="flex gap-3">
                    <Button 
                      onClick={handleSendForSignature} 
                      disabled={loading || signatureStatus !== 'pending'}
                      className="flex-1"
                    >
                      <Send className="mr-2 h-4 w-4" /> Send for Signature
                    </Button>
                    
                    <Button 
                      onClick={handleSimulateSigning} 
                      disabled={loading || signatureStatus === 'signed'}
                      variant="outline"
                      className="flex-1 border-dashed border-blue-400 text-blue-600 hover:bg-blue-50"
                    >
                      <PenTool className="mr-2 h-4 w-4" /> Simulate Vendor Sign
                    </Button>
                  </div>
                  <p className="text-xs text-center text-muted-foreground mt-2">
                    * "Simulate Vendor Sign" is a development tool to bypass the email workflow.
                  </p>
                </div>
             </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

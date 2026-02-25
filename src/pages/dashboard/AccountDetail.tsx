import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { UnifiedPartnerForm } from '@/components/crm/UnifiedPartnerForm';
import { Edit, Trash2, Building2, Phone, Mail, Globe, Star, MoreHorizontal, DollarSign, FileText, Calendar } from 'lucide-react';
import { invokeFunction } from '@/lib/supabase-functions';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { 
    EnterpriseSheet, 
    EnterpriseField, 
    EnterpriseStatButton 
} from '@/components/ui/enterprise/EnterpriseComponents';
import { EnterpriseFormLayout } from '@/components/ui/enterprise/EnterpriseFormLayout';
import { EnterpriseNotebook, EnterpriseTab } from '@/components/ui/enterprise/EnterpriseTabs';
import { EnterpriseActivityFeed } from '@/components/ui/enterprise/EnterpriseActivityFeed';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

export default function AccountDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { context, scopedDb } = useCRM();
  const [account, setAccount] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [relatedContacts, setRelatedContacts] = useState<any[]>([]);
  const [relatedOpps, setRelatedOpps] = useState<any[]>([]);
  const [isEnriching, setIsEnriching] = useState(false);

  useEffect(() => {
    if (id) fetchAccount();
  }, [id]);

  const fetchAccount = async () => {
    try {
      const { data, error } = await scopedDb
        .from('accounts')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      setAccount(data);
      
      await Promise.all([
        fetchRelatedContacts(id as string),
        fetchRelatedOpportunities(id as string),
      ]);
    } catch (error: any) {
      toast.error('Failed to load account');
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatedContacts = async (accountId: string) => {
    try {
      const { data } = await scopedDb
        .from('contacts')
        .select('id, first_name, last_name, email, phone, title')
        .eq('account_id', accountId)
        .limit(10);
      setRelatedContacts(data || []);
    } catch (err) {
      console.error('Failed to load related contacts', err);
    }
  };

  const fetchRelatedOpportunities = async (accountId: string) => {
    try {
      const { data } = await scopedDb
        .from('opportunities')
        .select('id, name, stage, amount')
        .eq('account_id', accountId);
      setRelatedOpps(data || []);
    } catch (err) {
      console.error('Failed to load related opportunities', err);
    }
  };

  const handleUpdate = async (formData: any) => {
    try {
        // Flatten address object if present
        const updateData = { ...formData };
        if (formData.address) {
            updateData.billing_street = formData.address.street;
            updateData.billing_city = formData.address.city;
            updateData.billing_state = formData.address.state;
            updateData.billing_postal_code = formData.address.postal_code;
            updateData.billing_country = formData.address.country;
            delete updateData.address;
        }
        // Remove form-specific fields
        delete updateData.type;

        const { error } = await scopedDb.from('accounts').update(updateData).eq('id', id);
        if (error) throw error;
        toast.success('Account updated');
        setIsEditing(false);
        fetchAccount();
    } catch (e) {
        toast.error('Update failed');
    }
  };

  const handleDelete = async () => {
     try {
         await scopedDb.from('accounts').delete().eq('id', id);
         navigate('/dashboard/accounts');
     } catch (e) {
         toast.error('Delete failed');
     }
  };
  
  const handleEnrich = async () => {
      setIsEnriching(true);
      // Simulate enrichment for now
      setTimeout(() => {
          setIsEnriching(false);
          toast.success('Enrichment complete');
      }, 1000);
  };

  if (loading || !account) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  // Calculate stats
  const totalOppValue = relatedOpps.reduce((sum, opp) => sum + (opp.amount || 0), 0);

  return (
    <div className="h-screen w-full bg-[#f9fafb] overflow-hidden">
        <EnterpriseFormLayout 
            title={account.name}
            breadcrumbs={[
                { label: 'Accounts', to: '/dashboard/accounts' },
                { label: account.name },
            ]}
            status={account.status}
            actions={
                !isEditing && (
                    <div className="flex items-center gap-2">
                        <Button 
                            variant="outline" 
                            className="h-8 border-[#714B67] text-[#714B67] hover:bg-[#714B67]/10"
                            onClick={() => setIsEditing(true)}
                        >
                            Edit
                        </Button>
                        <Button 
                            variant="outline" 
                            className="h-8 text-gray-600"
                            onClick={() => navigate('/dashboard/accounts/new')}
                        >
                            Create
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-8 w-8 text-gray-500"
                            onClick={() => setShowDeleteDialog(true)}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                )
            }
        >
                {/* Main Sheet */}
                <EnterpriseSheet
                    smartButtons={
                        !isEditing && (
                            <>
                                <EnterpriseStatButton 
                                    icon={<DollarSign className="h-5 w-5" />}
                                    label="Opportunity"
                                    value={relatedOpps.length}
                                />
                                <EnterpriseStatButton 
                                    icon={<FileText className="h-5 w-5" />}
                                    label="Invoiced"
                                    value="$0.00"
                                />
                            </>
                        )
                    }
                    header={
                        !isEditing && (
                            <div className="flex flex-col md:flex-row gap-6 w-full">
                                {/* Logo / Image */}
                                <div className="w-24 h-24 bg-muted rounded-sm flex items-center justify-center border shadow-sm shrink-0">
                                    {account.logo_url ? (
                                        <img src={account.logo_url} alt="Logo" className="w-full h-full object-contain" />
                                    ) : (
                                        <Building2 className="h-10 w-10 text-muted-foreground/50" />
                                    )}
                                </div>

                                <div className="flex-1 flex flex-col gap-4">
                                    {/* Title Section */}
                                    <div>
                                        <div className="flex items-center gap-6 mb-2">
                                            <div className="flex items-center gap-2">
                                                <input type="radio" checked={account.account_type !== 'individual'} readOnly className="accent-[#714B67] h-4 w-4" />
                                                <span className="text-sm font-semibold text-gray-700">Company</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input type="radio" checked={account.account_type === 'individual'} readOnly className="accent-[#714B67] h-4 w-4" />
                                                <span className="text-sm font-semibold text-gray-700">Individual</span>
                                            </div>
                                        </div>
                                        <h1 className="text-3xl font-bold text-gray-900">{account.name}</h1>
                                    </div>
                                    
                                    {/* Address & Metadata Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4 mt-2">
                                        {/* Left Column: Address/Contact */}
                                        <div className="space-y-4">
                                            <div className="text-[13px] text-gray-900 font-normal leading-relaxed">
                                                <div className="flex gap-8 mb-1">
                                                    <span className="font-bold min-w-[60px]">Address</span>
                                                    <div className="flex flex-col">
                                                        <span>{account.billing_street || 'Street...'}</span>
                                                        <span>{account.billing_city} {account.billing_state} {account.billing_postal_code}</span>
                                                        <span>{account.billing_country || 'United States'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {account.email && (
                                                <div className="flex items-center gap-2 text-[13px]">
                                                    <Mail className="h-3.5 w-3.5 text-gray-500" />
                                                    <a href={`mailto:${account.email}`} className="text-[#714B67] hover:underline font-medium">{account.email}</a>
                                                </div>
                                            )}
                                            {account.phone && (
                                                <div className="flex items-center gap-2 text-[13px]">
                                                    <Phone className="h-3.5 w-3.5 text-gray-500" />
                                                    <span className="text-gray-700">{account.phone}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Right Column: Metadata */}
                                        <div className="space-y-1">
                                            <EnterpriseField label="VAT" value={account.vat_number} />
                                            <EnterpriseField label="Website" value={
                                                account.website ? (
                                                    <a href={account.website} target="_blank" className="text-[#714B67] hover:underline">{account.website}</a>
                                                ) : null
                                            } />
                                            <EnterpriseField label="Tags" value={
                                                <div className="flex gap-1 flex-wrap">
                                                    {account.account_type && <Badge variant="secondary" className="rounded-full px-2 font-normal bg-green-100 text-green-800 hover:bg-green-200">{account.account_type}</Badge>}
                                                    {account.status && <Badge variant="outline" className="rounded-full px-2 font-normal">{account.status}</Badge>}
                                                </div>
                                            } />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    }
                >
                    {isEditing ? (
                        <UnifiedPartnerForm 
                            initialData={account} 
                            entityType="account"
                            mode="edit"
                            onSubmit={handleUpdate} 
                            onCancel={() => setIsEditing(false)} 
                        />
                    ) : (
                        <EnterpriseNotebook>
                            <EnterpriseTab label="Contacts" value="contacts">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {relatedContacts.map((contact) => (
                                        <Card key={contact.id} className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/dashboard/contacts/${contact.id}`)}>
                                            <div className="flex p-3 gap-3">
                                                <Avatar className="h-12 w-12 rounded-lg">
                                                    <AvatarFallback className="rounded-lg bg-primary/10 text-primary">
                                                        {contact.first_name[0]}{contact.last_name[0]}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="overflow-hidden">
                                                    <p className="font-semibold truncate">{contact.first_name} {contact.last_name}</p>
                                                    <p className="text-xs text-muted-foreground truncate">{contact.title}</p>
                                                    {contact.email && (
                                                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                                            <Mail className="h-3 w-3" />
                                                            <span className="truncate">{contact.email}</span>
                                                        </div>
                                                    )}
                                                    {contact.phone && (
                                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                            <Phone className="h-3 w-3" />
                                                            <span className="truncate">{contact.phone}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </Card>
                                    ))}
                                    {/* Add Contact Ghost Card */}
                                    <Button variant="outline" className="h-full min-h-[80px] border-dashed flex flex-col gap-2 hover:bg-muted/10" onClick={() => navigate('/dashboard/contacts/new')}>
                                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                                            <PlusIcon className="h-4 w-4" />
                                        </div>
                                        Add Contact
                                    </Button>
                                </div>
                            </EnterpriseTab>
                            
                            <EnterpriseTab label="Sales & Purchase" value="sales">
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-sm font-semibold mb-3">Opportunities</h3>
                                        {relatedOpps.length > 0 ? (
                                            <div className="space-y-2">
                                                {relatedOpps.map(opp => (
                                                    <div key={opp.id} className="flex items-center justify-between p-3 border rounded-lg bg-white">
                                                        <div className="font-medium">{opp.name}</div>
                                                        <div className="flex items-center gap-3">
                                                            <Badge>{opp.stage}</Badge>
                                                            <span className="text-sm font-mono">${opp.amount?.toLocaleString()}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-muted-foreground italic">No opportunities found.</p>
                                        )}
                                    </div>
                                </div>
                            </EnterpriseTab>

                            <EnterpriseTab label="Internal Notes" value="notes">
                                <div className="min-h-[200px] p-4 bg-muted/10 rounded-lg border border-dashed">
                                    <p className="text-sm whitespace-pre-wrap">{account.description || 'No internal notes.'}</p>
                                </div>
                            </EnterpriseTab>

                            <EnterpriseTab label="Emails" value="emails">
                                <div className="min-h-[300px] flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg bg-muted/5">
                                    <p>Email integration coming soon in Enterprise view.</p>
                                </div>
                            </EnterpriseTab>
                        </EnterpriseNotebook>
                    )}
                </EnterpriseSheet>

                {/* Chatter Sidebar */}
                <EnterpriseActivityFeed className="hidden xl:flex shrink-0 w-[400px]" />
            </EnterpriseFormLayout>
        
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Account?</AlertDialogTitle>
                    <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive">Delete</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}

function PlusIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M5 12h14" />
            <path d="M12 5v14" />
        </svg>
    )
}

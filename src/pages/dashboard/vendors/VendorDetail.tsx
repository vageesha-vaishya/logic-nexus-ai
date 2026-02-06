import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { cn, formatCurrency } from '@/lib/utils';
import { useCRM } from '@/hooks/useCRM';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { VendorForm } from '@/components/logistics/VendorForm';
import { ArrowLeft, FileText, Shield, Activity, Truck, Building, Download, Plus, AlertTriangle, Search, Eye, Folder, Tag, Edit, Trash, Upload, Check, X, History as HistoryIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Vendor, VendorContract, VendorDocument, VendorPerformanceReview, VendorRiskAssessment, VendorFolder } from '@/types/vendor';
import { logger } from '@/lib/logger';
import { auditLogger } from '@/lib/audit';
import { VendorStatusBadge } from './components/VendorStatusBadge';
import { VendorPreferredCarriers } from "./components/VendorPreferredCarriers";
import { RiskBadge } from './components/RiskBadge';
import { VendorContractDialog } from './components/VendorContractDialog';
import { VendorDocumentDialog } from './components/VendorDocumentDialog';
import { VendorFolderDialog } from './components/VendorFolderDialog';
import { VendorRiskDialog } from './components/VendorRiskDialog';
import { VendorPerformanceDialog } from './components/VendorPerformanceDialog';
import { VendorFolderSidebar } from './components/VendorFolderSidebar';
import { VendorPerformanceScorecard } from './components/VendorPerformanceScorecard';
import { VendorContractVersionDialog } from './components/VendorContractVersionDialog';
import { VendorDocumentVersionDialog } from './components/VendorDocumentVersionDialog';
import { ContractManagementDialog } from './components/ContractManagementDialog';
import { VendorMoveDocumentDialog } from './components/VendorMoveDocumentDialog';
import { VendorCompliance } from './components/VendorCompliance';
import { FilePreviewDialog } from '@/components/common/FilePreviewDialog';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import JSZip from 'jszip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

export default function VendorDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { supabase } = useCRM();
  const { roles, hasRole } = useAuth();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [contracts, setContracts] = useState<VendorContract[]>([]);
  const [documents, setDocuments] = useState<VendorDocument[]>([]);
  const [reviews, setReviews] = useState<VendorPerformanceReview[]>([]);
  const [riskAssessment, setRiskAssessment] = useState<VendorRiskAssessment | null>(null);
  const [financials, setFinancials] = useState<{
    totalSpend: number;
    recentCharges: any[];
    serviceRates: any[];
  } | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<any>(null);
  const [performanceHistory, setPerformanceHistory] = useState<any[]>([]);
  const [folders, setFolders] = useState<VendorFolder[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string>('All');

  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [contractManagementOpen, setContractManagementOpen] = useState(false);
  const [selectedContractForManagement, setSelectedContractForManagement] = useState<VendorContract | null>(null);
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);
  const [docVersionDialogOpen, setDocVersionDialogOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<VendorContract | null>(null);
  const [selectedDocForVersion, setSelectedDocForVersion] = useState<VendorDocument | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<any>(null);
  const [riskDialogOpen, setRiskDialogOpen] = useState(false);
  const [performanceDialogOpen, setPerformanceDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ name: string; url: string | null; mimeType?: string } | null>(null);
  const [docSearch, setDocSearch] = useState('');
  const [contractSearch, setContractSearch] = useState('');
  
  // Bulk Actions State
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);

  const checkFolderPermission = (folder: VendorFolder, type: 'read' | 'write') => {
    if (!folder.permissions || !folder.permissions[type]) return true;
    const requiredRoles = folder.permissions[type] as string[];
    if (requiredRoles.includes('*')) return true;
    // roles is UserRole[] (objects with role property), check if any of the user's roles match the required roles
    return roles.some(r => requiredRoles.includes(r.role));
  };

  const visibleFolders = folders.filter(f => checkFolderPermission(f, 'read'));

  // Filter documents based on visible folders (security)
  const accessibleDocuments = documents.filter(doc => {
      if (!doc.folder_id) return true; // Unfiled docs visible to all? Or should be restricted?
      // Find folder
      const folder = folders.find(f => f.id === doc.folder_id);
      if (!folder) return true; 
      return checkFolderPermission(folder, 'read');
  });

  const filteredDocuments = accessibleDocuments.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(docSearch.toLowerCase()) || 
                          doc.type.toLowerCase().includes(docSearch.toLowerCase()) ||
                          (doc.tags && doc.tags.some(tag => tag.toLowerCase().includes(docSearch.toLowerCase())));
    const matchesFolder = currentFolder === 'All' || doc.folder === currentFolder;
    return matchesSearch && matchesFolder;
  });

  const toggleSelectAll = () => {
    if (selectedDocs.size === filteredDocuments.length) {
      setSelectedDocs(new Set());
    } else {
      setSelectedDocs(new Set(filteredDocuments.map(d => d.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const newSelected = new Set(selectedDocs);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedDocs(newSelected);
  };

  const downloadDocuments = async (docsToDownload: any[]) => {
    setIsBulkDownloading(true);
    const toastId = toast.loading('Preparing zip file...');

    try {
      const zip = new JSZip();
      
      let processed = 0;
      for (const doc of docsToDownload) {
        try {
          if (!doc.file_path) continue;
          
          // Get signed URL
          const { data, error } = await supabase.storage
            .from('vendor-documents')
            .createSignedUrl(doc.file_path, 3600);
          
          if (error || !data?.signedUrl) throw new Error('Failed to get URL');

          // Fetch file content
          const response = await fetch(data.signedUrl);
          const blob = await response.blob();
          
          zip.file(doc.name, blob);
          processed++;
        } catch (err) {
          console.error(`Failed to download ${doc.name}:`, err);
        }
      }

      if (processed === 0) {
        throw new Error('No files could be downloaded');
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `documents_export_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      await auditLogger.log({
        action: 'BULK_DOWNLOAD_DOCUMENTS',
        resource_type: 'vendor_document',
        resource_id: id || 'unknown',
        details: { count: processed, vendor_id: id }
      });

      toast.success(`Downloaded ${processed} documents`);
    } catch (error) {
      console.error('Bulk download error:', error);
      toast.error('Failed to create zip file');
    } finally {
      setIsBulkDownloading(false);
      toast.dismiss(toastId);
    }
  };

  const handleBulkDownload = async () => {
    if (selectedDocs.size === 0) return;
    const docsToDownload = documents.filter(d => selectedDocs.has(d.id));
    await downloadDocuments(docsToDownload);
  };

  const handleDownloadAll = async () => {
    if (documents.length === 0) {
        toast.error('No documents to download');
        return;
    }
    await downloadDocuments(documents);
  };

  const handleBulkDelete = async () => {
    if (selectedDocs.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedDocs.size} documents? This action cannot be undone.`)) return;

    const toastId = toast.loading('Deleting documents...');
    try {
      const docsToDelete = documents.filter(d => selectedDocs.has(d.id));
      const paths = docsToDelete.map(d => d.file_path);
      const ids = docsToDelete.map(d => d.id);

      // Delete from Storage
      const { error: storageError } = await supabase.storage
        .from('vendor-documents')
        .remove(paths);
      
      if (storageError) throw storageError;

      // Delete from DB
      const { error: dbError } = await supabase
        .from('vendor_documents')
        .delete()
        .in('id', ids);

      if (dbError) throw dbError;

      // Audit Log
      await auditLogger.log({
        action: 'BULK_DELETE_DOCUMENTS',
        resource_type: 'vendor_document',
        resource_id: id || 'unknown',
        details: { count: ids.length, vendor_id: id }
      });

      toast.success('Documents deleted successfully');
      setSelectedDocs(new Set());
      fetchVendorDetails();
    } catch (error) {
      console.error('Bulk delete error:', error);
      toast.error('Failed to delete documents');
    } finally {
      toast.dismiss(toastId);
    }
  };

  const filteredContracts = contracts.filter(contract => {
     const matchesSearch = contract.title.toLowerCase().includes(contractSearch.toLowerCase()) ||
                           (contract.contract_number && contract.contract_number.toLowerCase().includes(contractSearch.toLowerCase())) ||
                           (contract.tags && contract.tags.some(tag => tag.toLowerCase().includes(contractSearch.toLowerCase())));
     // Also check folder permission for contracts
     let hasAccess = true;
     if (contract.folder_id) {
         const folder = folders.find(f => f.id === contract.folder_id);
         if (folder) hasAccess = checkFolderPermission(folder, 'read');
     }
     
     // Contracts might not have folder field populated correctly in UI logic yet if we just rely on folder_id
     // But let's assume matchesFolder logic
     const matchesFolder = currentFolder === 'All' || contract.folder === currentFolder;
     return matchesSearch && matchesFolder && hasAccess;
  });

  const handleSubmitForApproval = async () => {
    try {
        const { error } = await supabase.from('vendors').update({ onboarding_status: 'in_review' }).eq('id', id);
        if (error) throw error;
        
        await auditLogger.log({
            action: 'SUBMIT_VENDOR_APPROVAL',
            resource_type: 'vendor',
            resource_id: id!,
            details: { vendor_id: id, old_status: vendor?.onboarding_status, new_status: 'in_review' }
        });

        toast.success('Submitted for approval');
        fetchVendorDetails();
    } catch(e: any) { toast.error(e.message); }
  };

  const handleApproveVendor = async () => {
      try {
        const { error } = await supabase.from('vendors').update({ onboarding_status: 'approved', status: 'active' }).eq('id', id);
        if (error) throw error;

        await auditLogger.log({
            action: 'APPROVE_VENDOR',
            resource_type: 'vendor',
            resource_id: id!,
            details: { vendor_id: id, old_status: vendor?.onboarding_status, new_status: 'approved' }
        });

        toast.success('Vendor approved');
        fetchVendorDetails();
    } catch(e: any) { toast.error(e.message); }
  };

  const handleRejectVendor = async () => {
      if (!confirm('Are you sure you want to reject this vendor?')) return;
      try {
        const { error } = await supabase.from('vendors').update({ onboarding_status: 'rejected' }).eq('id', id);
        if (error) throw error;

        await auditLogger.log({
            action: 'REJECT_VENDOR',
            resource_type: 'vendor',
            resource_id: id!,
            details: { vendor_id: id, old_status: vendor?.onboarding_status, new_status: 'rejected' }
        });

        toast.success('Vendor rejected');
        fetchVendorDetails();
    } catch(e: any) { toast.error(e.message); }
  };

  const handleRefreshScore = async () => {
    try {
        const toastId = toast.loading('Calculating score...');
        const { error } = await supabase.rpc('calculate_vendor_score', { p_vendor_id: id });
        if (error) throw error;
        
        toast.success('Score updated');
        fetchVendorDetails();
    } catch (e: any) {
        console.error('Error refreshing score:', e);
        toast.error('Failed to calculate score');
    } finally {
        toast.dismiss();
    }
  };

  useEffect(() => {
    if (id) {
      fetchVendorDetails();
    }
  }, [id]);

  const fetchVendorDetails = async () => {
    setLoading(true);
    try {
      // Fetch Vendor Basic Info
      const { data: vendorData, error: vendorError } = await supabase
        .from('vendors')
        .select('*')
        .eq('id', id)
        .single();
      
      if (vendorError) throw vendorError;
      setVendor(vendorData as Vendor);

      // Fetch Related Data (Parallel)
      const [contractsRes, docsRes, reviewsRes, riskRes, chargesRes, serviceRatesRes, foldersRes, metricsRes, historyRes] = await Promise.all([
        supabase.from('vendor_contracts').select('*').eq('vendor_id', id).order('start_date', { ascending: false }),
        supabase.from('vendor_documents').select('*').eq('vendor_id', id).order('created_at', { ascending: false }),
        supabase.from('vendor_performance_reviews').select('*').eq('vendor_id', id).order('review_period_end', { ascending: false }),
        supabase.from('vendor_risk_assessments').select('*').eq('vendor_id', id).order('assessment_date', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('quote_charges').select('amount, currency_id, created_at').eq('vendor_id', id).order('created_at', { ascending: false }).limit(50),
        supabase.from('service_vendors').select('*, service:services(name, code)').eq('vendor_id', id),
        supabase.from('vendor_folders').select('*').eq('vendor_id', id).order('name'),
        supabase.from('vendor_performance_metrics').select('*').eq('vendor_id', id).order('snapshot_date', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('vendor_performance_metrics').select('*').eq('vendor_id', id).order('snapshot_date', { ascending: true }).limit(90)
      ]);

      if (contractsRes.data) setContracts(contractsRes.data as VendorContract[]);
      if (docsRes.data) setDocuments(docsRes.data as VendorDocument[]);
      if (reviewsRes.data) setReviews(reviewsRes.data as VendorPerformanceReview[]);
      if (riskRes.data) setRiskAssessment(riskRes.data as VendorRiskAssessment);
      if (foldersRes.data) setFolders(foldersRes.data);
      if (metricsRes.data) setPerformanceMetrics(metricsRes.data);
      if (historyRes.data) setPerformanceHistory(historyRes.data);

      // Process Financials
      if (chargesRes.data || serviceRatesRes.data) {
        const charges = chargesRes.data || [];
        const totalSpend = charges.reduce((sum, c) => sum + (c.amount || 0), 0);
        setFinancials({
            totalSpend,
            recentCharges: charges,
            serviceRates: serviceRatesRes.data || []
        });
      }

    } catch (error: any) {
      console.error('Error fetching vendor details:', error);
      toast.error('Failed to load vendor details');
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewDocument = async (doc: VendorDocument | any) => {
    // Audit Log View
    auditLogger.log({
        action: 'VIEW_DOCUMENT',
        resource_type: 'vendor_document',
        resource_id: doc.id,
        details: { vendor_id: id, document_name: doc.name }
    }).catch(console.error);

    try {
      let url = doc.url;
      if (doc.file_path) {
        const { data, error } = await supabase.storage
          .from('vendor-documents')
          .createSignedUrl(doc.file_path, 3600);
        
        if (error) throw error;
        url = data?.signedUrl;
      }

      if (url) {
        setPreviewFile({
          name: doc.name || doc.file_name || 'Document',
          url,
          mimeType: doc.mime_type
        });
        setPreviewOpen(true);
      } else {
        toast.info('No file or URL to preview');
      }
    } catch (error: any) {
      console.error('Error previewing document:', error);
      toast.error('Failed to preview document');
    }
  };

  const handleDownloadDocument = async (doc: any) => {
    // Audit Log Download
    auditLogger.log({
        action: 'DOWNLOAD_DOCUMENT',
        resource_type: 'vendor_document',
        resource_id: doc.id,
        details: { vendor_id: id, document_name: doc.name }
    }).catch(console.error);

    try {
      if (doc.file_path) {
        const { data, error } = await supabase.storage
          .from('vendor-documents')
          .createSignedUrl(doc.file_path, 3600); // 1 hour

        if (error) throw error;
        if (data?.signedUrl) {
           window.open(data.signedUrl, '_blank');
        }
      } else if (doc.url) {
        window.open(doc.url, '_blank');
      } else {
        toast.info('No file or URL attached to this document');
      }
    } catch (error: any) {
      console.error('Error downloading document:', error);
      toast.error('Failed to access document');
    }
  };

  const handleDeleteDocument = async (doc: any) => {
    if (!confirm(`Are you sure you want to delete "${doc.name}"?`)) return;

    try {
      // 1. Delete file from storage if exists
      if (doc.file_path) {
        const { error: storageError } = await supabase.storage
          .from('vendor-documents')
          .remove([doc.file_path]);
        
        if (storageError) console.error('Error deleting file from storage:', storageError);
      }

      // 2. Delete record from DB
      const { error } = await supabase
        .from('vendor_documents')
        .delete()
        .eq('id', doc.id);

      if (error) throw error;

      toast.success('Document deleted');
      
      await auditLogger.log({
        action: 'DELETE_DOCUMENT',
        resource_type: 'vendor_document',
        resource_id: doc.id,
        details: {
          vendor_id: id,
          document_name: doc.name,
          file_path: doc.file_path
        }
      });

      fetchVendorDetails();
    } catch (error: any) {
      console.error('Error deleting document:', error);
      toast.error('Failed to delete document');
    }
  };

  const handleViewContract = async (contractId: string) => {
    try {
      // Fetch latest version
      const { data: versions, error } = await supabase
        .from('vendor_contract_versions')
        .select('*')
        .eq('contract_id', contractId)
        .order('version_number', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (versions && versions.length > 0) {
         // Use preview
         handlePreviewDocument({
            ...versions[0],
            name: versions[0].file_name
         });
      } else {
        toast.info('No file attached to this contract');
      }
    } catch (error: any) {
      console.error('Error viewing contract:', error);
      toast.error('Failed to access contract file');
    }
  };

  const handleManageContract = (contract: VendorContract) => {
    setSelectedContractForManagement(contract);
    setContractManagementOpen(true);
  };

  const handleUploadVersion = (contract: VendorContract) => {
    setSelectedContract(contract);
    setVersionDialogOpen(true);
  };

  const handleDocumentVersions = (doc: VendorDocument) => {
    setSelectedDocForVersion(doc);
    setDocVersionDialogOpen(true);
  };

  const handleCreateFolder = () => {
    setEditingFolder(null);
    setFolderDialogOpen(true);
  };

  const handleEditFolder = (folder: VendorFolder) => {
    setEditingFolder(folder);
    setFolderDialogOpen(true);
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm('Are you sure you want to delete this folder? Documents inside will be moved to General.')) return;
    
    try {
      const { error } = await supabase.from('vendor_folders').delete().eq('id', folderId);
      if (error) throw error;
      
      toast.success('Folder deleted');
      
      // Legacy logger
      logger.info(`Folder deleted: ${folderId}`, {
        type: 'AUDIT',
        action: 'DELETE_FOLDER',
        vendor_id: id,
        folder_id: folderId
      });

      // New Audit Logger
      await auditLogger.log({
        action: 'DELETE_FOLDER',
        resource_type: 'vendor_folder',
        resource_id: folderId,
        details: {
          vendor_id: id,
          folder_id: folderId
        }
      });

      fetchVendorDetails();
    } catch (error: any) {
      console.error('Error deleting folder:', error);
      toast.error('Failed to delete folder');
    }
  };

  const handleVerifyDocument = async (doc: any) => {
    try {
      const { error } = await supabase
        .from('vendor_documents')
        .update({ 
          status: 'verified',
          verified_at: new Date().toISOString(),
          verified_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', doc.id);

      if (error) throw error;
      toast.success('Document verified');
      
      await auditLogger.log({
        action: 'VERIFY_DOCUMENT',
        resource_type: 'vendor_document',
        resource_id: doc.id,
        details: { vendor_id: id, document_name: doc.name }
      });

      fetchVendorDetails();
    } catch (error: any) {
      console.error('Error verifying document:', error);
      toast.error('Failed to verify document');
    }
  };

  const handleRejectDocument = async (doc: any) => {
    try {
      const { error } = await supabase
        .from('vendor_documents')
        .update({ status: 'rejected' })
        .eq('id', doc.id);

      if (error) throw error;
      toast.success('Document rejected');
      
      await auditLogger.log({
        action: 'REJECT_DOCUMENT',
        resource_type: 'vendor_document',
        resource_id: doc.id,
        details: { vendor_id: id, document_name: doc.name }
      });

      fetchVendorDetails();
    } catch (error: any) {
      console.error('Error rejecting document:', error);
      toast.error('Failed to reject document');
    }
  };

  const expiringContracts = contracts.filter(c => {
    if (c.status !== 'active' || !c.end_date) return false;
    const days = Math.ceil((new Date(c.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return days >= 0 && days <= 30;
  });

  const expiringDocuments = documents.filter(d => {
    if (d.status === 'expired' || d.status === 'rejected' || !d.expiry_date) return false;
    const days = Math.ceil((new Date(d.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return days >= 0 && days <= 30;
  });

  // Calculate Storage Usage
  const totalStorageBytes = documents.reduce((sum, doc) => sum + (doc.file_size || 0), 0);
  const storageLimit = 1024 * 1024 * 1024; // 1GB
  const storageUsedMB = totalStorageBytes / (1024 * 1024);
  const storagePercentage = Math.min(100, (totalStorageBytes / storageLimit) * 100);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <p>Loading vendor profile...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!vendor) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <h2 className="text-xl font-semibold">Vendor not found</h2>
          <Button onClick={() => navigate('/dashboard/vendors')}>Back to Vendors</Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/vendors')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight">{vendor.name}</h1>
                <VendorStatusBadge status={vendor.status} onboardingStatus={vendor.onboarding_status} />
                <RiskBadge rating={vendor.risk_rating || 'low'} />
              </div>
              <p className="text-muted-foreground flex items-center gap-2 mt-1">
                <Building className="h-4 w-4" /> {vendor.type.toUpperCase()} • {vendor.code || 'No Code'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {vendor.onboarding_status === 'draft' && (
               <Button variant="secondary" onClick={handleSubmitForApproval}>Submit for Approval</Button>
            )}
            {vendor.onboarding_status === 'in_review' && hasRole('platform_admin') && (
               <>
                 <Button variant="destructive" onClick={handleRejectVendor}>Reject</Button>
                 <Button variant="default" className="bg-green-600 hover:bg-green-700" onClick={handleApproveVendor}>Approve</Button>
               </>
            )}
            <Button variant="outline" onClick={() => setEditDialogOpen(true)}>Edit Profile</Button>
            <Button onClick={() => setContractDialogOpen(true)}>Create Contract</Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Performance Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{vendor.performance_rating || '0.00'} / 5.0</div>
              <p className="text-xs text-muted-foreground mt-1">Based on {reviews.length} reviews</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Contracts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{contracts.filter(c => c.status === 'active').length}</div>
              <p className="text-xs text-muted-foreground mt-1">Value: ${contracts.reduce((sum, c) => sum + (c.value || 0), 0).toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Compliance Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">Verified</div>
              <p className="text-xs text-muted-foreground mt-1">{documents.length} documents on file</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Risk Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{riskAssessment?.risk_score || 0}/100</div>
              <p className="text-xs text-muted-foreground mt-1">Last assessed: {riskAssessment?.assessment_date || 'Never'}</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="contracts">Contracts & Legal</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="financials">Financials</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Vendor Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Vendor Type</span>
                      <p className="font-medium capitalize">{vendor.type}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tax ID</span>
                      <p className="font-medium">{vendor.tax_id || '-'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Website</span>
                      <p className="font-medium text-blue-600">{vendor.website || '-'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Currency</span>
                      <p className="font-medium">{vendor.currency || 'USD'}</p>
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-2">Primary Contact</h4>
                    <div className="space-y-1 text-sm">
                      <p>{vendor.contact_info?.primary_contact || 'No contact name'}</p>
                      <p>{vendor.contact_info?.email || 'No email'}</p>
                      <p>{vendor.contact_info?.phone || 'No phone'}</p>
                      <p className="text-muted-foreground">
                        {(() => {
                          const addr = vendor.contact_info?.address;
                          if (!addr) return 'No address';
                          if (typeof addr === 'string') return addr;
                          if (typeof addr === 'object') {
                             const a = addr as any;
                             return [a.street, a.city, a.state, a.zip, a.country].filter(Boolean).join(', ');
                          }
                          return 'No address';
                        })()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Risk Assessment</CardTitle>
                  <CardDescription>Latest risk analysis findings</CardDescription>
                </CardHeader>
                <CardContent>
                  {riskAssessment ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-slate-50 p-3 rounded text-center">
                          <div className="text-xs text-muted-foreground">Financial</div>
                          <Badge variant="outline" className="mt-1">{riskAssessment.financial_risk}</Badge>
                        </div>
                        <div className="bg-slate-50 p-3 rounded text-center">
                          <div className="text-xs text-muted-foreground">Operational</div>
                          <Badge variant="outline" className="mt-1">{riskAssessment.operational_risk}</Badge>
                        </div>
                        <div className="bg-slate-50 p-3 rounded text-center">
                          <div className="text-xs text-muted-foreground">Compliance</div>
                          <Badge variant="outline" className="mt-1">{riskAssessment.compliance_risk}</Badge>
                        </div>
                      </div>
                      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-md">
                        <h4 className="font-semibold text-yellow-900 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" /> Mitigation Plan
                        </h4>
                        <p className="text-sm text-yellow-800 mt-1">
                          {riskAssessment.mitigation_plan || 'No specific mitigation plan defined.'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No risk assessment performed yet.
                      <div className="mt-4">
                         <Button variant="outline" size="sm" onClick={() => setRiskDialogOpen(true)}>Start Assessment</Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          
          <VendorPreferredCarriers vendorId={id!} />
        </TabsContent>

          {/* Contracts Tab */}
          <TabsContent value="contracts" className="space-y-4">
            <div className="flex flex-col md:flex-row gap-6">
              <VendorFolderSidebar
                folders={folders}
                currentFolder={currentFolder}
                onSelectFolder={setCurrentFolder}
                onCreateFolder={handleCreateFolder}
                onEditFolder={handleEditFolder}
                onDeleteFolder={handleDeleteFolder}
                storageUsedMB={storageUsedMB}
                storagePercentage={storagePercentage}
              />

              <div className="flex-1 space-y-4">
                {expiringContracts.length > 0 && (
                  <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4">
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <h5 className="font-medium text-sm">Expiring Contracts</h5>
                    </div>
                    <div className="mt-1 text-sm text-destructive/90 pl-6">
                      You have {expiringContracts.length} contract(s) expiring within 30 days. Please review them.
                    </div>
                  </div>
                )}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>Contracts</CardTitle>
                          <CardDescription>
                            {currentFolder === 'All' ? 'All contracts across folders' : `Contracts in ${currentFolder}`}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-2">
                        <div className="relative w-full max-w-sm">
                          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input 
                            placeholder="Search contracts..." 
                            className="pl-8 h-8" 
                            value={contractSearch}
                            onChange={(e) => setContractSearch(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => setContractDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> New Contract</Button>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Duration</TableHead>
                          <TableHead>Value</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredContracts.map(contract => (
                          <TableRow key={contract.id}>
                            <TableCell className="font-medium">
                              <div>{contract.title}</div>
                              <div className="text-xs text-muted-foreground">
                                {contract.folder_id ? folders.find(f => f.id === contract.folder_id)?.name : 'General'}
                              </div>
                            </TableCell>
                            <TableCell className="capitalize">{contract.type.replace('_', ' ')}</TableCell>
                            <TableCell>
                              <Badge variant={contract.status === 'active' ? 'default' : 'secondary'}>
                                {contract.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {new Date(contract.start_date).toLocaleDateString()} - {contract.end_date ? new Date(contract.end_date).toLocaleDateString() : 'Indefinite'}
                            </TableCell>
                            <TableCell>${contract.value?.toLocaleString() || '-'}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" onClick={() => handleManageContract(contract)}>
                                Manage
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleViewContract(contract.id)}>View</Button>
                              <Button variant="ghost" size="sm" onClick={() => handleUploadVersion(contract)}>
                                <Upload className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {filteredContracts.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                              No contracts found in this folder.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Compliance Tab */}
          <TabsContent value="compliance">
            <div className="flex flex-col md:flex-row gap-6">
              <VendorFolderSidebar
                folders={folders}
                currentFolder={currentFolder}
                onSelectFolder={setCurrentFolder}
                onCreateFolder={handleCreateFolder}
                onEditFolder={handleEditFolder}
                onDeleteFolder={handleDeleteFolder}
                storageUsedMB={storageUsedMB}
                storagePercentage={storagePercentage}
              />

              {/* File List */}
              <div className="flex-1">
                <Card>
                  <CardHeader>
                    <div className="flex flex-row items-center justify-between mb-4">
                        <div>
                        <CardTitle>Documents</CardTitle>
                        <CardDescription>
                          {currentFolder === 'All' ? 'All files across folders' : `Files in ${currentFolder}`}
                        </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={handleDownloadAll} disabled={isBulkDownloading}>
                              <Download className="mr-2 h-4 w-4" /> Download All
                          </Button>
                          <Button size="sm" onClick={() => setDocumentDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Upload Document</Button>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative w-full max-w-sm">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Search by name or type..." 
                                className="pl-8" 
                                value={docSearch}
                                onChange={(e) => setDocSearch(e.target.value)}
                            />
                        </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {selectedDocs.size > 0 && (
                      <div className="bg-muted/50 p-2 rounded-md mb-4 flex items-center justify-between">
                        <span className="text-sm font-medium px-2">{selectedDocs.size} selected</span>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => setMoveDialogOpen(true)}>
                            <Folder className="h-4 w-4 mr-2" /> Move
                          </Button>
                          <Button size="sm" variant="outline" onClick={handleBulkDownload} disabled={isBulkDownloading}>
                            <Download className="h-4 w-4 mr-2" /> {isBulkDownloading ? 'Zipping...' : 'Download'}
                          </Button>
                          <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
                            <Trash className="h-4 w-4 mr-2" /> Delete
                          </Button>
                        </div>
                      </div>
                    )}

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[40px]">
                            <Checkbox 
                              checked={filteredDocuments.length > 0 && selectedDocs.size === filteredDocuments.length}
                              onCheckedChange={toggleSelectAll}
                            />
                          </TableHead>
                          <TableHead>Document Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Expiry</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredDocuments.map(doc => (
                          <TableRow key={doc.id}>
                            <TableCell>
                              <Checkbox 
                                checked={selectedDocs.has(doc.id)}
                                onCheckedChange={() => toggleSelectOne(doc.id)}
                              />
                            </TableCell>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                {doc.name}
                              </div>
                              <div className="text-xs text-muted-foreground ml-6">
                                {(doc.file_size ? (doc.file_size / 1024 / 1024).toFixed(2) : '0.00')} MB • {doc.folder || 'General'}
                                {doc.tags && doc.tags.length > 0 && (
                                  <span className="ml-2 inline-flex gap-1">
                                    {doc.tags.map((tag: string, i: number) => (
                                      <span key={i} className="inline-flex items-center rounded-sm bg-secondary px-1 py-0.5 text-[10px] font-medium text-secondary-foreground">
                                        {tag}
                                      </span>
                                    ))}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="capitalize">{doc.type}</TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <Badge variant={
                                    doc.status === 'verified' ? 'default' :
                                    doc.status === 'pending' ? 'secondary' :
                                    'destructive'
                                }>
                                  {doc.status}
                                </Badge>
                                {doc.virus_scan_status && (
                                  <div className="flex items-center gap-1 text-[10px]">
                                    {doc.virus_scan_status === 'pending' && (
                                      <span className="text-muted-foreground flex items-center animate-pulse">
                                        <Activity className="h-3 w-3 mr-1" /> Scanning
                                      </span>
                                    )}
                                    {doc.virus_scan_status === 'clean' && (
                                      <span className="text-green-600 flex items-center font-medium">
                                        <Shield className="h-3 w-3 mr-1" /> Clean
                                      </span>
                                    )}
                                    {doc.virus_scan_status === 'infected' && (
                                      <span className="text-destructive flex items-center font-bold">
                                        <AlertTriangle className="h-3 w-3 mr-1" /> Infected
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                              {doc.expiry_date && (
                                (() => {
                                  const days = Math.ceil((new Date(doc.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                  if (days <= 30 && doc.status !== 'expired' && doc.status !== 'rejected') {
                                    return (
                                      <div className="flex items-center gap-1 mt-1 text-destructive text-xs font-medium">
                                        <AlertTriangle className="h-3 w-3" />
                                        {days < 0 ? 'Expired' : `Expiring in ${days}d`}
                                      </div>
                                    );
                                  }
                                  return null;
                                })()
                              )}
                            </TableCell>
                            <TableCell>{doc.expiry_date || '-'}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" onClick={() => handlePreviewDocument(doc)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDownloadDocument(doc)}>
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDocumentVersions(doc)}>
                                <HistoryIcon className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDeleteDocument(doc)}>
                                <Trash className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {filteredDocuments.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                              {documents.length === 0 ? 'No documents uploaded.' : 'No documents match your search.'}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-8">
            <VendorPerformanceScorecard 
                metrics={performanceMetrics}
                history={performanceHistory}
                onRefresh={handleRefreshScore}
            />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Manual Reviews</h3>
                <Button variant="outline" size="sm" onClick={() => setPerformanceDialogOpen(true)}>Add Review</Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle>Review History</CardTitle>
                    <CardDescription>Qualitative assessments by staff</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px] w-full">
                      {reviews.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={reviews}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="review_period_end" tickFormatter={(val) => new Date(val).toLocaleDateString()} />
                            <YAxis domain={[0, 5]} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="overall_score" name="Overall Score" fill="#2563eb" />
                            <Bar dataKey="delivery_score" name="Delivery" fill="#16a34a" />
                            <Bar dataKey="quality_score" name="Quality" fill="#ca8a04" />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-muted-foreground">
                          No performance reviews available.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Recent Reviews</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {reviews.map(review => (
                      <div key={review.id} className="border-b pb-4 last:border-0 last:pb-0">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-semibold">{new Date(review.review_period_end).toLocaleDateString()}</span>
                          <Badge>{review.overall_score}/5.0</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {review.comments || 'No comments provided.'}
                        </p>
                      </div>
                    ))}
                    {reviews.length === 0 && (
                      <div className="text-center text-muted-foreground">No reviews yet.</div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
          
           {/* Financials Tab */}
           <TabsContent value="financials">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <Card>
                    <CardHeader>
                        <CardTitle>Total Spend (Est.)</CardTitle>
                        <CardDescription>Based on recent quotes</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">${financials?.totalSpend?.toLocaleString() || '0.00'}</div>
                        <p className="text-xs text-muted-foreground mt-1">Across {financials?.recentCharges?.length || 0} charge items</p>
                    </CardContent>
                </Card>
                
                 <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>Payment Information</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4">
                        <div>
                            <span className="text-muted-foreground block text-sm">Payment Terms</span>
                            <span className="font-medium">{vendor.payment_terms || 'Net 30'}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground block text-sm">Currency</span>
                            <span className="font-medium">{vendor.currency || 'USD'}</span>
                        </div>
                         <div>
                            <span className="text-muted-foreground block text-sm">Tax ID</span>
                            <span className="font-medium">{vendor.tax_id || '-'}</span>
                        </div>
                        <div>
                             <span className="text-muted-foreground block text-sm">Bank Details</span>
                             <span className="font-medium">Not Configured</span>
                        </div>
                    </CardContent>
                </Card>
                
                <Card className="md:col-span-3">
                    <CardHeader>
                        <CardTitle>Service Rates</CardTitle>
                        <CardDescription>Agreed pricing structures for provided services</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Service</TableHead>
                                    <TableHead>Preferred</TableHead>
                                    <TableHead>Cost Structure</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {financials?.serviceRates?.map((rate: any) => (
                                    <TableRow key={rate.id}>
                                        <TableCell className="font-medium">{rate.service?.name} ({rate.service?.code})</TableCell>
                                        <TableCell>{rate.is_preferred ? <Badge>Preferred</Badge> : '-'}</TableCell>
                                        <TableCell>
                                            <pre className="text-xs bg-muted p-2 rounded max-w-md overflow-auto whitespace-pre-wrap">
                                                {JSON.stringify(rate.cost_structure, null, 2)}
                                            </pre>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {!financials?.serviceRates?.length && (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">No service rates configured.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
           </TabsContent>

        </Tabs>
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Vendor Profile</DialogTitle>
            <DialogDescription>
              Update vendor information and contact details.
            </DialogDescription>
          </DialogHeader>
          {vendor && (
            <VendorForm
              initialData={vendor}
              onSuccess={() => {
                setEditDialogOpen(false);
                fetchVendorDetails();
              }}
              onCancel={() => setEditDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <VendorContractDialog
        open={contractDialogOpen}
        onOpenChange={setContractDialogOpen}
        vendorId={id!}
        folders={folders}
        defaultFolder={currentFolder}
        onSuccess={fetchVendorDetails}
      />

      <VendorDocumentDialog
        open={documentDialogOpen}
        onOpenChange={setDocumentDialogOpen}
        vendorId={id!}
        folders={folders}
        defaultFolder={currentFolder}
        onSuccess={fetchVendorDetails}
      />

      <ContractManagementDialog
        open={contractManagementOpen}
        onOpenChange={setContractManagementOpen}
        contract={selectedContractForManagement}
        vendor={vendor}
        onUpdate={fetchVendorDetails}
      />
      
      <FilePreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        file={previewFile}
      />

      <VendorFolderDialog
        open={folderDialogOpen}
        onOpenChange={setFolderDialogOpen}
        vendorId={id!}
        folder={editingFolder}
        onSuccess={fetchVendorDetails}
      />

      <VendorRiskDialog
        open={riskDialogOpen}
        onOpenChange={setRiskDialogOpen}
        vendorId={id!}
        onSuccess={fetchVendorDetails}
      />

      <VendorPerformanceDialog
        open={performanceDialogOpen}
        onOpenChange={setPerformanceDialogOpen}
        vendorId={id!}
        onSuccess={fetchVendorDetails}
      />

      <VendorContractVersionDialog
        open={versionDialogOpen}
        onOpenChange={setVersionDialogOpen}
        vendorId={id!}
        contractId={selectedContract?.id || ''}
        contractTitle={selectedContract?.title || ''}
        onSuccess={fetchVendorDetails}
      />

      <VendorMoveDocumentDialog
        open={moveDialogOpen}
        onOpenChange={setMoveDialogOpen}
        vendorId={id!}
        documentIds={Array.from(selectedDocs)}
        folders={folders}
        onSuccess={() => {
          fetchVendorDetails();
          setSelectedDocs(new Set());
        }}
      />

      <VendorDocumentVersionDialog
        open={docVersionDialogOpen}
        onOpenChange={setDocVersionDialogOpen}
        vendorId={id!}
        documentId={selectedDocForVersion?.id || ''}
        documentName={selectedDocForVersion?.name || ''}
        onSuccess={fetchVendorDetails}
      />
    </DashboardLayout>
  );
}

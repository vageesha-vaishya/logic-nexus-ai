import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { TenantForm } from '@/components/admin/TenantForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Building2, Trash2, ArrowLeft, Upload, FileText, Check, Clock, RefreshCcw, Download } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { invokeFunction } from '@/lib/supabase-functions';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export default function TenantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { supabase, context, scopedDb } = useCRM();
  const [tenant, setTenant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'profile'|'contracts'|'documents'|'import'|'reports'>('profile');
  const settings = useMemo(() => tenant?.settings || {}, [tenant]);
  
  // Contracts state (persisted in settings.contracts)
  const [contractTitle, setContractTitle] = useState('');
  const [contractStatus, setContractStatus] = useState<'draft'|'active'|'expired'|'renewal_pending'>('draft');
  const [contractEffective, setContractEffective] = useState('');
  const [contractRenewal, setContractRenewal] = useState('');
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [sendingIdx, setSendingIdx] = useState<{ c: number; v: number } | null>(null);
  
  // Documents state (persisted in settings.documents)
  const [docCategory, setDocCategory] = useState('General');
  const [docTags, setDocTags] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  
  // Import/Export state
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [useLLMRefine, setUseLLMRefine] = useState(true);
  const [importErrors, setImportErrors] = useState<Array<{ row: number; message: string }>>([]);

  useEffect(() => {
    fetchTenant();
  }, [id]);

  const fetchTenant = async () => {
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setTenant(data);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from('tenants')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Tenant deleted successfully',
      });
      navigate('/dashboard/tenants');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };
  
  const saveSettings = async (next: any, successMessage = 'Settings saved') => {
    try {
      const { error } = await scopedDb
        .from('tenants')
        .update({ settings: next })
        .eq('id', id);
      if (error) throw error;
      setTenant((t: any) => ({ ...t, settings: next }));
      toast({ title: 'Success', description: successMessage });
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message, variant: 'destructive' });
    }
  };
  
  const handleContractUpload = async () => {
    if (!tenant) return;
    if (!contractTitle || !contractFile) {
      toast({ title: 'Missing fields', description: 'Provide contract title and file' });
      return;
    }
    try {
      const path = `${tenant.id}/contracts/${Date.now()}-${contractFile.name}`;
      const { error: upErr } = await supabase.storage.from('tenant-contracts').upload(path, contractFile, { upsert: false });
      if (upErr) throw upErr;
      const urlRes = await supabase.storage.from('tenant-contracts').getPublicUrl(path);
      const fileUrl = urlRes.data.publicUrl;
      const version = {
        path,
        url: fileUrl,
        uploaded_at: new Date().toISOString(),
      };
      const currentContracts = Array.isArray(settings?.contracts) ? settings.contracts : [];
      const existing = currentContracts.find((c: any) => c.title === contractTitle);
      let nextContracts;
      if (existing) {
        nextContracts = currentContracts.map((c: any) => 
          c.title === contractTitle ? { 
            ...c, 
            status: contractStatus, 
            effective_date: contractEffective || c.effective_date, 
            renewal_date: contractRenewal || c.renewal_date,
            versions: Array.isArray(c.versions) ? [...c.versions, version] : [version],
          } : c
        );
      } else {
        nextContracts = [
          ...currentContracts,
          {
            title: contractTitle,
            status: contractStatus,
            effective_date: contractEffective || null,
            renewal_date: contractRenewal || null,
            versions: [version],
          }
        ];
      }
      await saveSettings({ ...settings, contracts: nextContracts }, 'Contract saved');
      setContractFile(null);
      setContractTitle('');
      setContractEffective('');
      setContractRenewal('');
      setContractStatus('draft');
    } catch (e: any) {
      toast({ title: 'Contract upload failed', description: e?.message, variant: 'destructive' });
    }
  };
  
  const sendVersionForSignature = async (cIdx: number, vIdx: number) => {
    if (!tenant) return;
    const contracts = Array.isArray(settings?.contracts) ? settings.contracts : [];
    const contract = contracts[cIdx];
    const version = (contract?.versions || [])[vIdx];
    if (!version?.url) {
      toast({ title: 'No file URL', description: 'Upload a contract file first', variant: 'destructive' });
      return;
    }
    if (!signerName || !signerEmail) {
      toast({ title: 'Signer required', description: 'Provide signer name and email' });
      return;
    }
    try {
      setSendingIdx({ c: cIdx, v: vIdx });
      const { data, error } = await invokeFunction('opensign-create-envelope', {
        body: {
          tenantId: tenant.id,
          title: contract.title,
          fileUrl: version.url,
          signer: { name: signerName, email: signerEmail },
        }
      });
      if (error) throw error;
      const envelopeId = data?.envelopeId || data?.id;
      const signingUrl = data?.signingUrl || data?.url;
      const nextContracts = contracts.map((c: any, ci: number) => {
        if (ci !== cIdx) return c;
        const nextVersions = (c.versions || []).map((v: any, vi: number) => {
          if (vi !== vIdx) return v;
          return {
            ...v,
            signature: {
              provider: 'OpenSign',
              envelope_id: envelopeId,
              signing_url: signingUrl || null,
              status: 'sent',
              sent_at: new Date().toISOString(),
              signer: { name: signerName, email: signerEmail },
            }
          };
        });
        return { ...c, versions: nextVersions };
      });
      await saveSettings({ ...settings, contracts: nextContracts }, 'Signature request sent');
    } catch (e: any) {
      toast({ title: 'OpenSign error', description: e?.message, variant: 'destructive' });
    } finally {
      setSendingIdx(null);
    }
  };
  
  const refreshSignatureStatus = async (cIdx: number, vIdx: number) => {
    const contracts = Array.isArray(settings?.contracts) ? settings.contracts : [];
    const version = contracts?.[cIdx]?.versions?.[vIdx];
    const envId = version?.signature?.envelope_id;
    if (!envId) {
      toast({ title: 'No envelope', description: 'Send for signature first' });
      return;
    }
    try {
      const { data, error } = await invokeFunction('opensign-get-envelope-status', {
        body: { envelopeId: settings.contracts.envelope_id }
      });
      if (error) throw error;
      const status = data?.status || 'unknown';
      const completedAt = data?.completedAt || null;
      const contracts = Array.isArray(settings?.contracts) ? settings.contracts : [];
      const nextContracts = contracts.map((c: any, ci: number) => {
        if (ci !== cIdx) return c;
        const nextVersions = (c.versions || []).map((v: any, vi: number) => {
          if (vi !== vIdx) return v;
          return {
            ...v,
            signature: {
              ...(v.signature || {}),
              status,
              completed_at: completedAt,
            }
          };
        });
        return { ...c, versions: nextVersions };
      });
      await saveSettings({ ...settings, contracts: nextContracts }, 'Signature status updated');
    } catch (e: any) {
      toast({ title: 'Status refresh failed', description: e?.message, variant: 'destructive' });
    }
  };
  
  const handleDocumentUpload = async () => {
    if (!tenant) return;
    if (!docFile) {
      toast({ title: 'No file selected', description: 'Choose a document to upload' });
      return;
    }
    try {
      const path = `${tenant.id}/docs/${Date.now()}-${docFile.name}`;
      const { error: upErr } = await supabase.storage.from('tenant-docs').upload(path, docFile, { upsert: false });
      if (upErr) throw upErr;
      const urlRes = await supabase.storage.from('tenant-docs').getPublicUrl(path);
      const fileUrl = urlRes.data.publicUrl;
      const tags = docTags.split(',').map((t) => t.trim()).filter(Boolean);
      const docItem = {
        path,
        url: fileUrl,
        category: docCategory,
        tags,
        uploaded_at: new Date().toISOString(),
      };
      const currentDocs = Array.isArray(settings?.documents) ? settings.documents : [];
      await saveSettings({ ...settings, documents: [...currentDocs, docItem] }, 'Document saved');
      setDocFile(null);
      setDocCategory('General');
      setDocTags('');
    } catch (e: any) {
      toast({ title: 'Document upload failed', description: e?.message, variant: 'destructive' });
    }
  };
  
  const exportTenantData = (format: 'json'|'csv'|'xlsx') => {
    if (!tenant) return;
    const data = {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      domain: tenant.domain,
      subscription_tier: tenant.subscription_tier,
      is_active: tenant.is_active,
      settings: tenant.settings || {},
    };
    try {
      if (format === 'json') {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tenant-${tenant.slug || tenant.id}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (format === 'csv') {
        const rows: any[] = [
          { key: 'id', value: data.id },
          { key: 'name', value: data.name },
          { key: 'slug', value: data.slug },
          { key: 'domain', value: data.domain || '' },
          { key: 'subscription_tier', value: data.subscription_tier || '' },
          { key: 'is_active', value: String(data.is_active) },
          { key: 'settings', value: JSON.stringify(data.settings) },
        ];
        const csv = Papa.unparse(rows, { header: true });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tenant-${tenant.slug || tenant.id}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (format === 'xlsx') {
        const rows = [
          ['id', data.id],
          ['name', data.name],
          ['slug', data.slug],
          ['domain', data.domain || ''],
          ['subscription_tier', data.subscription_tier || ''],
          ['is_active', data.is_active ? 'true' : 'false'],
          ['settings', JSON.stringify(data.settings)],
        ];
        const ws = XLSX.utils.aoa_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Tenant');
        const wbout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
        const blob = new Blob([wbout], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tenant-${tenant.slug || tenant.id}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      }
      toast({ title: 'Success', description: 'Export generated' });
    } catch (e: any) {
      toast({ title: 'Export failed', description: e?.message, variant: 'destructive' });
    }
  };
  
  const handleImport = async () => {
    if (!importFile) {
      toast({ title: 'No file selected', description: 'Choose a CSV, XLSX, or JSON file' });
      return;
    }
    setImporting(true);
    setImportErrors([]);
    try {
      const ext = (importFile.name.split('.').pop() || '').toLowerCase();
      let imported: any = null;
      if (ext === 'json') {
        const text = await importFile.text();
        imported = JSON.parse(text);
      } else if (ext === 'csv') {
        const text = await importFile.text();
        const parsed = Papa.parse(text, { header: true });
        imported = parsed.data;
      } else if (ext === 'xlsx') {
        const buf = await importFile.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        imported = XLSX.utils.sheet_to_json(ws, { header: 1 });
      } else {
        throw new Error('Unsupported file type');
      }
      
      // Validate sample fields
      const errors: Array<{ row: number; message: string }> = [];
      const validateRecord = (rec: any, idx: number) => {
        if (rec.name && typeof rec.name !== 'string') {
          errors.push({ row: idx + 1, message: 'Invalid name' });
        }
        if (rec.slug && !/^[a-z0-9-]+$/.test(rec.slug)) {
          errors.push({ row: idx + 1, message: 'Slug must be lowercase alphanumeric with hyphens' });
        }
      };
      const rows = Array.isArray(imported) ? imported : [imported];
      rows.forEach((r, i) => validateRecord(r, i));
      
      let refined = rows;
      if (useLLMRefine) {
        try {
          const { data, error } = await invokeFunction('llm-refine-tenants', { body: { rows } });
          if (error) {
            throw error;
          }
          refined = Array.isArray(data?.rows) ? data.rows : rows;
        } catch (e: any) {
          toast({ title: 'LLM refine unavailable', description: 'Proceeding with raw data' });
        }
      }
      
      const nextSettings = { ...(tenant?.settings || {}) };
      nextSettings.import_history = [
        ...(nextSettings.import_history || []),
        {
          at: new Date().toISOString(),
          file: importFile.name,
          errors,
          count: refined.length,
        }
      ];
      await saveSettings(nextSettings, 'Import processed');
      setImportErrors(errors);
    } catch (e: any) {
      toast({ title: 'Import failed', description: e?.message, variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-8">Loading...</div>
      </DashboardLayout>
    );
  }

  if (!tenant) {
    return (
      <DashboardLayout>
        <div className="text-center py-8">Tenant not found</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/tenants')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{tenant.name}</h1>
              <p className="text-muted-foreground">Enterprise tenant management</p>
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="icon">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Tenant</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this tenant? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="w-full grid grid-cols-5">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="contracts">Contracts</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="import">Import/Export</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>
          
          <TabsContent value="profile" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Tenant Information
                </CardTitle>
                <CardDescription>Maintain core details and expanded profile</CardDescription>
              </CardHeader>
              <CardContent>
                <TenantForm tenant={tenant} onSuccess={fetchTenant} />
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="contracts" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Legal Contracts
                </CardTitle>
                <CardDescription>Lifecycle, versions, signatures, and renewal reminders</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Contract Title</Label>
                    <Input value={contractTitle} onChange={(e) => setContractTitle(e.target.value)} placeholder="Master Services Agreement" />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={contractStatus} onValueChange={(v) => setContractStatus(v as any)}>
                      <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                        <SelectItem value="renewal_pending">Renewal Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Effective Date</Label>
                    <Input type="date" value={contractEffective} onChange={(e) => setContractEffective(e.target.value)} />
                  </div>
                  <div>
                    <Label>Renewal Date</Label>
                    <Input type="date" value={contractRenewal} onChange={(e) => setContractRenewal(e.target.value)} />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Upload Contract (PDF/DOCX)</Label>
                    <Input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setContractFile(e.target.files?.[0] || null)} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleContractUpload}>
                    <Upload className="mr-2 h-4 w-4" />
                    Save Contract / New Version
                  </Button>
                </div>
                
                <div className="rounded border p-3 space-y-3">
                  <div className="font-medium">OpenSign E‑Signature</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Signer Name</Label>
                      <Input value={signerName} onChange={(e) => setSignerName(e.target.value)} placeholder="Jane Doe" />
                    </div>
                    <div>
                      <Label>Signer Email</Label>
                      <Input value={signerEmail} onChange={(e) => setSignerEmail(e.target.value)} placeholder="jane@example.com" />
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    After uploading a version, use the actions below to send for signature and track status.
                  </div>
                </div>
                
                <div className="mt-6">
                  <h3 className="font-semibold mb-3">Existing Contracts</h3>
                  <div className="space-y-3">
                    {(settings?.contracts || []).map((c: any, idx: number) => (
                      <div key={idx} className="rounded border p-3">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{c.title}</div>
                          <Badge variant="secondary" className="capitalize">{c.status || 'draft'}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Effective: {c.effective_date || '-'} • Renewal: {c.renewal_date || '-'}
                        </div>
                        <div className="mt-2">
                          <div className="text-xs text-muted-foreground">Versions</div>
                          <ul className="list-disc pl-5">
                            {(c.versions || []).map((v: any, vi: number) => (
                              <li key={vi} className="text-sm">
                                <a className="text-primary underline" href={v.url} target="_blank" rel="noreferrer">{v.path?.split('/').pop()}</a>
                                <span className="ml-2 text-muted-foreground">({new Date(v.uploaded_at).toLocaleString()})</span>
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => sendVersionForSignature(idx, vi)}
                                    disabled={!!sendingIdx && sendingIdx.c === idx && sendingIdx.v === vi}
                                  >
                                    <Upload className="mr-2 h-4 w-4" />
                                    {sendingIdx && sendingIdx.c === idx && sendingIdx.v === vi ? 'Sending…' : 'Send for Signature'}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => refreshSignatureStatus(idx, vi)}
                                  >
                                    <Clock className="mr-2 h-4 w-4" />
                                    Refresh Status
                                  </Button>
                                  {v?.signature?.signing_url && (
                                    <a
                                      className="text-primary underline text-sm"
                                      href={v.signature.signing_url}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      Open Signing Link
                                    </a>
                                  )}
                                  {v?.signature?.status && (
                                    <Badge variant="outline" className="capitalize">{v.signature.status}</Badge>
                                  )}
                                  {v?.signature?.completed_at && (
                                    <span className="text-xs text-green-700">Completed {new Date(v.signature.completed_at).toLocaleString()}</span>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="documents" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Documents
                </CardTitle>
                <CardDescription>Secure uploads, categorization, and tagging with access control</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Category</Label>
                    <Input value={docCategory} onChange={(e) => setDocCategory(e.target.value)} placeholder="General" />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Tags (comma separated)</Label>
                    <Input value={docTags} onChange={(e) => setDocTags(e.target.value)} placeholder="legal,hr,policy" />
                  </div>
                  <div className="md:col-span-3">
                    <Label>Upload Document</Label>
                    <Input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={(e) => setDocFile(e.target.files?.[0] || null)} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleDocumentUpload}>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Document
                  </Button>
                </div>
                <div className="mt-6">
                  <h3 className="font-semibold mb-3">Repository</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(settings?.documents || []).map((d: any, idx: number) => (
                      <div key={idx} className="rounded border p-3">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{d.path?.split('/').pop()}</div>
                          <Badge variant="outline">{d.category}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">Tags: {(d.tags || []).join(', ') || '-'}</div>
                        <div className="mt-2">
                          <a className="text-primary underline" href={d.url} target="_blank" rel="noreferrer">Open</a>
                          <span className="ml-2 text-muted-foreground text-xs">{new Date(d.uploaded_at).toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="import" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Import & Export
                </CardTitle>
                <CardDescription>Bulk templates, formats, validation, and AI refinement</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Export Tenant</div>
                      <div className="text-sm text-muted-foreground">Download JSON, CSV, or Excel</div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => exportTenantData('json')}>
                        <Download className="mr-2 h-4 w-4" /> JSON
                      </Button>
                      <Button variant="outline" onClick={() => exportTenantData('csv')}>
                        <Download className="mr-2 h-4 w-4" /> CSV
                      </Button>
                      <Button variant="outline" onClick={() => exportTenantData('xlsx')}>
                        <Download className="mr-2 h-4 w-4" /> Excel
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div className="rounded border p-4 space-y-4">
                  <div>
                    <div className="font-medium">Import Data</div>
                    <div className="text-sm text-muted-foreground">Accepts JSON/CSV/XLSX, validates fields, and optionally refines with AI</div>
                  </div>
                  <Input type="file" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
                  <div className="flex items-center gap-2">
                    <Switch checked={useLLMRefine} onCheckedChange={setUseLLMRefine} />
                    <span className="text-sm">Use AI Refinement</span>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleImport} disabled={importing}>
                      {importing ? <Clock className="mr-2 h-4 w-4" /> : <Upload className="mr-2 h-4 w-4" />}
                      Process Import
                    </Button>
                    <Button variant="outline" onClick={() => {
                      const headers = ['name','slug','domain','subscription_tier','is_active','settings'];
                      const csv = Papa.unparse([headers, ['Acme','acme','acme.com','Enterprise','true','{}']]);
                      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'tenant-import-template.csv';
                      a.click();
                      URL.revokeObjectURL(url);
                    }}>
                      <Download className="mr-2 h-4 w-4" />
                      Download CSV Template
                    </Button>
                  </div>
                  {importErrors.length > 0 && (
                    <div className="rounded bg-red-50 border border-red-200 p-3">
                      <div className="font-medium text-red-700">Errors</div>
                      <ul className="list-disc pl-5 text-sm text-red-800">
                        {importErrors.map((e, i) => (<li key={i}>Row {e.row}: {e.message}</li>))}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="reports" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Reporting & Metrics</CardTitle>
                <CardDescription>Key metrics to monitor tenant activity</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <StatCard label="Franchises" value={tenant?.franchise_count ?? '—'} />
                  <StatCard label="Users" value={tenant?.user_count ?? '—'} />
                  <StatCard label="Activities (30d)" value={tenant?.activity_30d ?? '—'} />
                  <StatCard label="Documents" value={(settings?.documents || []).length ?? 0} />
                </div>
                <div className="text-xs text-muted-foreground">
                  Metrics are illustrative; connect to reporting endpoints for live values.
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

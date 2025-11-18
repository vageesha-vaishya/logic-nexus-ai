import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { QuoteForm } from '@/components/sales/QuoteForm';
import { QuotationVersionHistory } from '@/components/sales/QuotationVersionHistory';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList } from '@/components/ui/breadcrumb';

export default function QuoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { supabase } = useCRM();
  const [loading, setLoading] = useState(true);
  const [resolvedId, setResolvedId] = useState<string | null>(null);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);

  useEffect(() => {
    const checkQuote = async () => {
      try {
        if (!id) throw new Error('Missing quote identifier');
        // Allow navigating by either UUID id or quote_number (e.g., QT-2025-002)
        const { data, error } = await supabase
          .from('quotes')
          .select('id, tenant_id')
          .or(`id.eq.${id},quote_number.eq.${id}`)
          .limit(1)
          .single();
        if (error) throw error;
        setResolvedId((data as any)?.id ?? null);
        setTenantId((data as any)?.tenant_id ?? null);
        setLoading(false);
      } catch (err: any) {
        toast.error('Failed to load quote', { description: err.message });
        navigate('/dashboard/quotes');
      }
    };
    checkQuote();
  }, [id]);

  useEffect(() => {
    const loadLatestVersion = async () => {
      if (!resolvedId) return;
      try {
        const { data, error } = await supabase
          .from('quotation_versions')
          .select('id, version_number')
          .eq('quote_id', resolvedId)
          .order('version_number', { ascending: false })
          .limit(1);
        if (error) return;
        if (Array.isArray(data) && data.length && data[0]?.id) {
          setVersionId(String(data[0].id));
        } else {
          // Create initial version if none exists (align with typed schema)
          if (!tenantId) {
            // Fallback: fetch tenant from quote if not already set
            const { data: qRow } = await supabase
              .from('quotes')
              .select('tenant_id')
              .eq('id', resolvedId)
              .single();
            setTenantId((qRow as any)?.tenant_id ?? null);
          }
          if (!tenantId && !(await supabase.auth.getUser()).data?.user) return;
          const finalTenantId = tenantId ?? ((await supabase.auth.getUser()).data?.user as any)?.user_metadata?.tenant_id;
          const { data: v } = await supabase
            .from('quotation_versions')
            .insert({ quote_id: resolvedId, tenant_id: finalTenantId, version_number: 1 })
            .select('id')
            .single();
          if (v?.id) setVersionId(String(v.id));
        }
      } catch {}
    };
    loadLatestVersion();
  }, [resolvedId]);

  const handleSuccess = () => {
    toast.success('Quote updated successfully');
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="space-y-2">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard/quotes">Quotes</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbItem>
                <BreadcrumbLink href={`/dashboard/quotes/${resolvedId ?? id}`}>Edit</BreadcrumbLink>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <h1 className="text-3xl font-bold">Edit Quote</h1>
          </div>
        </div>
        <QuoteForm quoteId={resolvedId ?? id} onSuccess={handleSuccess} />
        <QuotationVersionHistory quoteId={resolvedId ?? id as string} />
      </div>
    </DashboardLayout>
  );
}

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { QuoteForm } from '@/components/sales/QuoteForm';
import { QuotationVersionHistory } from '@/components/sales/QuotationVersionHistory';
import QuoteComposer from '@/components/sales/QuoteComposer';
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

  useEffect(() => {
    const checkQuote = async () => {
      try {
        if (!id) throw new Error('Missing quote identifier');
        // Allow navigating by either UUID id or quote_number (e.g., QT-2025-002)
        const { data, error } = await supabase
          .from('quotes')
          .select('id')
          .or(`id.eq.${id},quote_number.eq.${id}`)
          .limit(1)
          .single();
        if (error) throw error;
        setResolvedId((data as any)?.id ?? null);
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
        const { data, error } = await (supabase as any)
          .from('quote_versions')
          .select('id, version_number')
          .eq('quote_id', resolvedId)
          .order('version_number', { ascending: false })
          .limit(1);
        if (error) return;
        const v = Array.isArray(data) ? data[0]?.id : (data as any)?.id;
        if (v) setVersionId(v as string);
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
        {resolvedId && (
          <QuotationVersionHistory quoteId={resolvedId} />
        )}
        {resolvedId && versionId && (
          <QuoteComposer quoteId={resolvedId} versionId={versionId} />
        )}
      </div>
    </DashboardLayout>
  );
}

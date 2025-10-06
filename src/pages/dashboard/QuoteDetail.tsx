import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { QuoteForm } from '@/components/sales/QuoteForm';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';

export default function QuoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { supabase } = useCRM();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkQuote = async () => {
      try {
        const { data, error } = await supabase
          .from('quotes')
          .select('id')
          .eq('id', id)
          .single();
        if (error) throw error;
        setLoading(false);
      } catch (err: any) {
        toast.error('Failed to load quote', { description: err.message });
        navigate('/dashboard/quotes');
      }
    };
    checkQuote();
  }, [id]);

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
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Edit Quote</h1>
        </div>
        <QuoteForm quoteId={id} onSuccess={handleSuccess} />
      </div>
    </DashboardLayout>
  );
}

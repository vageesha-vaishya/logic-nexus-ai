import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { QuoteForm } from '@/components/sales/QuoteForm';

export default function QuoteNew() {
  const navigate = useNavigate();

  const handleSuccess = (quoteId: string) => {
    navigate(`/dashboard/quotes/${quoteId}`);
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">New Quote</h1>
        </div>
        <QuoteForm onSuccess={handleSuccess} />
      </div>
    </DashboardLayout>
  );
}

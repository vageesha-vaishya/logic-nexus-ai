import { useNavigate } from 'react-router-dom';
import { QuoteForm } from '@/components/sales/QuoteForm';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function QuoteNew() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/quotes')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">New Quote</h1>
          <p className="text-muted-foreground">Create a new sales quote</p>
        </div>
      </div>

      <QuoteForm onSuccess={() => navigate('/dashboard/quotes')} />
    </div>
  );
}

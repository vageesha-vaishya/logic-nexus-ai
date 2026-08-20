import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Package, Sparkles } from 'lucide-react';

export default function SmartQuoteWorkspace() {
  const navigate = useNavigate();

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-140px)] gap-6">
        <div className="flex-none flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/quotes/pipeline')} aria-label="Back to Quotes">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                Smart Quote
              </h1>
              <p className="text-sm text-muted-foreground">
                Generate instant quotes with AI-powered market analysis and route optimization.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden gap-6">
          <div className="w-[400px] shrink-0 bg-muted/30 p-6 border rounded-lg overflow-y-auto">
            {/* Task 2 adds the form here */}
          </div>
          <div className="flex-1 p-6 bg-background border rounded-lg overflow-y-auto">
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <Package className="w-12 h-12 mb-4 opacity-20" />
              <p>Fill out the form to generate quotes</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

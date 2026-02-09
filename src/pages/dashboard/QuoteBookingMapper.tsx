import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { QuoteSelectionGrid } from '@/components/quotes/QuoteSelectionGrid';
import { QuoteMappingPreview } from '@/components/quotes/QuoteMappingPreview';
import { Button } from '@/components/ui/button';
import { ChevronRight, Home, ArrowLeft } from 'lucide-react';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from '@/components/ui/breadcrumb';

export default function QuoteBookingMapper() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'select' | 'preview'>('select');
  const [selectedQuote, setSelectedQuote] = useState<any>(null);

  const handleSelectQuote = (quote: any) => {
    setSelectedQuote(quote);
    setStep('preview');
  };

  const handleBack = () => {
    if (step === 'preview') {
      setStep('select');
      setSelectedQuote(null);
    } else {
      navigate('/dashboard/bookings');
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 p-6">
        {/* Header / Breadcrumbs */}
        <div className="flex flex-col gap-2">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard" className="flex items-center gap-1">
                            <Home className="h-3 w-3" /> Dashboard
                        </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator>
                        <ChevronRight className="h-3 w-3" />
                    </BreadcrumbSeparator>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard/bookings">Bookings</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator>
                        <ChevronRight className="h-3 w-3" />
                    </BreadcrumbSeparator>
                    <BreadcrumbItem>
                        <BreadcrumbLink>Map Quote</BreadcrumbLink>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>
            
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Quote to Booking Mapping</h1>
                    <p className="text-muted-foreground">
                        {step === 'select' 
                            ? 'Select a source quotation to begin the mapping process.' 
                            : `Mapping Quote ${selectedQuote?.quote_number} to New Booking`}
                    </p>
                </div>
                {step === 'preview' && (
                    <Button variant="outline" onClick={handleBack} size="sm">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Selection
                    </Button>
                )}
            </div>
        </div>

        {/* Content Area */}
        <div className="mt-2">
            {step === 'select' ? (
                <QuoteSelectionGrid onSelectQuote={handleSelectQuote} />
            ) : (
                <QuoteMappingPreview 
                    quote={selectedQuote} 
                    onCancel={handleBack} 
                />
            )}
        </div>
      </div>
    </DashboardLayout>
  );
}

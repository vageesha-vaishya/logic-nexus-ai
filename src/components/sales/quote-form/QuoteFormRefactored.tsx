import { useState, useEffect, Suspense, lazy } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { QuoteDataProvider, useQuoteContext } from './QuoteContext';
import { QuoteHeader } from './QuoteHeader';
import { QuoteLogistics } from './QuoteLogistics';
// Lazy load non-critical components
const QuoteLineItems = lazy(() => import('./QuoteLineItems').then(module => ({ default: module.QuoteLineItems })));
const QuoteFinancials = lazy(() => import('./QuoteFinancials').then(module => ({ default: module.QuoteFinancials })));

import { quoteSchema, QuoteFormValues } from './types';
import { QuoteErrorBoundary } from './QuoteErrorBoundary';
import { MultiModalQuoteComposer } from '@/components/sales/MultiModalQuoteComposer';
import { Loader2, Save, X, LayoutDashboard } from 'lucide-react';
import { toast } from 'sonner';
import { useQuoteRepositoryForm } from './useQuoteRepository';
import { useFormDebug } from '@/hooks/useFormDebug';
import { CatalogSaveDialog } from './CatalogSaveDialog';

import { QuotePreviewModal } from '@/components/sales/QuotePreviewModal';

interface QuoteFormProps {
  quoteId?: string;
  quoteNumber?: string;
  versionId?: string;
  onSuccess?: (quoteId: string) => void;
  initialData?: Partial<QuoteFormValues>;
  autoSave?: boolean;
  initialViewMode?: 'form' | 'composer';
}

function QuoteFormContent({ quoteId, quoteNumber, versionId, onSuccess, initialData, autoSave, initialViewMode = 'form' }: QuoteFormProps) {
  const { resolvedTenantId } = useQuoteContext();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasAutoSaved, setHasAutoSaved] = useState(false);
  const [showCatalogDialog, setShowCatalogDialog] = useState(false);
  const [newCatalogItems, setNewCatalogItems] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'form' | 'composer'>(initialViewMode);
  
  // Update view mode if prop changes
  useEffect(() => {
    if (initialViewMode) {
        setViewMode(initialViewMode);
    }
  }, [initialViewMode]);
  
  const form = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteSchema),
    defaultValues: {
      status: 'draft',
      tax_percent: '0',
      shipping_amount: '0',
      notes: '',
      title: '',
      carrier_id: '',
      service_type_id: '',
      origin_port_id: '',
      destination_port_id: '',
      incoterms: '',
      ...initialData,
    },
  });

  const { saveQuote, isHydrating } = useQuoteRepositoryForm({ form, quoteId });

  // Debugging hook for form
  const formValues = form.watch();
  // Hierarchy: Sales (Module) -> Quotes (Sub-module) -> QuoteForm (Form) -> Details (Section)
  const formDebug = useFormDebug('Sales:Quotes', 'QuoteForm:Details', formValues);

  // Log validation errors
  useEffect(() => {
    if (Object.keys(form.formState.errors).length > 0) {
      formDebug.logValidationErrors(form.formState.errors);
    }
  }, [form.formState.errors]);

  useEffect(() => {
    if (initialData) {
      form.reset({
        status: 'draft',
        tax_percent: '0',
        shipping_amount: '0',
        notes: '',
        title: '',
        carrier_id: '',
        service_type_id: '',
        origin_port_id: '',
        destination_port_id: '',
        incoterms: '',
        ...initialData,
      });
    }
  }, [initialData, form]);

  // Auto-save logic for Quick Quote conversion
  useEffect(() => {
    if (autoSave && !hasAutoSaved && !quoteId && initialData && !isSubmitting) {
      console.log('[QuoteForm] Triggering auto-save from Quick Quote data...');
      const timer = setTimeout(() => {
        form.handleSubmit(onSubmit)();
        setHasAutoSaved(true);
      }, 500); // Small delay to ensure form state is settled
      return () => clearTimeout(timer);
    }
  }, [autoSave, hasAutoSaved, quoteId, initialData, form]);

  const flattenErrors = (obj: any, parentPath = ''): string[] => {
    let messages: string[] = [];
    
    if (!obj) return messages;

    if (obj.message && typeof obj.message === 'string') {
        return [`${parentPath}: ${obj.message}`];
    }

    if (typeof obj === 'object') {
        Object.keys(obj).forEach(key => {
            if (key === 'ref') return;
            
            // Format path: if key is number, use [key], else .key
            let currentPath = parentPath;
            if (!isNaN(Number(key))) {
                currentPath = `${parentPath}[${key}]`;
            } else {
                currentPath = parentPath ? `${parentPath}.${key}` : key;
            }

            messages = [...messages, ...flattenErrors(obj[key], currentPath)];
        });
    }
    return messages;
  };

  const onInvalid = (errors: any) => {
    console.error('Validation errors:', errors);
    const errorMessages = flattenErrors(errors);
    const errorCount = errorMessages.length;
    
    toast.error(`Please fix ${errorCount} error${errorCount > 1 ? 's' : ''} in the form`, {
      description: (
        <ul className="list-disc pl-4 max-h-[200px] overflow-y-auto text-sm mt-2">
            {errorMessages.map((msg, i) => (
                <li key={i}>{msg}</li>
            ))}
        </ul>
      ),
      duration: 5000,
    });
  };

  const onSubmit = async (data: QuoteFormValues): Promise<boolean> => {
    setIsSubmitting(true);
    const startTime = performance.now();
    formDebug.logSubmit(data); // Log submission start

    try {
      const savedId = await saveQuote({ quoteId, data });
      
      // Reset form with the submitted data to clear dirty state
      // This ensures that subsequent hydrations (e.g. after switching back from Composer)
      // are not blocked by the dirty check.
      form.reset(data);
      
      const duration = performance.now() - startTime;
      formDebug.logResponse(
        { success: true, savedId }, 
        { duration: `${duration.toFixed(2)}ms` }
      ); // Log success with metrics
      
      toast.success('Quote saved successfully');

      // Check for new commodities
      const newItems = data.items?.filter(item => !item.commodity_id && item.product_name) || [];
      if (newItems.length > 0) {
          setNewCatalogItems(newItems);
          toast.message('New Commodities Found', {
              description: `${newItems.length} items are not in your catalog.`,
              action: {
                  label: 'Add to Catalog',
                  onClick: () => setShowCatalogDialog(true)
              }
          });
      }

      if (onSuccess) onSuccess(savedId);
      return true;
    } catch (error: any) {
      const duration = performance.now() - startTime;
      console.error('Submission error:', error);
      formDebug.logError(error, { duration: `${duration.toFixed(2)}ms` }); // Log error with metrics
      const description = error?.message || 'Unexpected error during save';
      toast.error('Failed to save quote', { description });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-8 pb-20">
        <CatalogSaveDialog 
            open={showCatalogDialog} 
            onOpenChange={setShowCatalogDialog} 
            items={newCatalogItems} 
        />
        
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b pb-4 pt-2 -mx-4 px-4 md:-mx-8 md:px-8 mb-6 flex justify-between items-center transition-all duration-200">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-primary rounded-lg shadow-sm">
                    <LayoutDashboard className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">
                        {quoteId ? 'Edit Quote' : 'New Quote'}
                    </h2>
                    <p className="text-sm text-muted-foreground hidden md:block">
                        {quoteId ? `Quote #: ${quoteNumber || quoteId}` : 'Create a new logistics quotation'}
                    </p>
                </div>
            </div>
            <div className="flex gap-3">
                 {quoteId && (
                    <>
                        <QuotePreviewModal 
                            quoteId={quoteId} 
                            quoteNumber={quoteNumber || quoteId} 
                            versionId={versionId}
                        />
                        <Button 
                            type="button" 
                            variant="outline" 
                            onClick={viewMode === 'form' ? form.handleSubmit(async (data) => {
                                const success = await onSubmit(data);
                                if (success) setViewMode('composer');
                            }, onInvalid) : () => setViewMode('form')}
                            className="gap-2"
                            disabled={isSubmitting || isHydrating}
                        >
                            <LayoutDashboard className="h-4 w-4" />
                            {isSubmitting ? 'Saving...' : (viewMode === 'form' ? 'Save & Switch to Composer' : 'Back to Form')}
                        </Button>
                    </>
                 )}
                 {quoteId && viewMode === 'form' && (
                     <Button 
                        type="button" 
                        variant="secondary"
                        onClick={form.handleSubmit(async (data) => {
                            const success = await onSubmit(data);
                            if (success) {
                                setViewMode('composer');
                            }
                        }, onInvalid)}
                        disabled={isSubmitting || isHydrating}
                        className="gap-2"
                     >
                        <Save className="h-4 w-4" />
                        Save & Compose
                     </Button>
                 )}
                 <Button type="button" variant="outline" onClick={() => window.history.back()} className="gap-2">
                    <X className="h-4 w-4" />
                    Cancel
                 </Button>
                 <Button type="submit" disabled={isSubmitting || isHydrating} className="gap-2 shadow-sm" data-testid="save-quote-btn">
                    {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Save className="h-4 w-4" />
                    )}
                    Save Quote
                 </Button>
            </div>
        </div>

        {isHydrating ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground animate-pulse">Loading quote details...</p>
          </div>
        ) : viewMode === 'composer' && quoteId ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <MultiModalQuoteComposer 
                    quoteId={quoteId}
                    versionId={versionId}
                    tenantId={resolvedTenantId || undefined}
                />
            </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className="space-y-4">
                <div className="flex items-center gap-2 text-primary/80 font-medium px-1">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-primary/30 bg-primary/5 text-xs">1</span>
                    <h3>General Information</h3>
                </div>
                <QuoteHeader quoteNumber={quoteNumber || quoteId} />
            </section>
            
            <section className="space-y-4">
                <div className="flex items-center gap-2 text-primary/80 font-medium px-1">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-primary/30 bg-primary/5 text-xs">2</span>
                    <h3>Logistics & Routing</h3>
                </div>
                <QuoteLogistics />
            </section>

            <section className="space-y-4">
                <div className="flex items-center gap-2 text-primary/80 font-medium px-1">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-primary/30 bg-primary/5 text-xs">3</span>
                    <h3>Cargo & Commodity Details</h3>
                </div>
                <Suspense fallback={<div className="h-40 flex items-center justify-center border rounded-lg bg-muted/10"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
                    <QuoteLineItems />
                </Suspense>
            </section>
            
            <section className="space-y-4">
                <div className="flex items-center gap-2 text-primary/80 font-medium px-1">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-primary/30 bg-primary/5 text-xs">4</span>
                    <h3>Financials</h3>
                </div>
                <Suspense fallback={<div className="h-40 flex items-center justify-center border rounded-lg bg-muted/10"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
                    <QuoteFinancials />
                </Suspense>
            </section>
        </div>
        )}
      </form>
    </FormProvider>
  );
}

export function QuoteFormRefactored(props: QuoteFormProps) {
  return (
    <QuoteErrorBoundary>
      <QuoteDataProvider>
        <QuoteFormContent {...props} />
      </QuoteDataProvider>
    </QuoteErrorBoundary>
  );
}

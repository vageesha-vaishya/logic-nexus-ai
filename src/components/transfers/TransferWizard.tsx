import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TransferService, TransferType, TransferEntityType, TransferValidationResult, CreateTransferPayload } from '@/lib/transfer-service';
import { ScopedDataAccess } from '@/lib/db/access';
import { TransferTypeSelector } from './TransferTypeSelector';
import { EntitySelector } from './EntitySelector';
import { DestinationSelector } from './DestinationSelector';
import { TransferReview } from './TransferReview';
import { useCRM } from '@/hooks/useCRM';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight, Loader2, Send } from 'lucide-react';

interface TransferWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const STEPS = [
  { id: 'type', label: 'Transfer Type' },
  { id: 'entities', label: 'Select Entities' },
  { id: 'destination', label: 'Destination' },
  { id: 'review', label: 'Review & Submit' },
];

export function TransferWizard({ open, onOpenChange, onSuccess }: TransferWizardProps) {
  const { context, supabase } = useCRM();
  const dao = new ScopedDataAccess(supabase, context);
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<TransferValidationResult | undefined>();
  
  // Form state
  const [transferType, setTransferType] = useState<TransferType>('tenant_to_tenant');
  const [selectedEntities, setSelectedEntities] = useState<{ type: TransferEntityType; id: string; name: string }[]>([]);
  const [targetTenantId, setTargetTenantId] = useState('');
  const [targetFranchiseId, setTargetFranchiseId] = useState('');
  
  // Tenant/Franchise data for display
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([]);
  const [franchises, setFranchises] = useState<{ id: string; name: string }[]>([]);

  // Load tenants for display
  useEffect(() => {
    const load = async () => {
      try {
        const data = await TransferService.getAvailableTenants(dao);
        setTenants(data);
      } catch (e) {
        console.error(e);
      }
    };
    if (open) load();
  }, [open]);

  // Load franchises when target tenant changes
  useEffect(() => {
    const load = async () => {
      if (!targetTenantId) return;
      try {
        const data = await TransferService.getFranchisesForTenant(targetTenantId);
        setFranchises(data);
      } catch (e) {
        console.error(e);
      }
    };
    load();
  }, [targetTenantId]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setCurrentStep(0);
      setTransferType('tenant_to_tenant');
      setSelectedEntities([]);
      setTargetTenantId('');
      setTargetFranchiseId('');
      setValidation(undefined);
    }
  }, [open]);

  // Validate when reaching review step
  useEffect(() => {
    const validate = async () => {
      if (currentStep !== 3) return;
      
      setValidating(true);
      try {
        const payload = buildPayload();
        if (payload) {
          const result = await TransferService.validateTransfer(payload);
          setValidation(result);
        }
      } catch (error) {
        console.error('Validation error:', error);
      } finally {
        setValidating(false);
      }
    };
    
    validate();
  }, [currentStep]);

  const buildPayload = (): CreateTransferPayload | null => {
    if (!context?.tenantId) return null;

    return {
      source_tenant_id: context.tenantId,
      source_franchise_id: context.franchiseId || undefined,
      target_tenant_id: transferType === 'franchise_to_franchise' ? context.tenantId : targetTenantId,
      target_franchise_id: targetFranchiseId || undefined,
      transfer_type: transferType,
      items: selectedEntities.map(e => ({ entity_type: e.type, entity_id: e.id })),
    };
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: // Transfer type
        return true;
      case 1: // Entity selection
        return selectedEntities.length > 0;
      case 2: // Destination
        if (transferType === 'tenant_to_tenant') {
          return !!targetTenantId;
        }
        if (transferType === 'tenant_to_franchise') {
          return !!targetTenantId && !!targetFranchiseId;
        }
        if (transferType === 'franchise_to_franchise') {
          return !!targetFranchiseId;
        }
        return false;
      case 3: // Review
        return validation?.valid === true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    const payload = buildPayload();
    if (!payload) {
      toast({ title: 'Error', description: 'Missing required data', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      await TransferService.createTransfer(dao, payload);
      toast({
        title: 'Transfer Request Created',
        description: `${selectedEntities.length} entities queued for transfer approval.`,
      });
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Error Creating Transfer',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const sourceTenant = tenants.find(t => t.id === context?.tenantId);
  const targetTenant = tenants.find(t => t.id === (transferType === 'franchise_to_franchise' ? context?.tenantId : targetTenantId));
  const sourceFranchise = franchises.find(f => f.id === context?.franchiseId);
  const targetFranchise = franchises.find(f => f.id === targetFranchiseId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Create Transfer Request</DialogTitle>
          <DialogDescription>
            Move records between tenants or franchises with approval workflow
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            {STEPS.map((step, index) => (
              <span 
                key={step.id}
                className={index <= currentStep ? 'text-primary font-medium' : ''}
              >
                {step.label}
              </span>
            ))}
          </div>
          <Progress value={(currentStep + 1) / STEPS.length * 100} />
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto py-4 min-h-[400px]">
          {currentStep === 0 && (
            <TransferTypeSelector
              value={transferType}
              onChange={setTransferType}
            />
          )}

          {currentStep === 1 && context?.tenantId && (
            <EntitySelector
              tenantId={context.tenantId}
              franchiseId={context.franchiseId}
              selectedEntities={selectedEntities}
              onSelectionChange={setSelectedEntities}
            />
          )}

          {currentStep === 2 && context?.tenantId && (
            <DestinationSelector
              transferType={transferType}
              sourceTenantId={context.tenantId}
              sourceFranchiseId={context.franchiseId}
              targetTenantId={targetTenantId}
              targetFranchiseId={targetFranchiseId}
              onTargetTenantChange={setTargetTenantId}
              onTargetFranchiseChange={setTargetFranchiseId}
            />
          )}

          {currentStep === 3 && (
            validating ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-3 text-muted-foreground">Validating transfer...</span>
              </div>
            ) : (
              <TransferReview
                transferType={transferType}
                sourceTenant={sourceTenant}
                sourceFranchise={sourceFranchise}
                targetTenant={targetTenant}
                targetFranchise={targetFranchise}
                selectedEntities={selectedEntities}
                validation={validation}
              />
            )
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 0}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          {currentStep < STEPS.length - 1 ? (
            <Button onClick={handleNext} disabled={!canProceed()}>
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button 
              onClick={handleSubmit} 
              disabled={!canProceed() || submitting}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Submit Transfer Request
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

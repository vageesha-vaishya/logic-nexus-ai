import { TransferType, TransferEntityType, TransferValidationResult } from '@/lib/transfer-service';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowRight, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TransferReviewProps {
  transferType: TransferType;
  sourceTenant?: { id: string; name: string };
  sourceFranchise?: { id: string; name: string };
  targetTenant?: { id: string; name: string };
  targetFranchise?: { id: string; name: string };
  selectedEntities: { type: TransferEntityType; id: string; name: string }[];
  validation?: TransferValidationResult;
}

export function TransferReview({
  transferType,
  sourceTenant,
  sourceFranchise,
  targetTenant,
  targetFranchise,
  selectedEntities,
  validation,
}: TransferReviewProps) {
  const groupedEntities = selectedEntities.reduce((acc, entity) => {
    if (!acc[entity.type]) acc[entity.type] = [];
    acc[entity.type].push(entity);
    return acc;
  }, {} as Record<TransferEntityType, typeof selectedEntities>);

  const typeLabels: Record<TransferEntityType, string> = {
    lead: 'Leads',
    opportunity: 'Opportunities',
    quote: 'Quotes',
    shipment: 'Shipments',
    account: 'Accounts',
    contact: 'Contacts',
    activity: 'Activities',
  };

  const getSourceLabel = () => {
    if (sourceFranchise) {
      return `${sourceTenant?.name} → ${sourceFranchise.name}`;
    }
    return sourceTenant?.name || 'Unknown Source';
  };

  const getTargetLabel = () => {
    if (targetFranchise) {
      return `${targetTenant?.name} → ${targetFranchise.name}`;
    }
    return targetTenant?.name || 'Unknown Target';
  };

  return (
    <div className="space-y-6">
      <h4 className="font-medium">Review Transfer</h4>

      {/* Transfer Flow Visualization */}
      <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
        <div className="flex-1 text-center">
          <p className="text-sm text-muted-foreground">From</p>
          <p className="font-medium">{getSourceLabel()}</p>
        </div>
        <ArrowRight className="h-6 w-6 text-muted-foreground" />
        <div className="flex-1 text-center">
          <p className="text-sm text-muted-foreground">To</p>
          <p className="font-medium">{getTargetLabel()}</p>
        </div>
      </div>

      {/* Transfer Type Badge */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Transfer Type:</span>
        <Badge variant="outline" className="capitalize">
          {transferType.replace(/_/g, ' ')}
        </Badge>
      </div>

      {/* Validation Results */}
      {validation && (
        <div className="space-y-3">
          {validation.errors.length > 0 && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Validation Errors</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside mt-2">
                  {validation.errors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {validation.warnings.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Warnings</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside mt-2">
                  {validation.warnings.map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {validation.valid && validation.warnings.length === 0 && (
            <Alert className="border-green-500 bg-green-50 dark:bg-green-950/20">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-600">Ready to Transfer</AlertTitle>
              <AlertDescription className="text-green-600/80">
                All validation checks passed. This transfer is ready to be submitted.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Selected Entities Summary */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Selected Entities</span>
          <Badge variant="secondary">{selectedEntities.length} total</Badge>
        </div>

        <ScrollArea className="h-[200px] rounded-md border">
          <div className="p-4 space-y-4">
            {Object.entries(groupedEntities).map(([type, entities]) => (
              <div key={type}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium">{typeLabels[type as TransferEntityType]}</span>
                  <Badge variant="outline" className="text-xs">{entities.length}</Badge>
                </div>
                <div className="space-y-1">
                  {entities.map((entity) => (
                    <div key={entity.id} className="text-sm text-muted-foreground flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-primary" />
                      <span className="truncate">{entity.name}</span>
                      <span className="text-xs opacity-50">({entity.id.slice(0, 8)})</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

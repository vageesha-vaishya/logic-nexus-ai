import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface SequencesAndPreviewProps {
  tenantIdOverride?: string;
  franchiseIdOverride?: string;
}

export default function SequencesAndPreview({ tenantIdOverride, franchiseIdOverride }: SequencesAndPreviewProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Quote Number Sequences</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This feature requires database migration. The required tables (quote_number_sequences, quote_number_config_tenant, quote_number_config_franchise) have not been created yet.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Quote number preview will be available once the configuration tables are set up.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface FranchiseConfigFormProps {
  franchiseIdOverride?: string;
  tenantIdOverride?: string;
}

export default function FranchiseConfigForm({ franchiseIdOverride, tenantIdOverride }: FranchiseConfigFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Franchise Configuration</CardTitle>
      </CardHeader>
      <CardContent>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This feature requires database migration. The required tables (quote_number_config_franchise) have not been created yet.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface TenantConfigFormProps {
  tenantIdOverride?: string;
}

export default function TenantConfigForm({ tenantIdOverride }: TenantConfigFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tenant Configuration</CardTitle>
      </CardHeader>
      <CardContent>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This feature requires database migration. The required tables (quote_number_config_tenant) have not been created yet.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
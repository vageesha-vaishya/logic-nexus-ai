import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, AlertCircle, Eye, EyeOff, Link2, Database, Key, Shield } from 'lucide-react';
import { SupabaseConnectionConfig, ConnectionValidationResult } from '@/types/database-migration';

interface ConnectionConfigFormProps {
  onValidate: (config: SupabaseConnectionConfig) => Promise<ConnectionValidationResult>;
  validationResult: ConnectionValidationResult;
  onConfigChange?: (config: SupabaseConnectionConfig) => void;
}

export function ConnectionConfigForm({ onValidate, validationResult, onConfigChange }: ConnectionConfigFormProps) {
  const [config, setConfig] = useState<SupabaseConnectionConfig>({
    projectUrl: '',
    dbHost: '',
    dbPort: 5432,
    dbName: 'postgres',
    apiKey: '',
    serviceRoleKey: '',
    sslMode: 'require'
  });

  const [showApiKey, setShowApiKey] = useState(false);
  const [showServiceKey, setShowServiceKey] = useState(false);

  const handleChange = (field: keyof SupabaseConnectionConfig, value: string | number) => {
    const newConfig = { ...config, [field]: value };
    setConfig(newConfig);
    onConfigChange?.(newConfig);

    // Auto-populate db host from project URL
    if (field === 'projectUrl' && typeof value === 'string') {
      const match = value.match(/https:\/\/([a-z0-9-]+)\.supabase\.co/);
      if (match) {
        const projectRef = match[1];
        const updatedConfig = {
          ...newConfig,
          dbHost: `db.${projectRef}.supabase.co`
        };
        setConfig(updatedConfig);
        onConfigChange?.(updatedConfig);
      }
    }
  };

  const handleValidate = () => {
    onValidate(config);
  };

  const isFormValid = config.projectUrl && config.apiKey;

  const getStatusIcon = () => {
    switch (validationResult.status) {
      case 'validating':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = () => {
    switch (validationResult.status) {
      case 'validating':
        return <Badge variant="secondary">Validating...</Badge>;
      case 'success':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Connected</Badge>;
      case 'error':
        return <Badge variant="destructive">Connection Failed</Badge>;
      default:
        return <Badge variant="outline">Not Connected</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Target Database Configuration
            </CardTitle>
            <CardDescription>
              Configure the connection to your target Supabase project
            </CardDescription>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Project URL */}
        <div className="space-y-2">
          <Label htmlFor="projectUrl" className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Supabase Project URL
          </Label>
          <Input
            id="projectUrl"
            placeholder="https://[project-ref].supabase.co"
            value={config.projectUrl}
            onChange={(e) => handleChange('projectUrl', e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Find this in your Supabase dashboard → Settings → API
          </p>
        </div>

        {/* Database Connection */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="dbHost">Database Host</Label>
            <Input
              id="dbHost"
              placeholder="db.[project-ref].supabase.co"
              value={config.dbHost}
              onChange={(e) => handleChange('dbHost', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dbPort">Port</Label>
            <Input
              id="dbPort"
              type="number"
              value={config.dbPort}
              onChange={(e) => handleChange('dbPort', parseInt(e.target.value) || 5432)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dbName">Database Name</Label>
            <Input
              id="dbName"
              value={config.dbName}
              onChange={(e) => handleChange('dbName', e.target.value)}
            />
          </div>
        </div>

        {/* API Keys */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apiKey" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              API Key (anon/public)
            </Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={showApiKey ? 'text' : 'password'}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={config.apiKey}
                onChange={(e) => handleChange('apiKey', e.target.value)}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="serviceRoleKey" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Service Role Key (optional, for full access)
            </Label>
            <div className="relative">
              <Input
                id="serviceRoleKey"
                type={showServiceKey ? 'text' : 'password'}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={config.serviceRoleKey}
                onChange={(e) => handleChange('serviceRoleKey', e.target.value)}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowServiceKey(!showServiceKey)}
              >
                {showServiceKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Required for bypassing RLS and accessing protected schemas
            </p>
          </div>
        </div>

        {/* SSL Configuration */}
        <div className="space-y-2">
          <Label htmlFor="sslMode">SSL Mode</Label>
          <Select
            value={config.sslMode}
            onValueChange={(value) => handleChange('sslMode', value as any)}
          >
            <SelectTrigger id="sslMode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="require">Require (Recommended)</SelectItem>
              <SelectItem value="verify-ca">Verify CA</SelectItem>
              <SelectItem value="verify-full">Verify Full</SelectItem>
              <SelectItem value="disable">Disable (Not Recommended)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Validation Status */}
        {validationResult.status !== 'idle' && (
          <div className={`p-4 rounded-lg border ${
            validationResult.status === 'success' 
              ? 'bg-green-500/5 border-green-500/20' 
              : validationResult.status === 'error'
              ? 'bg-destructive/5 border-destructive/20'
              : 'bg-muted'
          }`}>
            <div className="flex items-start gap-3">
              {getStatusIcon()}
              <div className="flex-1">
                <p className={`text-sm font-medium ${
                  validationResult.status === 'success' 
                    ? 'text-green-600' 
                    : validationResult.status === 'error'
                    ? 'text-destructive'
                    : ''
                }`}>
                  {validationResult.message}
                </p>
                {validationResult.details && (
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      {validationResult.details.networkConnectivity ? 
                        <CheckCircle2 className="h-3 w-3 text-green-500" /> : 
                        <XCircle className="h-3 w-3 text-destructive" />}
                      Network Connectivity
                    </div>
                    <div className="flex items-center gap-2">
                      {validationResult.details.credentialValidity ? 
                        <CheckCircle2 className="h-3 w-3 text-green-500" /> : 
                        <XCircle className="h-3 w-3 text-destructive" />}
                      Credential Validity
                    </div>
                    <div className="flex items-center gap-2">
                      {validationResult.details.databaseAccessible ? 
                        <CheckCircle2 className="h-3 w-3 text-green-500" /> : 
                        <XCircle className="h-3 w-3 text-destructive" />}
                      Database Accessible
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Validate Button */}
        <Button
          onClick={handleValidate}
          disabled={!isFormValid || validationResult.status === 'validating'}
          className="w-full"
        >
          {validationResult.status === 'validating' ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Validating Connection...
            </>
          ) : (
            <>
              <Database className="mr-2 h-4 w-4" />
              Validate Connection
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

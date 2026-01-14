import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, Database, CheckCircle2, XCircle, Eye, EyeOff, Server } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ExternalDbConnection {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean | 'require' | 'prefer' | 'disable';
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  connectionInfo?: {
    version: string;
    database: string;
    user: string;
  };
}

interface ExternalDbConnectionFormProps {
  connection: ExternalDbConnection;
  onChange: (connection: ExternalDbConnection) => void;
  onConnectionTested?: (result: ConnectionTestResult) => void;
  disabled?: boolean;
}

const CONNECTION_PRESETS = {
  custom: { label: 'Custom', host: '', port: 5432 },
  aws_rds: { label: 'AWS RDS', host: '.rds.amazonaws.com', port: 5432 },
  azure: { label: 'Azure PostgreSQL', host: '.postgres.database.azure.com', port: 5432 },
  gcp: { label: 'GCP Cloud SQL', host: '', port: 5432 },
  supabase: { label: 'Supabase', host: '.supabase.co', port: 5432 },
  local: { label: 'Local Docker', host: 'localhost', port: 5432 },
};

export function ExternalDbConnectionForm({ 
  connection, 
  onChange, 
  onConnectionTested,
  disabled = false 
}: ExternalDbConnectionFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [preset, setPreset] = useState<keyof typeof CONNECTION_PRESETS>('custom');

  const handlePresetChange = (value: keyof typeof CONNECTION_PRESETS) => {
    setPreset(value);
    const p = CONNECTION_PRESETS[value];
    onChange({
      ...connection,
      host: p.host === 'localhost' ? p.host : connection.host,
      port: p.port,
    });
  };

  const handleChange = (field: keyof ExternalDbConnection, value: string | number | boolean) => {
    setTestResult(null); // Reset test result on change
    onChange({ ...connection, [field]: value });
  };

  const testConnection = async () => {
    if (!connection.host || !connection.database || !connection.user) {
      toast.error('Please fill in all required fields');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('execute-sql-external', {
        body: {
          action: 'test',
          connection: {
            host: connection.host,
            port: connection.port,
            database: connection.database,
            user: connection.user,
            password: connection.password,
            ssl: connection.ssl,
          },
        },
      });

      if (error) throw error;

      const result: ConnectionTestResult = data;
      setTestResult(result);
      
      if (result.success) {
        toast.success('Connection successful!');
      } else {
        toast.error(result.message);
      }
      
      onConnectionTested?.(result);
    } catch (err: any) {
      const result: ConnectionTestResult = {
        success: false,
        message: err.message || 'Connection test failed',
      };
      setTestResult(result);
      toast.error(result.message);
      onConnectionTested?.(result);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Target Database Connection</CardTitle>
          </div>
          {testResult && (
            <Badge variant={testResult.success ? 'default' : 'destructive'}>
              {testResult.success ? (
                <><CheckCircle2 className="h-3 w-3 mr-1" /> Connected</>
              ) : (
                <><XCircle className="h-3 w-3 mr-1" /> Failed</>
              )}
            </Badge>
          )}
        </div>
        <CardDescription>
          Enter the connection details for the external PostgreSQL database
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Preset Selector */}
        <div className="space-y-2">
          <Label>Preset Configuration</Label>
          <Select value={preset} onValueChange={(v) => handlePresetChange(v as keyof typeof CONNECTION_PRESETS)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CONNECTION_PRESETS).map(([key, val]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4" />
                    {val.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Host and Port */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 space-y-2">
            <Label htmlFor="host">Host <span className="text-destructive">*</span></Label>
            <Input
              id="host"
              placeholder="db.example.com"
              value={connection.host}
              onChange={(e) => handleChange('host', e.target.value)}
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="port">Port</Label>
            <Input
              id="port"
              type="number"
              placeholder="5432"
              value={connection.port}
              onChange={(e) => handleChange('port', parseInt(e.target.value) || 5432)}
              disabled={disabled}
            />
          </div>
        </div>

        {/* Database Name */}
        <div className="space-y-2">
          <Label htmlFor="database">Database Name <span className="text-destructive">*</span></Label>
          <Input
            id="database"
            placeholder="postgres"
            value={connection.database}
            onChange={(e) => handleChange('database', e.target.value)}
            disabled={disabled}
          />
        </div>

        {/* Username */}
        <div className="space-y-2">
          <Label htmlFor="user">Username <span className="text-destructive">*</span></Label>
          <Input
            id="user"
            placeholder="postgres"
            value={connection.user}
            onChange={(e) => handleChange('user', e.target.value)}
            disabled={disabled}
          />
        </div>

        {/* Password */}
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={connection.password}
              onChange={(e) => handleChange('password', e.target.value)}
              disabled={disabled}
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* SSL Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>SSL/TLS Encryption</Label>
            <p className="text-sm text-muted-foreground">
              Enable secure connection (recommended)
            </p>
          </div>
          <Switch
            checked={connection.ssl === true || connection.ssl === 'require'}
            onCheckedChange={(checked) => handleChange('ssl', checked ? 'require' : 'disable')}
            disabled={disabled}
          />
        </div>

        {/* Connection Info Display */}
        {testResult?.success && testResult.connectionInfo && (
          <div className="rounded-md bg-muted p-3 space-y-1 text-sm">
            <p><span className="font-medium">Version:</span> {testResult.connectionInfo.version.substring(0, 60)}...</p>
            <p><span className="font-medium">Database:</span> {testResult.connectionInfo.database}</p>
            <p><span className="font-medium">User:</span> {testResult.connectionInfo.user}</p>
          </div>
        )}

        {/* Test Connection Button */}
        <Button
          onClick={testConnection}
          disabled={disabled || testing || !connection.host || !connection.database || !connection.user}
          className="w-full"
          variant={testResult?.success ? 'outline' : 'default'}
        >
          {testing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Testing Connection...
            </>
          ) : testResult?.success ? (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Re-test Connection
            </>
          ) : (
            <>
              <Database className="mr-2 h-4 w-4" />
              Test Connection
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

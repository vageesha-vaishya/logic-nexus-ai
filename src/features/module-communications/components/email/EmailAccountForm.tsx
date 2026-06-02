import React, { useState, useEffect } from 'react';
import { IEmailProvider } from '@/services/email/plugins/IEmailProvider';
import { emailPluginRegistry } from '@/services/email/EmailPluginRegistry';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface EmailAccountFormProps {
  providerId: string;
  onChange: (config: any) => void;
  initialValues?: any;
}

export function EmailAccountForm({ providerId, onChange, initialValues = {} }: EmailAccountFormProps) {
  const [config, setConfig] = useState<any>(initialValues);
  const [provider, setProvider] = useState<IEmailProvider | undefined>(
    emailPluginRegistry.getPlugin(providerId)
  );

  useEffect(() => {
    const newProvider = emailPluginRegistry.getPlugin(providerId);
    setProvider(newProvider);
    // When provider changes, we might want to reset config or keep common fields?
    // For now, keep config but maybe clear provider-specific ones if needed.
    // Actually, usually the parent handles state.
  }, [providerId]);

  // Update internal state if initialValues change (e.g. when editing)
  useEffect(() => {
    setConfig(initialValues);
  }, [initialValues]);

  const handleChange = (key: string, value: any) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    onChange(newConfig);
  };

  if (!provider) {
    return <div>Provider not found</div>;
  }

  return (
    <div className="space-y-4">
      {provider.getConfigFields().map((field) => (
        <div key={field.key} className="space-y-2">
          <Label htmlFor={field.key}>
            {field.label} {field.required && <span className="text-red-500">*</span>}
          </Label>
          
          {field.type === 'text' || field.type === 'password' || field.type === 'number' ? (
            <Input
              id={field.key}
              type={field.type}
              placeholder={field.placeholder}
              value={config[field.key] || ''}
              onChange={(e) => handleChange(field.key, e.target.value)}
              required={field.required}
            />
          ) : field.type === 'boolean' ? (
             <div className="flex items-center space-x-2">
              <Switch
                id={field.key}
                checked={config[field.key] !== false} // Default to true if undefined/null usually means true for TLS/SSL
                onCheckedChange={(checked) => handleChange(field.key, checked)}
              />
              <Label htmlFor={field.key} className="font-normal">{field.label}</Label>
            </div>
          ) : field.type === 'select' ? (
            <Select 
                value={config[field.key]} 
                onValueChange={(val) => handleChange(field.key, val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          
          {field.helperText && (
            <p className="text-sm text-muted-foreground">{field.helperText}</p>
          )}
        </div>
      ))}
    </div>
  );
}

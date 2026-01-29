import React from 'react';
import { PluginFormConfig, FormField } from '@/services/plugins/IPlugin';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DynamicFormRendererProps {
  config: PluginFormConfig;
  values: Record<string, any>;
  onChange: (fieldId: string, value: any) => void;
  errors?: Record<string, string>;
  className?: string;
}

export function DynamicFormRenderer({ config, values, onChange, errors, className }: DynamicFormRendererProps) {
  
  const renderField = (field: FormField) => {
    const value = values[field.id] !== undefined ? values[field.id] : (field.defaultValue || '');
    const error = errors?.[field.id];

    switch (field.type) {
      case 'text':
      case 'number':
      case 'location': // Using text input for location for now, can be enhanced with autocomplete later
        return (
          <div className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </Label>
            <Input
              id={field.id}
              type={field.type === 'number' ? 'number' : 'text'}
              value={value}
              onChange={(e) => onChange(field.id, field.type === 'number' ? Number(e.target.value) : e.target.value)}
              placeholder={field.label}
              className={error ? 'border-red-500' : ''}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        );

      case 'select':
        return (
          <div className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </Label>
            <Select
              value={value as string}
              onValueChange={(val) => onChange(field.id, val)}
            >
              <SelectTrigger id={field.id} className={error ? 'border-red-500' : ''}>
                <SelectValue placeholder={`Select ${field.label}`} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        );

      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={field.id}
              checked={!!value}
              onCheckedChange={(checked) => onChange(field.id, checked)}
            />
            <Label htmlFor={field.id}>
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </Label>
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        );
      
      case 'date':
        return (
             <div className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </Label>
            <Input
              id={field.id}
              type="date"
              value={value}
              onChange={(e) => onChange(field.id, e.target.value)}
              className={error ? 'border-red-500' : ''}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        );

      default:
        return (
          <div className="p-4 border border-dashed rounded text-gray-500">
            Unsupported field type: {field.type}
          </div>
        );
    }
  };

  return (
    <div className={`space-y-6 ${className || ''}`}>
      {config.sections.map((section) => (
        <Card key={section.id}>
          <CardHeader>
            <CardTitle className="text-lg font-medium">{section.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {section.fields.map((field) => (
              <div key={field.id} className={field.hidden ? 'hidden' : ''}>
                {renderField(field)}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

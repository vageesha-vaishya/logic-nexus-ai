import { useEffect, useState } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

export type ServiceAttributeDefinition = {
  id: string;
  attribute_key: string;
  label: string;
  data_type: 'text' | 'number' | 'boolean' | 'select' | 'json' | 'date';
  validation_rules: any;
  is_required: boolean;
  display_order: number;
};

interface ServiceAttributeRendererProps {
  serviceTypeId: string | null;
  value: Record<string, any>;
  onChange: (value: Record<string, any>) => void;
  readOnly?: boolean;
}

export function ServiceAttributeRenderer({
  serviceTypeId,
  value,
  onChange,
  readOnly = false
}: ServiceAttributeRendererProps) {
  const { scopedDb } = useCRM();
  const [definitions, setDefinitions] = useState<ServiceAttributeDefinition[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!serviceTypeId) {
      setDefinitions([]);
      return;
    }

    const fetchDefinitions = async () => {
      setLoading(true);
      try {
        const { data, error } = await (scopedDb as any)
          .from('service_attribute_definitions')
          .select('*')
          .eq('service_type_id', serviceTypeId)
          .order('display_order');
        
        if (error) throw error;
        setDefinitions(data as ServiceAttributeDefinition[]);
      } catch (err) {
        console.error('Failed to fetch attribute definitions:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDefinitions();
  }, [serviceTypeId, scopedDb]);

  const handleChange = (key: string, newValue: any) => {
    onChange({
      ...value,
      [key]: newValue
    });
  };

  if (!serviceTypeId) return null;
  if (loading) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading attributes...</div>;
  if (definitions.length === 0) return null; // No custom attributes for this type

  return (
    <div className="space-y-4 border rounded-md p-4 bg-muted/20">
      <h4 className="text-sm font-medium mb-2">Service Details</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {definitions.map((def) => (
          <div key={def.id} className="space-y-2">
            <Label>
              {def.label}
              {def.is_required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            
            {def.data_type === 'select' && (
              <Select
                disabled={readOnly}
                value={String(value[def.attribute_key] || '')}
                onValueChange={(val) => handleChange(def.attribute_key, val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {def.validation_rules?.options?.map((opt: string) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {def.data_type === 'boolean' && (
              <div className="flex items-center h-10">
                <Switch
                  disabled={readOnly}
                  checked={!!value[def.attribute_key]}
                  onCheckedChange={(val) => handleChange(def.attribute_key, val)}
                />
                <span className="ml-2 text-sm text-muted-foreground">
                  {value[def.attribute_key] ? 'Yes' : 'No'}
                </span>
              </div>
            )}

            {def.data_type === 'number' && (
              <Input
                type="number"
                disabled={readOnly}
                value={value[def.attribute_key] ?? ''}
                onChange={(e) => handleChange(def.attribute_key, e.target.value === '' ? null : Number(e.target.value))}
                min={def.validation_rules?.min}
                max={def.validation_rules?.max}
              />
            )}

            {def.data_type === 'text' && (
              <Input
                type="text"
                disabled={readOnly}
                value={value[def.attribute_key] || ''}
                onChange={(e) => handleChange(def.attribute_key, e.target.value)}
              />
            )}

            {def.data_type === 'json' && (
               <Textarea
                 disabled={readOnly}
                 value={typeof value[def.attribute_key] === 'object' ? JSON.stringify(value[def.attribute_key], null, 2) : (value[def.attribute_key] || '')}
                 onChange={(e) => {
                    try {
                        const parsed = JSON.parse(e.target.value);
                        handleChange(def.attribute_key, parsed);
                    } catch {
                        // Allow typing invalid JSON temporarily (or handle differently)
                        // For now, simple text entry that tries to parse on change
                        handleChange(def.attribute_key, e.target.value);
                    }
                 }}
                 placeholder="{}"
                 className="font-mono text-xs"
               />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

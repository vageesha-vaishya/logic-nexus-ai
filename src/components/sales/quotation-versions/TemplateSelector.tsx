
import React, { useEffect, useState } from 'react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useCRM } from '@/hooks/useCRM';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Template {
  id: string;
  name: string;
  is_active: boolean;
}

interface TemplateSelectorProps {
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function TemplateSelector({ value, onChange, disabled, tenantId }: TemplateSelectorProps & { tenantId?: string | null }) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const { context } = useCRM();

  useEffect(() => {
    const fetchTemplates = async () => {
      const effectiveTenantId = tenantId !== undefined ? tenantId : context.tenantId;

      setLoading(true);
      try {
        let query = supabase
          .from('quote_templates')
          .select('id, name, is_active')
          .eq('is_active', true)
          .order('name', { ascending: true });

        if (effectiveTenantId) {
          query = query.eq('tenant_id', effectiveTenantId);
        } else {
          // Explicitly fetch global templates if tenantId is null
          query = query.is('tenant_id', null);
        }

        const { data, error } = await query;

        if (error) throw error;

        const fetchedTemplates = data || [];
        setTemplates(fetchedTemplates);

        // Default to "MGL-Main-Template" if no value is selected
        if (!value && fetchedTemplates.length > 0) {
          const defaultTemplate = fetchedTemplates.find(
            (t) => t.name === 'MGL-Main-Template'
          );
          if (defaultTemplate) {
            onChange(defaultTemplate.id);
          }
        }
      } catch (err: any) {
        console.error('Error fetching templates:', err);
        toast.error('Failed to load templates');
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, [context.tenantId, tenantId]); // Run when tenantId changes

  const selectedTemplate = templates.find((t) => t.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[250px] justify-between"
          disabled={disabled || loading}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </span>
          ) : value ? (
            selectedTemplate?.name || 'Select template...'
          ) : (
            'Select template...'
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0">
        <Command>
          <CommandInput placeholder="Search template..." />
          <CommandEmpty>No template found.</CommandEmpty>
          <CommandGroup>
            {templates.map((template) => (
              <CommandItem
                key={template.id}
                value={template.name}
                onSelect={() => {
                  onChange(template.id);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    value === template.id ? 'opacity-100' : 'opacity-0'
                  )}
                />
                {template.name}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { QuoteTemplateList } from '@/components/sales/templates/QuoteTemplateList';
import { QuoteTemplateEditor } from '@/components/sales/templates/QuoteTemplateEditor';
import { QuoteTemplate } from '@/components/sales/templates/types';
import { useState } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

export default function QuoteTemplates() {
  const [editingTemplate, setEditingTemplate] = useState<QuoteTemplate | null | undefined>(undefined);
  const { supabase, context } = useCRM();
  const { roles } = useAuth();
  const navigate = useNavigate();

  const handleEdit = (template: QuoteTemplate | null) => {
    setEditingTemplate(template);
  };

  const handleCloseEditor = () => {
    setEditingTemplate(undefined);
  };

  const handleSelect = async (template: QuoteTemplate) => {
    try {
      const tenantId = context.tenantId || roles?.[0]?.tenant_id;
      if (!tenantId) {
        toast.error('Tenant ID not found');
        return;
      }

      // Create a new quote from the template
      // We explicitly exclude id, system fields, and PDF layout fields (header, layout, sections)
      // to prevent "column does not exist" errors
      const { 
        id, 
        created_at, 
        updated_at, 
        quote_number, 
        header, 
        layout, 
        sections, 
        footer, 
        styles,
        terms,
        ...content 
      } = template.content as any;

      // Map 'terms' to 'terms_conditions' if it exists and is a string
      const quoteData = {
        tenant_id: tenantId,
        title: `${template.name} (Copy)`,
        status: 'draft',
        terms_conditions: content.terms_conditions || (typeof terms === 'string' ? terms : undefined),
        ...content,
      };

      const { data, error } = await supabase
        .from('quotes')
        .insert(quoteData)
        .select()
        .single();

      if (error) throw error;

      toast.success('Quote created from template');
      navigate(`/dashboard/quotes/${data.id}`);
    } catch (error: any) {
      console.error('Error using template:', error);
      toast.error(`Failed to create quote: ${error.message}`);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <QuoteTemplateList onEdit={handleEdit} onSelect={handleSelect} />
        
        {editingTemplate !== undefined && (
          <QuoteTemplateEditor
            template={editingTemplate}
            open={true}
            onOpenChange={(open) => !open && handleCloseEditor()}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

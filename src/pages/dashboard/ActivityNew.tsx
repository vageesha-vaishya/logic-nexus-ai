import { useNavigate, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ActivityForm } from '@/components/crm/ActivityForm';
import { ArrowLeft } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { invokeFunction } from "@/lib/supabase-functions";
import { toast } from 'sonner';

export default function ActivityNew() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { supabase, context } = useCRM();
  
  const leadId = searchParams.get('leadId');
  const accountId = searchParams.get('accountId');
  const contactId = searchParams.get('contactId');
  const typeParam = searchParams.get('type');
  
  // Map 'event' to 'meeting' to match ActivityForm schema
  const activityType = (typeParam === 'event' ? 'meeting' : typeParam) as 'task' | 'meeting' | 'call' | 'email' | 'note' | undefined;

  const backPath = leadId 
    ? `/dashboard/leads/${leadId}` 
    : accountId 
      ? `/dashboard/accounts/${accountId}` 
      : contactId 
        ? `/dashboard/contacts/${contactId}` 
        : '/dashboard/activities';

  const initialData = {
    activity_type: activityType || 'task',
    lead_id: leadId || null,
    account_id: accountId || null,
    contact_id: contactId || null,
    status: 'planned' as const,
    priority: 'medium' as const,
  };

  const handleCreate = async (formData: any) => {
    try {
      let tenantId = context.tenantId;
      let franchiseId = context.franchiseId;

      // For platform admins, get tenant_id from related entity if not in context
      if (!tenantId) {
        if (formData.lead_id) {
          const { data: lead } = await supabase
            .from('leads')
            .select('tenant_id, franchise_id')
            .eq('id', formData.lead_id)
            .single();
          if (lead) {
            tenantId = lead.tenant_id;
            franchiseId = lead.franchise_id;
          }
        } else if (formData.account_id) {
          const { data: account } = await supabase
            .from('accounts')
            .select('tenant_id, franchise_id')
            .eq('id', formData.account_id)
            .single();
          if (account) {
            tenantId = account.tenant_id;
            franchiseId = account.franchise_id;
          }
        } else if (formData.contact_id) {
          const { data: contact } = await supabase
            .from('contacts')
            .select('tenant_id, franchise_id')
            .eq('id', formData.contact_id)
            .single();
          if (contact) {
            tenantId = contact.tenant_id;
            franchiseId = contact.franchise_id;
          }
        }
      }

      if (!tenantId) {
        toast.error('Could not determine tenant context. Please select a related record.');
        return;
      }

      // Format description for specific types
      let description = formData.description;
      if (formData.activity_type === 'meeting' && formData.location) {
        description = description ? `${description}\n\nLocation: ${formData.location}` : `Location: ${formData.location}`;
      }

      const plainToHtml = (text: string) => {
        const esc = (s: string) =>
          s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return esc(String(text || "")).replace(/\n/g, "<br>");
      };

      // Handle email sending
      if (formData.activity_type === 'email' && formData.send_email) {
        if (!formData.to) {
          toast.error('Recipient email is required to send email');
          return;
        }

        const { data: accounts, error: accountsError } = await supabase
          .from('email_accounts')
          .select('id, is_primary')
          .eq('is_active', true)
          .order('is_primary', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1);

        if (accountsError) throw accountsError;
        const accountId = accounts?.[0]?.id;
        if (!accountId) {
          toast.error('No active email account found. Connect an account in Email Management.');
          return;
        }

        const subject = String(formData.subject || '').trim();
        const emailHtmlBody = plainToHtml(String(formData.email_body || formData.description || ''));

        const attachmentPayload = Array.isArray(formData.attachments)
          ? formData.attachments
              .map((a: any) => ({
                filename: typeof a?.name === 'string' ? a.name : '',
                path: typeof a?.path === 'string' ? a.path : undefined,
                contentType: typeof a?.type === 'string' ? a.type : 'application/octet-stream',
              }))
              .filter((a: any) => a.filename && a.path)
          : [];

        const { data: sendData, error: sendError } = await invokeFunction("send-email", {
          body: {
            accountId,
            to: [formData.to],
            cc: [],
            subject,
            body: emailHtmlBody,
            attachments: attachmentPayload,
          },
        });

        if (sendError) {
          let sendMessage = sendError.message;
          const ctx = (sendError as any)?.context;
          if (ctx) {
            try {
              const parsed = typeof ctx === 'string' ? JSON.parse(ctx) : ctx;
              sendMessage = parsed?.error || parsed?.message || sendMessage;
            } catch {
            }
          }
          throw new Error(sendMessage);
        }
        if (sendData && (sendData as any).success === false) {
          throw new Error((sendData as any).error || 'Failed to send email');
        }

        description = `${description || ''}\n\n[Sent via system to ${String(formData.to).trim()}]`.trim();
      }

      // Extract fields that are not in the activities table (including location and others)
      const { to, from, send_email, email_body, location, service_id, attachments, ...rest } = formData;
      
      const attachmentNames = Array.isArray(attachments)
        ? attachments.map((f: any) => (typeof f?.name === 'string' ? f.name : '')).filter(Boolean)
        : [];

      // Get current user email for 'from' field if not provided
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = user?.email || '';

      // For email activities, ensure email_body is populated from description if missing
      const finalEmailBody = formData.activity_type === 'email' && !email_body && description 
        ? description 
        : email_body;

      // Add email specific fields and extras to custom_fields if needed
      const custom_fields = {
        ...(formData.to ? { to: formData.to } : {}),
        ...(formData.from ? { from: formData.from } : (formData.activity_type === 'email' ? { from: userEmail } : {})),
        ...(formData.send_email ? { send_email: formData.send_email } : {}),
        ...(formData.location ? { location: formData.location } : {}),
        ...(finalEmailBody ? { email_body: finalEmailBody } : {}),
        ...(service_id ? { service_id } : {}),
        ...(attachmentNames.length ? { attachments_names: attachmentNames } : {}),
        ...(formData.activity_type === 'email' && formData.send_email ? { sent_at: new Date().toISOString() } : {}),
      };

      const activityData = {
        ...rest,
        due_date: rest.due_date ? rest.due_date : null,
      };

      const { data: newActivity, error } = await supabase
        .from('activities')
        .insert({
          ...activityData,
          description,
          custom_fields,
          tenant_id: tenantId,
          franchise_id: franchiseId,
          created_by: user?.id
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Activity created successfully');
      
      // Determine target path based on form data or URL params
      const targetLeadId = formData.lead_id || leadId;
      const targetAccountId = formData.account_id || accountId;
      const targetContactId = formData.contact_id || contactId;

      const targetPath = targetLeadId 
        ? `/dashboard/leads/${targetLeadId}` 
        : targetAccountId 
          ? `/dashboard/accounts/${targetAccountId}` 
          : targetContactId 
            ? `/dashboard/contacts/${targetContactId}` 
            : backPath;

      // If email activity and not sent via form, open composer in parent view
      const shouldOpenComposer = formData.activity_type === 'email' && !formData.send_email;
      
      if (shouldOpenComposer && (targetLeadId || targetAccountId || targetContactId)) {
        navigate(targetPath, {
          state: {
            openComposer: true,
            initialSubject: formData.subject,
            initialBody: formData.description,
            activityId: newActivity?.id
          }
        });
        return;
      }

      navigate(targetPath);
    } catch (error: any) {
      console.error('Error creating activity:', error);
      toast.error('Failed to create activity', { description: error.message || 'Unknown error' });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(backPath)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">New Activity</h1>
            <p className="text-muted-foreground">Schedule a new activity or task</p>
          </div>
        </div>

        <ActivityForm 
          initialData={initialData}
          onSubmit={handleCreate}
          onCancel={() => navigate(backPath)}
        />
      </div>
    </DashboardLayout>
  );
}

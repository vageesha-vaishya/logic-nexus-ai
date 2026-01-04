import { useEffect, useMemo, useState, useRef } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCRM } from '@/hooks/useCRM';
import { useAssignableUsers, AssignableUser } from '@/hooks/useAssignableUsers';
import { toast } from 'sonner';
import { Loader2, AlertCircle } from 'lucide-react';

import { Checkbox } from '@/components/ui/checkbox';
import { SearchableSelect } from '@/components/crm/SearchableSelect';

type RelatedContext = {
  account_id?: string | null;
  contact_id?: string | null;
  lead_id?: string | null;
};

interface ActivityComposerProps {
  defaultTab?: 'task' | 'event' | 'call' | 'email' | 'note';
  related?: RelatedContext;
  onCreated?: (id: string) => void;
}

const baseSchema = z.object({
  subject: z.string().trim().min(1, 'Subject is required').max(200),
  description: z.string().trim().optional(),
  due_date: z.string().optional(),
  account_id: z.string().optional(),
  contact_id: z.string().optional(),
  lead_id: z.string().optional(),
});

const eventSchema = baseSchema.extend({
  due_date: z.string().min(1, 'Event date is required'),
  location: z.string().optional(),
});

const callSchema = baseSchema.extend({
  create_follow_up: z.boolean().optional(),
  follow_up_due_date: z.string().optional(),
});

const emailSchema = baseSchema.extend({
  email_body: z.string().trim().min(1, 'Email body is required'),
  send_email: z.boolean().default(false),
  to: z.string().optional(),
  from_account: z.string().optional(),
});

/**
 * ActivityComposer Component
 * 
 * Handles the creation of various activity types (Email, Call, Task, Event, Note).
 * Manages data fetching for related entities (Accounts, Contacts, Leads) and Email Accounts.
 * 
 * Data Loading:
 * - Fetches related data on mount using Promise.all for efficiency.
 * - Handles loading states via isLoadingRelated.
 * - Provides error feedback via toast notifications.
 * 
 * @param {ActivityComposerProps} props
 */
export function ActivityComposer({ defaultTab = 'task', related, onCreated }: ActivityComposerProps) {
  const { supabase, context } = useCRM();
  const { fetchAssignableUsers, formatLabel } = useAssignableUsers();
  const [assignedTo, setAssignedTo] = useState<string | null>(context?.userId ?? null);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [assignSearch, setAssignSearch] = useState<string>('');
  const [emailAccounts, setEmailAccounts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [showHelp, setShowHelp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const relatedDataRef = useRef<{ account?: any; lead?: any; contact?: any }>({});

  const commonDefaults = useMemo(
    () => ({
      subject: '',
      description: '',
      due_date: '',
      account_id: related?.account_id || '',
      contact_id: related?.contact_id || '',
      lead_id: related?.lead_id || '',
    }),
    [related]
  );

  const taskForm = useForm<z.infer<typeof baseSchema>>({
    resolver: zodResolver(baseSchema),
    defaultValues: commonDefaults,
  });
  const eventForm = useForm<z.infer<typeof eventSchema>>({
    resolver: zodResolver(eventSchema),
    defaultValues: commonDefaults,
  });
  const callForm = useForm<z.infer<typeof callSchema>>({
    resolver: zodResolver(callSchema),
    defaultValues: { ...commonDefaults, create_follow_up: false, follow_up_due_date: '' },
  });
  const emailForm = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { 
      ...commonDefaults, 
      email_body: '',
      send_email: false,
      to: '',
      from_account: ''
    },
  });
  const noteForm = useForm<z.infer<typeof baseSchema>>({
    resolver: zodResolver(baseSchema),
    defaultValues: commonDefaults,
  });

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await fetchAssignableUsers({ search: assignSearch, limit: 25 });
      if (active) setAssignableUsers((data ?? []) as AssignableUser[]);
    })();
    return () => {
      active = false;
    };
  }, [fetchAssignableUsers, assignSearch]);

  useEffect(() => {
    const tipKey = 'activityComposerHelpShown';
    const hasSeen = typeof window !== 'undefined' ? localStorage.getItem(tipKey) : '1';
    if (!hasSeen) setShowHelp(true);
  }, []);

  useEffect(() => {
    const fetchEmailAccounts = async () => {
      const { data, error } = await supabase
        .from('email_accounts')
        .select('id, email_address, display_name')
        .eq('is_active', true)
        .order('is_primary', { ascending: false });

      if (error) {
        console.error('Error fetching email accounts:', error);
        return;
      }
      
      if (data) {
        setEmailAccounts(data);
        if (data.length > 0) {
           emailForm.setValue('from_account', data[0].id);
        }
      }
    };
    fetchEmailAccounts();
  }, [supabase, emailForm]);

  // Watch for contact/lead changes to auto-populate To field
  const selectedContactId = emailForm.watch('contact_id');
  const selectedLeadId = emailForm.watch('lead_id');
  
  useEffect(() => {
    if (selectedContactId && selectedContactId !== 'none') {
      const contact = relatedDataRef.current.contact;
      if (contact && contact.id === selectedContactId && contact.email) {
        emailForm.setValue('to', contact.email);
      }
    } else if (selectedLeadId && selectedLeadId !== 'none') {
      const lead = relatedDataRef.current.lead;
      if (lead && lead.id === selectedLeadId && lead.email) {
        emailForm.setValue('to', lead.email);
      }
    }
  }, [selectedContactId, selectedLeadId, emailForm]);

  const getTenantAndFranchise = async (data: any) => {
    let tenantId = context.tenantId;
    let franchiseId = context.franchiseId;

    if (!tenantId) {
      if (data.lead_id && data.lead_id !== 'none') {
        const lead = relatedDataRef.current.lead;
        if (lead && lead.id === data.lead_id && lead.tenant_id) {
          tenantId = lead.tenant_id;
          franchiseId = lead.franchise_id;
        } else {
          const { data: fetchedLead } = await supabase
            .from('leads')
            .select('tenant_id, franchise_id')
            .eq('id', data.lead_id)
            .single();
          if (fetchedLead) {
            tenantId = fetchedLead.tenant_id;
            franchiseId = fetchedLead.franchise_id;
          }
        }
      } else if (data.account_id && data.account_id !== 'none') {
        const account = relatedDataRef.current.account;
        if (account && account.id === data.account_id && account.tenant_id) {
          tenantId = account.tenant_id;
          franchiseId = account.franchise_id;
        } else {
          const { data: fetchedAccount } = await supabase
            .from('accounts')
            .select('tenant_id, franchise_id')
            .eq('id', data.account_id)
            .single();
          if (fetchedAccount) {
            tenantId = fetchedAccount.tenant_id;
            franchiseId = fetchedAccount.franchise_id;
          }
        }
      } else if (data.contact_id && data.contact_id !== 'none') {
        const contact = relatedDataRef.current.contact;
        if (contact && contact.id === data.contact_id && contact.tenant_id) {
          tenantId = contact.tenant_id;
          franchiseId = contact.franchise_id;
        } else {
          const { data: fetchedContact } = await supabase
            .from('contacts')
            .select('tenant_id, franchise_id')
            .eq('id', data.contact_id)
            .single();
          if (fetchedContact) {
            tenantId = fetchedContact.tenant_id;
            franchiseId = fetchedContact.franchise_id;
          }
        }
      }
    }
    return { tenantId, franchiseId };
  };

  const insertActivity = async (payload: any) => {
    const { data, error } = await supabase
      .from('activities')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  };

  const handleSubmit = async (
    values: any,
    type: 'task' | 'meeting' | 'call' | 'email' | 'note',
    form: any,
    successLabel: string
  ) => {
    setIsSubmitting(true);
    try {
      const { tenantId, franchiseId } = await getTenantAndFranchise(values);
      if (!tenantId) {
        toast.error('Please select a related lead, account, or contact');
        setIsSubmitting(false);
        return;
      }

      let description = values.description || values.email_body || null;
      if (type === 'meeting' && values.location) {
        description = description ? `${description}\n\nLocation: ${values.location}` : `Location: ${values.location}`;
      }

      if (type === 'email' && values.send_email) {
        if (!values.to) {
          toast.error('Recipient email is required when sending email');
          setIsSubmitting(false);
          return;
        }
        if (!values.from_account) {
          toast.error('From account is required when sending email');
          setIsSubmitting(false);
          return;
        }

        const { error: sendError } = await supabase.functions.invoke('send-email', {
          body: {
            accountId: values.from_account,
            to: [values.to],
            subject: values.subject,
            body: values.email_body, // send-email handles html/text conversion if needed, or treats as html
          }
        });

        if (sendError) {
          console.error('Error sending email:', sendError);
          // throw new Error('Failed to send email: ' + (sendError.message || 'Unknown error'));
          // Depending on requirements, we might want to stop here.
          // The user asked to troubleshoot failures, so we should definitely alert them.
          throw new Error(`Failed to send email: ${sendError.message || 'Check email configuration'}`);
        }

        toast.success('Email sent successfully');
        description = `${description}\n\n[Sent via system to ${values.to}]`;
      }

      const commonPayload = {
        activity_type: type,
        status: 'planned',
        priority: type === 'note' ? 'low' : 'medium',
        subject: values.subject,
        description: description,
        due_date: values.due_date || null,
        tenant_id: tenantId,
        franchise_id: franchiseId,
        account_id: values.account_id === 'none' ? null : (values.account_id || null),
        contact_id: values.contact_id === 'none' ? null : (values.contact_id || null),
        lead_id: values.lead_id === 'none' ? null : (values.lead_id || null),
        assigned_to: assignedTo ?? context.userId ?? null,
      };

      if (type === 'call') {
         const lead = relatedDataRef.current.lead;
         const contact = relatedDataRef.current.contact;
         const hasPhone = (lead && lead.id === values.lead_id && lead.phone) || 
                          (contact && contact.id === values.contact_id && contact.phone) ||
                          (values.description && values.description.match(/[\d\-\(\)\s]{7,}/));
         
         if (!hasPhone) {
            toast.warning('No phone number found for the selected Lead/Contact. Please ensure you have the correct number.');
         }
      }

      const created = await insertActivity(commonPayload);

      // Handle Call Follow-up
      if (type === 'call' && values.create_follow_up && values.follow_up_due_date) {
        await insertActivity({
          ...commonPayload,
          activity_type: 'task',
          subject: `Follow-up: ${values.subject}`,
          due_date: values.follow_up_due_date,
          description: values.description || null,
          priority: 'medium', // Reset priority for follow-up task
        });
      }

      toast.success(`${successLabel} created`);
      form.reset();
      onCreated?.(created.id);
    } catch (error: any) {
      console.error(`Error creating ${type}:`, error);
      toast.error(error.message || `Failed to create ${type}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const RelatedSelectors = ({ form }: { form: any }) => (
    <div className="grid grid-cols-3 gap-4">
      <FormField
        control={form.control}
        name="account_id"
        render={({ field }) => (
          <FormItem className="flex flex-col">
            <FormLabel>Related Account</FormLabel>
            <SearchableSelect
              table="accounts"
              label="Account"
              displayField="name"
              searchFields={['name']}
              extraFields={['tenant_id', 'franchise_id']}
              value={field.value === 'none' ? null : field.value}
              onChange={(val, item) => {
                field.onChange(val || 'none');
                if (item) relatedDataRef.current.account = item;
              }}
            />
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="contact_id"
        render={({ field }) => (
          <FormItem className="flex flex-col">
            <FormLabel>Related Contact</FormLabel>
            <SearchableSelect
              table="contacts"
              label="Contact"
              displayField="first_name" // We might want full name, but SearchableSelect supports renderOption
              searchFields={['first_name', 'last_name', 'email']}
              extraFields={['last_name', 'email', 'tenant_id', 'franchise_id']}
              renderOption={(item) => `${item.first_name} ${item.last_name}`}
              value={field.value === 'none' ? null : field.value}
              onChange={(val, item) => {
                field.onChange(val || 'none');
                if (item) relatedDataRef.current.contact = item;
              }}
            />
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="lead_id"
        render={({ field }) => (
          <FormItem className="flex flex-col">
            <FormLabel>Related Lead</FormLabel>
            <SearchableSelect
              table="leads"
              label="Lead"
              displayField="first_name"
              searchFields={['first_name', 'last_name', 'email', 'company']}
              extraFields={['last_name', 'email', 'tenant_id', 'franchise_id', 'phone']}
              renderOption={(item) => `${item.first_name} ${item.last_name}`}
              value={field.value === 'none' ? null : field.value}
              onChange={(val, item) => {
                field.onChange(val || 'none');
                if (item) {
                  relatedDataRef.current.lead = item;
                  const currentSub = form.getValues('subject');
                  if (!currentSub) {
                     const type = activeTab.charAt(0).toUpperCase() + activeTab.slice(1);
                     form.setValue('subject', `${type} with ${item.first_name} ${item.last_name}`);
                  }
                }
              }}
            />
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Composer</CardTitle>
      </CardHeader>
      <CardContent>
        {showHelp && (
          <div className="mb-4 rounded-md border p-3 bg-muted/30 flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-medium">Tip: Assign activity owners</div>
              <div className="text-sm text-muted-foreground">
                Use the <span className="font-medium">Assign To</span> field to select the owner. Platform admins can search globally; other roles see scoped users.
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                localStorage.setItem('activityComposerHelpShown', '1');
                setShowHelp(false);
              }}
            >
              Got it
            </Button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <Label>Assign To</Label>
            <div className="flex gap-2 mt-2">
              <Input
                placeholder={context?.isPlatformAdmin ? 'Search all users' : 'Search users'}
                value={assignSearch}
                onChange={(e) => setAssignSearch(e.target.value)}
              />
              <Select onValueChange={(v) => setAssignedTo(v === 'none' ? null : v)} value={assignedTo ?? 'none'}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {assignableUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{formatLabel(u)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="email">Email</TabsTrigger>
            <TabsTrigger value="call">Log a Call</TabsTrigger>
            <TabsTrigger value="task">New Task</TabsTrigger>
            <TabsTrigger value="event">New Event</TabsTrigger>
            <TabsTrigger value="note">Note</TabsTrigger>
          </TabsList>

          {/* Email */}
          <TabsContent value="email" className="pt-4">
            <Form {...emailForm}>
              <form onSubmit={emailForm.handleSubmit((values) => handleSubmit(values, 'email', emailForm, 'Email'))} className="space-y-4">
                <FormField
                  control={emailForm.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject *</FormLabel>
                      <FormControl>
                        <Input placeholder="Subject" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={emailForm.control}
                  name="email_body"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Body</FormLabel>
                      <FormControl>
                        <Textarea rows={6} placeholder="Write email..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <RelatedSelectors form={emailForm} />

                <div className="flex justify-end">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {emailForm.watch('send_email') ? 'Send & Log Email' : 'Log Email'}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>

          {/* Call */}
          <TabsContent value="call" className="pt-4">
            <Form {...callForm}>
              <form onSubmit={callForm.handleSubmit((values) => handleSubmit(values, 'call', callForm, 'Call'))} className="space-y-4">
                <FormField
                  control={callForm.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject *</FormLabel>
                      <FormControl>
                        <Input placeholder="Call Subject" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={callForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Call details..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-4">
                  <FormField
                    control={callForm.control}
                    name="create_follow_up"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-2">
                        <FormControl>
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300"
                            checked={field.value}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel>Create Follow-up Task?</FormLabel>
                      </FormItem>
                    )}
                  />
                  {callForm.watch('create_follow_up') && (
                    <FormField
                      control={callForm.control}
                      name="follow_up_due_date"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>Follow-up Date</FormLabel>
                          <FormControl>
                            <Input type="datetime-local" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                <RelatedSelectors form={callForm} />

                <div className="flex justify-end">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Log Call
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>

          {/* Task */}
          <TabsContent value="task" className="pt-4">
            <Form {...taskForm}>
              <form onSubmit={taskForm.handleSubmit((values) => handleSubmit(values, 'task', taskForm, 'Task'))} className="space-y-4">
                <FormField
                  control={taskForm.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject *</FormLabel>
                      <FormControl>
                        <Input placeholder="Task Subject" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={taskForm.control}
                  name="due_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Due Date</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={taskForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Task details..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <RelatedSelectors form={taskForm} />

                <div className="flex justify-end">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Task
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>

          {/* Event */}
          <TabsContent value="event" className="pt-4">
            <Form {...eventForm}>
              <form onSubmit={eventForm.handleSubmit((values) => handleSubmit(values, 'meeting', eventForm, 'Event'))} className="space-y-4">
                <FormField
                  control={eventForm.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject *</FormLabel>
                      <FormControl>
                        <Input placeholder="Event Subject" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={eventForm.control}
                  name="due_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date & Time *</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={eventForm.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input placeholder="Location or Video Link" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={eventForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Event details..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <RelatedSelectors form={eventForm} />

                <div className="flex justify-end">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Event
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>

          {/* Note */}
          <TabsContent value="note" className="pt-4">
            <Form {...noteForm}>
              <form onSubmit={noteForm.handleSubmit((values) => handleSubmit(values, 'note', noteForm, 'Note'))} className="space-y-4">
                <FormField
                  control={noteForm.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject *</FormLabel>
                      <FormControl>
                        <Input placeholder="Note Subject" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={noteForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Content</FormLabel>
                      <FormControl>
                        <Textarea rows={4} placeholder="Note content..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <RelatedSelectors form={noteForm} />

                <div className="flex justify-end">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add Note
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

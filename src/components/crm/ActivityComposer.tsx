import { useEffect, useMemo, useState } from 'react';
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
  subject: z.string().min(1, 'Subject is required').max(200),
  description: z.string().optional(),
  due_date: z.string().optional(),
  account_id: z.string().optional(),
  contact_id: z.string().optional(),
  lead_id: z.string().optional(),
});

const callSchema = baseSchema.extend({
  create_follow_up: z.boolean().optional(),
  follow_up_due_date: z.string().optional(),
});

const emailSchema = baseSchema.extend({
  email_body: z.string().optional(),
});

export function ActivityComposer({ defaultTab = 'task', related, onCreated }: ActivityComposerProps) {
  const { supabase, context } = useCRM();
  const { fetchAssignableUsers, formatLabel } = useAssignableUsers();
  const [assignedTo, setAssignedTo] = useState<string | null>(context?.userId ?? null);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [assignSearch, setAssignSearch] = useState<string>('');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [showHelp, setShowHelp] = useState(false);

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
  const eventForm = useForm<z.infer<typeof baseSchema>>({
    resolver: zodResolver(baseSchema),
    defaultValues: commonDefaults,
  });
  const callForm = useForm<z.infer<typeof callSchema>>({
    resolver: zodResolver(callSchema),
    defaultValues: { ...commonDefaults, create_follow_up: false, follow_up_due_date: '' },
  });
  const emailForm = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { ...commonDefaults, email_body: '' },
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
    const fetchRelated = async () => {
      const [accountsRes, contactsRes, leadsRes] = await Promise.all([
        supabase.from('accounts').select('id, name').order('name'),
        supabase.from('contacts').select('id, first_name, last_name').order('first_name'),
        supabase.from('leads').select('id, first_name, last_name').order('first_name'),
      ]);
      if (accountsRes.data) setAccounts(accountsRes.data);
      if (contactsRes.data) setContacts(contactsRes.data);
      if (leadsRes.data) setLeads(leadsRes.data);
    };
    fetchRelated();
  }, [supabase]);

  const getTenantAndFranchise = async (data: any) => {
    let tenantId = context.tenantId;
    let franchiseId = context.franchiseId;

    if (!tenantId) {
      if (data.lead_id && data.lead_id !== 'none') {
        const { data: lead } = await supabase
          .from('leads')
          .select('tenant_id, franchise_id')
          .eq('id', data.lead_id)
          .single();
        if (lead) {
          tenantId = lead.tenant_id;
          franchiseId = lead.franchise_id;
        }
      } else if (data.account_id && data.account_id !== 'none') {
        const { data: account } = await supabase
          .from('accounts')
          .select('tenant_id, franchise_id')
          .eq('id', data.account_id)
          .single();
        if (account) {
          tenantId = account.tenant_id;
          franchiseId = account.franchise_id;
        }
      } else if (data.contact_id && data.contact_id !== 'none') {
        const { data: contact } = await supabase
          .from('contacts')
          .select('tenant_id, franchise_id')
          .eq('id', data.contact_id)
          .single();
        if (contact) {
          tenantId = contact.tenant_id;
          franchiseId = contact.franchise_id;
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

  const onCreateTask = async (values: z.infer<typeof baseSchema>) => {
    const { tenantId, franchiseId } = await getTenantAndFranchise(values);
    if (!tenantId) {
      toast.error('Please select a related lead, account, or contact');
      return;
    }
    const created = await insertActivity({
      activity_type: 'task',
      status: 'planned',
      priority: 'medium',
      subject: values.subject,
      description: values.description || null,
      due_date: values.due_date || null,
      tenant_id: tenantId,
      franchise_id: franchiseId,
      account_id: values.account_id === 'none' ? null : (values.account_id || null),
      contact_id: values.contact_id === 'none' ? null : (values.contact_id || null),
      lead_id: values.lead_id === 'none' ? null : (values.lead_id || null),
      assigned_to: assignedTo ?? context.userId ?? null,
    });
    toast.success('Task created');
    onCreated?.(created.id);
  };

  const onCreateEvent = async (values: z.infer<typeof baseSchema>) => {
    const { tenantId, franchiseId } = await getTenantAndFranchise(values);
    if (!tenantId) {
      toast.error('Please select a related lead, account, or contact');
      return;
    }
    const created = await insertActivity({
      activity_type: 'meeting',
      status: 'planned',
      priority: 'medium',
      subject: values.subject,
      description: values.description || null,
      due_date: values.due_date || null,
      tenant_id: tenantId,
      franchise_id: franchiseId,
      account_id: values.account_id === 'none' ? null : (values.account_id || null),
      contact_id: values.contact_id === 'none' ? null : (values.contact_id || null),
      lead_id: values.lead_id === 'none' ? null : (values.lead_id || null),
      assigned_to: assignedTo ?? context.userId ?? null,
    });
    toast.success('Event created');
    onCreated?.(created.id);
  };

  const onLogCall = async (values: z.infer<typeof callSchema>) => {
    const { tenantId, franchiseId } = await getTenantAndFranchise(values);
    if (!tenantId) {
      toast.error('Please select a related lead, account, or contact');
      return;
    }
    const call = await insertActivity({
      activity_type: 'call',
      status: 'planned',
      priority: 'medium',
      subject: values.subject,
      description: values.description || null,
      due_date: null,
      completed_at: null,
      tenant_id: tenantId,
      franchise_id: franchiseId,
      account_id: values.account_id === 'none' ? null : (values.account_id || null),
      contact_id: values.contact_id === 'none' ? null : (values.contact_id || null),
      lead_id: values.lead_id === 'none' ? null : (values.lead_id || null),
      assigned_to: assignedTo ?? context.userId ?? null,
    });
    if (values.create_follow_up && values.follow_up_due_date) {
      await insertActivity({
        activity_type: 'task',
        status: 'planned',
        priority: 'medium',
        subject: `Follow-up: ${values.subject}`,
        description: values.description || null,
        due_date: values.follow_up_due_date,
        tenant_id: tenantId,
        franchise_id: franchiseId,
        account_id: values.account_id === 'none' ? null : (values.account_id || null),
        contact_id: values.contact_id === 'none' ? null : (values.contact_id || null),
        lead_id: values.lead_id === 'none' ? null : (values.lead_id || null),
        assigned_to: assignedTo ?? context.userId ?? null,
      });
    }
    toast.success('Call logged');
    onCreated?.(call.id);
  };

  const onLogEmail = async (values: z.infer<typeof emailSchema>) => {
    const { tenantId, franchiseId } = await getTenantAndFranchise(values);
    if (!tenantId) {
      toast.error('Please select a related lead, account, or contact');
      return;
    }
    const created = await insertActivity({
      activity_type: 'email',
      status: 'planned',
      priority: 'medium',
      subject: values.subject,
      description: values.email_body || values.description || null,
      due_date: null,
      completed_at: null,
      tenant_id: tenantId,
      franchise_id: franchiseId,
      account_id: values.account_id === 'none' ? null : (values.account_id || null),
      contact_id: values.contact_id === 'none' ? null : (values.contact_id || null),
      lead_id: values.lead_id === 'none' ? null : (values.lead_id || null),
      assigned_to: assignedTo ?? context.userId ?? null,
    });
    toast.success('Email logged');
    onCreated?.(created.id);
  };

  const RelatedSelectors = ({ form }: { form: any }) => (
    <div className="grid grid-cols-3 gap-4">
      <FormField
        control={form.control}
        name="account_id"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Related Account</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="contact_id"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Related Contact</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select contact" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="lead_id"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Related Lead</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select lead" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {leads.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.first_name} {l.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              <Select onValueChange={(v) => setAssignedTo(v === 'none' ? null : v)} defaultValue={assignedTo ?? 'none'}>
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
              <form onSubmit={emailForm.handleSubmit(onLogEmail)} className="space-y-4">
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
                  <Button type="submit">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin hidden" />
                    Log Email
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>

          {/* Call */}
          <TabsContent value="call" className="pt-4">
            <Form {...callForm}>
              <form onSubmit={callForm.handleSubmit(onLogCall)} className="space-y-4">
                <FormField
                  control={callForm.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject *</FormLabel>
                      <FormControl>
                        <Input placeholder="Spoke with customer" {...field} />
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
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea rows={4} placeholder="Call notes..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <RelatedSelectors form={callForm} />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={callForm.control}
                    name="create_follow_up"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Create Follow-up Task</FormLabel>
                        <FormControl>
                          <Select onValueChange={(v) => field.onChange(v === 'true')} defaultValue={field.value ? 'true' : 'false'}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="false">No</SelectItem>
                              <SelectItem value="true">Yes</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={callForm.control}
                    name="follow_up_due_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Follow-up Due</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end">
                  <Button type="submit">Log Call</Button>
                </div>
              </form>
            </Form>
          </TabsContent>

          {/* Task */}
          <TabsContent value="task" className="pt-4">
            <Form {...taskForm}>
              <form onSubmit={taskForm.handleSubmit(onCreateTask)} className="space-y-4">
                <FormField
                  control={taskForm.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject *</FormLabel>
                      <FormControl>
                        <Input placeholder="Follow up with client" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
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
                          <Textarea rows={4} placeholder="Task details..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <RelatedSelectors form={taskForm} />
                <div className="flex justify-end">
                  <Button type="submit">Create Task</Button>
                </div>
              </form>
            </Form>
          </TabsContent>

          {/* Event */}
          <TabsContent value="event" className="pt-4">
            <Form {...eventForm}>
              <form onSubmit={eventForm.handleSubmit(onCreateEvent)} className="space-y-4">
                <FormField
                  control={eventForm.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject *</FormLabel>
                      <FormControl>
                        <Input placeholder="Discovery meeting" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={eventForm.control}
                    name="due_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} />
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
                        <FormLabel>Agenda</FormLabel>
                        <FormControl>
                          <Textarea rows={4} placeholder="Agenda..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <RelatedSelectors form={eventForm} />
                <div className="flex justify-end">
                  <Button type="submit">Create Event</Button>
                </div>
              </form>
            </Form>
          </TabsContent>

          {/* Note */}
          <TabsContent value="note" className="pt-4">
            <Form {...noteForm}>
              <form
                onSubmit={noteForm.handleSubmit(async (values) => {
                  const { tenantId, franchiseId } = await getTenantAndFranchise(values);
                  if (!tenantId) {
                    toast.error('Please select a related lead, account, or contact');
                    return;
                  }
                  const created = await insertActivity({
                    activity_type: 'note',
                    status: 'planned',
                    priority: 'low',
                    subject: values.subject,
                    description: values.description || null,
                    due_date: null,
                    completed_at: null,
                    tenant_id: tenantId,
                    franchise_id: franchiseId,
                    account_id: values.account_id === 'none' ? null : (values.account_id || null),
                    contact_id: values.contact_id === 'none' ? null : (values.contact_id || null),
                    lead_id: values.lead_id === 'none' ? null : (values.lead_id || null),
                    assigned_to: assignedTo ?? context.userId ?? null,
                  });
                  toast.success('Note added');
                  onCreated?.(created.id);
                })}
                className="space-y-4"
              >
                <FormField
                  control={noteForm.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title *</FormLabel>
                      <FormControl>
                        <Input placeholder="Note title" {...field} />
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
                      <FormLabel>Note</FormLabel>
                      <FormControl>
                        <Textarea rows={6} placeholder="Write a note..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <RelatedSelectors form={noteForm} />
                <div className="flex justify-end">
                  <Button type="submit">Add Note</Button>
                </div>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
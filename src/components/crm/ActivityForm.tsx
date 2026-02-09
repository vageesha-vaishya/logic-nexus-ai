import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, ArrowLeft, ArrowRight, Check, Calendar, Clock, User, Building2, Phone, Mail, FileText, CheckSquare, HelpCircle, AlertTriangle } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { SearchableSelect } from '@/components/crm/SearchableSelect';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const activitySchema = z.object({
  activity_type: z.enum(['call', 'email', 'meeting', 'task', 'note']),
  status: z.enum(['planned', 'in_progress', 'completed', 'cancelled']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  subject: z.string().trim().min(1, 'Subject is required').max(200),
  description: z.string().trim().optional(),
  due_date: z.string().optional(),
  account_id: z.string().optional().nullable(),
  contact_id: z.string().optional().nullable(),
  lead_id: z.string().optional().nullable(),
  // Type-specific fields
  location: z.string().optional(), // For meetings
  to: z.string().email('Invalid email address').optional().or(z.literal('')), // For email
  from: z.string().optional(), // For email
  send_email: z.boolean().optional(), // For email
  email_body: z.string().optional(), // For email
});

type ActivityFormData = z.infer<typeof activitySchema>;

interface ActivityFormProps {
  initialData?: Partial<ActivityFormData> & { id?: string };
  onSubmit: (data: ActivityFormData) => Promise<void>;
  onCancel: () => void;
}

const STEPS = [
  { id: 1, title: 'Type & Basics', description: 'Define the activity' },
  { id: 2, title: 'Context', description: 'Who is this related to?' },
  { id: 3, title: 'Details', description: 'Schedule and description' },
];

export function ActivityForm({ initialData, onSubmit, onCancel }: ActivityFormProps) {
  const [step, setStep] = useState(1);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingData, setPendingData] = useState<ActivityFormData | null>(null);
  
  // Calculate progress percentage
  const progress = (step / STEPS.length) * 100;

  const form = useForm<ActivityFormData>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
        activity_type: initialData?.activity_type || 'task',
        status: initialData?.status || 'planned',
        priority: initialData?.priority || 'medium',
        subject: initialData?.subject || '',
        description: initialData?.description || '',
        due_date: initialData?.due_date || '',
        account_id: initialData?.account_id || null,
        contact_id: initialData?.contact_id || null,
        lead_id: initialData?.lead_id || null,
        location: initialData?.location || '',
        to: initialData?.to || '',
        from: initialData?.from || '',
        send_email: initialData?.send_email || false,
        email_body: initialData?.email_body || '',
      },
  });

  const { isSubmitting, isValid, errors } = form.formState;
  console.log('ActivityForm State:', { isSubmitting, isValid, errors, step });
  const activityType = form.watch('activity_type');

  // Smart defaults based on type
  useEffect(() => {
    if (!initialData?.id) {
      if (activityType === 'meeting') {
        // Example: Could set default duration or location fields if they existed
      }
    }
  }, [activityType, initialData]);

  const handleNext = async () => {
    const fieldsToValidate = getFieldsForStep(step);
    const result = await form.trigger(fieldsToValidate as any);
    if (result) {
      setStep(prev => Math.min(prev + 1, STEPS.length));
    }
  };

  const handleBack = () => {
    setStep(prev => Math.max(prev - 1, 1));
  };

  const getFieldsForStep = (currentStep: number) => {
    switch (currentStep) {
      case 1: return ['activity_type', 'subject', 'priority', 'status'];
      case 2: return ['account_id', 'contact_id', 'lead_id'];
      case 3: return ['due_date', 'description'];
      default: return [];
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'call': return <Phone className="h-5 w-5" />;
      case 'email': return <Mail className="h-5 w-5" />;
      case 'meeting': return <Calendar className="h-5 w-5" />;
      case 'task': return <CheckSquare className="h-5 w-5" />;
      case 'note': return <FileText className="h-5 w-5" />;
      default: return <Clock className="h-5 w-5" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'call': return 'Log a Call';
      case 'email': return 'Email';
      case 'meeting': return 'Meeting / Event';
      case 'task': return 'Task';
      case 'note': return 'Note';
      default: return type;
    }
  };

  const handleFormSubmit = async (data: ActivityFormData) => {
    if (initialData?.id) {
      setPendingData(data);
      setShowConfirmDialog(true);
    } else {
      await onSubmit(data);
    }
  };

  const handleConfirmUpdate = async () => {
    if (pendingData) {
      await onSubmit(pendingData);
      setShowConfirmDialog(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress Header */}
      <div className="mb-8">
        <div className="flex justify-between text-sm font-medium text-muted-foreground mb-2">
          {STEPS.map((s) => (
            <div 
              key={s.id} 
              className={cn(
                "flex items-center gap-2",
                step >= s.id ? "text-primary" : ""
              )}
            >
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs border",
                step >= s.id ? "bg-primary text-primary-foreground border-primary" : "border-muted-foreground"
              )}>
                {step > s.id ? <Check className="h-3 w-3" /> : s.id}
              </div>
              <span className="hidden sm:inline">{s.title}</span>
            </div>
          ))}
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleFormSubmit)}>
          <Card className="border-2">
            <CardHeader>
              <CardTitle>{STEPS[step - 1].title}</CardTitle>
              <CardDescription>{STEPS[step - 1].description}</CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6 min-h-[300px]">
              {/* STEP 1: BASICS */}
              {step === 1 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <FormField
                    control={form.control}
                    name="activity_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Activity Type</FormLabel>
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                          {['call', 'email', 'meeting', 'task', 'note'].map((type) => (
                            <div
                              key={type}
                              className={cn(
                                "cursor-pointer rounded-lg border-2 p-3 flex flex-col items-center gap-2 hover:bg-muted/50 transition-all",
                                field.value === type ? "border-primary bg-primary/5" : "border-muted"
                              )}
                              onClick={() => field.onChange(type)}
                            >
                              <div className={cn(
                                "p-2 rounded-full",
                                field.value === type ? "bg-primary text-primary-foreground" : "bg-muted"
                              )}>
                                {getTypeIcon(type)}
                              </div>
                              <span className="text-xs font-medium capitalize">{type}</span>
                            </div>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subject</FormLabel>
                        <FormControl>
                          <Input placeholder={`e.g. ${activityType === 'call' ? 'Introductory call with...' : 'Prepare proposal for...'}`} {...field} />
                        </FormControl>
                        <FormDescription>
                          A concise summary of the activity.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Priority</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select priority" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="urgent">Urgent</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="planned">Planned</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              {/* STEP 2: CONTEXT */}
              {step === 2 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="bg-muted/30 p-4 rounded-lg border mb-4">
                     <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                       <HelpCircle className="h-4 w-4 text-primary" />
                       Why link records?
                     </h4>
                     <p className="text-xs text-muted-foreground">
                       Linking this activity to a Lead, Contact, or Account ensures it appears in their respective timelines and helps with reporting.
                     </p>
                  </div>

                  <FormField
                    control={form.control}
                    name="lead_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Related Lead</FormLabel>
                        <FormControl>
                          <SearchableSelect
                            table="leads"
                            label="Lead"
                            displayField="last_name"
                            searchFields={['first_name', 'last_name', 'company']}
                            value={field.value}
                            onChange={(val) => field.onChange(val)}
                            renderOption={(item) => (
                              <div className="flex flex-col">
                                <span className="font-medium">{item.first_name} {item.last_name}</span>
                                {item.company && <span className="text-xs text-muted-foreground">{item.company}</span>}
                              </div>
                            )}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">Or</span>
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="contact_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Related Contact</FormLabel>
                        <FormControl>
                          <SearchableSelect
                            table="contacts"
                            label="Contact"
                            displayField="last_name"
                            searchFields={['first_name', 'last_name', 'email']}
                            value={field.value}
                            onChange={(val) => field.onChange(val)}
                            renderOption={(item) => (
                              <div className="flex flex-col">
                                <span className="font-medium">{item.first_name} {item.last_name}</span>
                                <span className="text-xs text-muted-foreground">{item.email}</span>
                              </div>
                            )}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="account_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Related Account</FormLabel>
                        <FormControl>
                          <SearchableSelect
                            table="accounts"
                            label="Account"
                            displayField="name"
                            searchFields={['name']}
                            value={field.value}
                            onChange={(val) => field.onChange(val)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* STEP 3: DETAILS */}
              {step === 3 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  {activityType === 'meeting' && (
                    <FormField
                      control={form.control}
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
                  )}

                  {activityType === 'email' && (
                    <>
                      <FormField
                        control={form.control}
                        name="to"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>To</FormLabel>
                            <FormControl>
                              <Input placeholder="recipient@example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="send_email"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                              <CheckSquare
                                className={cn(
                                  "h-4 w-4 shrink-0 cursor-pointer",
                                  field.value ? "text-primary" : "text-muted-foreground"
                                )}
                                onClick={() => field.onChange(!field.value)}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Send this email?</FormLabel>
                              <FormDescription>
                                If checked, the email will be sent via the system.
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                    </>
                  )}

                  <FormField
                    control={form.control}
                    name="due_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {activityType === 'meeting' ? 'Start Time' : 'Due Date'}
                        </FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {activityType === 'email' ? 'Body' : 'Description / Notes'}
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={
                              activityType === 'meeting' ? "Agenda, location, and key points..." :
                              activityType === 'call' ? "Call script or talking points..." :
                              activityType === 'email' ? "Email content..." :
                              "Add details..."
                            }
                            className="min-h-[150px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Summary of selections */}
                  <div className="bg-secondary/10 p-4 rounded-lg border mt-4">
                    <h4 className="text-sm font-semibold mb-2">Summary</h4>
                    <div className="text-sm grid grid-cols-2 gap-2">
                      <div className="text-muted-foreground">Type:</div>
                      <div className="capitalize">{activityType}</div>
                      <div className="text-muted-foreground">Subject:</div>
                      <div className="font-medium">{form.watch('subject') || '-'}</div>
                      <div className="text-muted-foreground">Priority:</div>
                      <div className="capitalize">{form.watch('priority')}</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>

            <CardFooter className="flex justify-between border-t pt-6">
              <Button 
                type="button" 
                variant="outline" 
                onClick={step === 1 ? onCancel : handleBack}
              >
                {step === 1 ? 'Cancel' : (
                  <>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </>
                )}
              </Button>
              
              {step < STEPS.length ? (
                <Button type="button" onClick={handleNext}>
                  Next <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {initialData?.id ? 'Update Activity' : 'Create Activity'}
                </Button>
              )}
            </CardFooter>
          </Card>
        </form>
      </Form>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Update</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to update this activity? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmUpdate}>Update</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, Trash2, Loader2, Plus, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { TaxManagementService } from '@/services/taxation/TaxManagementService';
import { TaxJurisdiction, TaxRule } from '@/services/taxation/types';
import { TaxRuleDialog } from './TaxRuleDialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const formSchema = z.object({
  code: z.string().min(2, 'Code must be at least 2 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  type: z.enum(['COUNTRY', 'STATE', 'CITY', 'DISTRICT', 'COUNTY']),
  parentId: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

export default function TaxJurisdictionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState<TaxRule[]>([]);
  const [parentOptions, setParentOptions] = useState<TaxJurisdiction[]>([]);
  const isNew = id === 'new';

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: '',
      name: '',
      type: 'COUNTRY',
      parentId: null,
    },
  });

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load potential parents (all jurisdictions)
      // In a real app, filtering to avoid cycles would be good, but for now just load all.
      const allJurisdictions = await TaxManagementService.getJurisdictions();
      setParentOptions(allJurisdictions.filter(j => j.id !== id)); // Exclude self

      if (!isNew && id) {
        const [jurisdictionData, rulesData] = await Promise.all([
          TaxManagementService.getJurisdictionById(id),
          TaxManagementService.getTaxRules(id)
        ]);
        
        if (!jurisdictionData) {
          throw new Error('Jurisdiction not found');
        }
        
        form.reset({
          code: jurisdictionData.code,
          name: jurisdictionData.name,
          type: jurisdictionData.type as any,
          parentId: jurisdictionData.parentId,
        });
        setRules(rulesData);
      }
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load data',
        variant: 'destructive',
      });
      if (!isNew) {
        navigate('/dashboard/finance/tax-jurisdictions');
      }
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      if (isNew) {
        await TaxManagementService.createJurisdiction({
          code: values.code,
          name: values.name,
          type: values.type,
          parentId: values.parentId || undefined,
        });
        toast({ title: 'Success', description: 'Tax jurisdiction created successfully' });
        navigate('/dashboard/finance/tax-jurisdictions');
      } else if (id) {
        await TaxManagementService.updateJurisdiction(id, {
          code: values.code,
          name: values.name,
          type: values.type,
          parentId: values.parentId || undefined,
        });
        toast({ title: 'Success', description: 'Tax jurisdiction updated successfully' });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save tax jurisdiction',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || isNew) return;
    try {
      await TaxManagementService.deleteJurisdiction(id);
      toast({ title: 'Success', description: 'Tax jurisdiction deleted' });
      navigate('/dashboard/finance/tax-jurisdictions');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete jurisdiction',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/dashboard/finance/tax-jurisdictions')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {isNew ? 'New Jurisdiction' : form.getValues('name')}
              </h1>
              {!isNew && (
                <p className="text-muted-foreground flex items-center gap-2">
                  {form.getValues('code')}
                  <Badge variant="outline">{form.getValues('type')}</Badge>
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {!isNew && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="icon">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Jurisdiction?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the jurisdiction
                      and may affect tax calculations.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button onClick={form.handleSubmit(onSubmit)} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              Save
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
              <CardDescription>
                Basic information about the tax jurisdiction.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Code</FormLabel>
                        <FormControl>
                          <Input placeholder="US-CA" {...field} />
                        </FormControl>
                        <FormDescription>Unique identifier (e.g. ISO code)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="California" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="COUNTRY">Country</SelectItem>
                              <SelectItem value="STATE">State</SelectItem>
                              <SelectItem value="COUNTY">County</SelectItem>
                              <SelectItem value="CITY">City</SelectItem>
                              <SelectItem value="DISTRICT">District</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="parentId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Parent Jurisdiction</FormLabel>
                          <Select 
                            onValueChange={(val) => field.onChange(val === "none" ? null : val)} 
                            value={field.value || "none"}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select parent" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {parentOptions.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name} ({p.code})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          {!isNew && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Tax Rules</CardTitle>
                  <CardDescription>
                    Rules defined for this jurisdiction.
                  </CardDescription>
                </div>
                <Button size="sm" onClick={handleAddRule}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Rule
                </Button>
              </CardHeader>
              <CardContent>
                {rules.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No tax rules defined.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rate</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Effective</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rules.map((rule) => (
                        <TableRow key={rule.id}>
                          <TableCell className="font-medium">{(rule.rate * 100).toFixed(4)}%</TableCell>
                          <TableCell>{rule.ruleType}</TableCell>
                          <TableCell>
                            {new Date(rule.effectiveFrom).toLocaleDateString()}
                          </TableCell>
                          <TableCell>{rule.priority}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => handleEditRule(rule)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </div>
        
        {id && !isNew && (
          <TaxRuleDialog
            open={ruleDialogOpen}
            onOpenChange={setRuleDialogOpen}
            jurisdictionId={id}
            ruleToEdit={selectedRule}
            onSuccess={handleRuleSaved}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

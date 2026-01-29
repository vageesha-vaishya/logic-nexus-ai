
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { TaxManagementService } from '@/services/taxation/TaxManagementService';
import { TaxCode, TaxRule } from '@/services/taxation/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const formSchema = z.object({
  taxCodeId: z.string().optional().nullable(),
  rate: z.coerce.number().min(0).max(1),
  priority: z.coerce.number().int().min(0),
  ruleType: z.enum(['STANDARD', 'REDUCED', 'EXEMPT']),
  effectiveFrom: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date",
  }),
  effectiveTo: z.string().optional().nullable().refine((val) => !val || !isNaN(Date.parse(val)), {
    message: "Invalid date",
  }),
});

type FormValues = z.infer<typeof formSchema>;

interface TaxRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jurisdictionId: string;
  ruleToEdit?: TaxRule | null;
  onSuccess: () => void;
}

export function TaxRuleDialog({
  open,
  onOpenChange,
  jurisdictionId,
  ruleToEdit,
  onSuccess,
}: TaxRuleDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [taxCodes, setTaxCodes] = useState<TaxCode[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      taxCodeId: null,
      rate: 0,
      priority: 0,
      ruleType: 'STANDARD',
      effectiveFrom: new Date().toISOString().split('T')[0],
      effectiveTo: '',
    },
  });

  useEffect(() => {
    if (open) {
      loadTaxCodes();
      if (ruleToEdit) {
        form.reset({
          taxCodeId: ruleToEdit.taxCodeId || null,
          rate: ruleToEdit.rate,
          priority: ruleToEdit.priority,
          ruleType: ruleToEdit.ruleType,
          effectiveFrom: new Date(ruleToEdit.effectiveFrom).toISOString().split('T')[0],
          effectiveTo: ruleToEdit.effectiveTo
            ? new Date(ruleToEdit.effectiveTo).toISOString().split('T')[0]
            : '',
        });
      } else {
        form.reset({
          taxCodeId: null,
          rate: 0,
          priority: 0,
          ruleType: 'STANDARD',
          effectiveFrom: new Date().toISOString().split('T')[0],
          effectiveTo: '',
        });
      }
    }
  }, [open, ruleToEdit]);

  const loadTaxCodes = async () => {
    try {
      const codes = await TaxManagementService.getTaxCodes();
      setTaxCodes(codes);
    } catch (error) {
      console.error('Failed to load tax codes', error);
    }
  };

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      const ruleData = {
        jurisdictionId,
        taxCodeId: values.taxCodeId || undefined,
        rate: values.rate,
        priority: values.priority,
        ruleType: values.ruleType,
        effectiveFrom: new Date(values.effectiveFrom),
        effectiveTo: values.effectiveTo ? new Date(values.effectiveTo) : undefined,
      };

      if (ruleToEdit) {
        await TaxManagementService.updateTaxRule(ruleToEdit.id, ruleData);
        toast({ title: 'Success', description: 'Tax rule updated' });
      } else {
        await TaxManagementService.createTaxRule(ruleData);
        toast({ title: 'Success', description: 'Tax rule created' });
      }
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save tax rule',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{ruleToEdit ? 'Edit Tax Rule' : 'Add Tax Rule'}</DialogTitle>
          <DialogDescription>
            Configure the tax rate and applicability rules.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="ruleType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rule Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="STANDARD">Standard</SelectItem>
                        <SelectItem value="REDUCED">Reduced</SelectItem>
                        <SelectItem value="EXEMPT">Exempt</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rate (Decimal)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.0001" placeholder="0.0825" {...field} />
                    </FormControl>
                    <FormDescription>e.g. 0.0825 for 8.25%</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="taxCodeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tax Code (Product Category)</FormLabel>
                  <Select
                    onValueChange={(val) => field.onChange(val === "none" ? null : val)}
                    value={field.value || "none"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select tax code (Optional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">None (Applies to all/standard)</SelectItem>
                      {taxCodes.map((code) => (
                        <SelectItem key={code.id} value={code.id}>
                          {code.code} - {code.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Leave empty for the default/standard rate rule.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormDescription>Higher priority rules override lower ones.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="effectiveFrom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Effective From</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="effectiveTo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Effective To (Optional)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Rule
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

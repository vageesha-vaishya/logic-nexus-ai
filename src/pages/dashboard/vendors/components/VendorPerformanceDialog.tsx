import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';

const performanceSchema = z.object({
  review_period_start: z.string().min(1, 'Start date is required'),
  review_period_end: z.string().min(1, 'End date is required'),
  overall_score: z.coerce.number().min(0).max(100),
  quality_score: z.coerce.number().min(0).max(100).optional(),
  delivery_score: z.coerce.number().min(0).max(100).optional(),
  cost_score: z.coerce.number().min(0).max(100).optional(),
  communication_score: z.coerce.number().min(0).max(100).optional(),
  comments: z.string().optional(),
});

type PerformanceFormValues = z.infer<typeof performanceSchema>;

interface VendorPerformanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: string;
  onSuccess: () => void;
}

export function VendorPerformanceDialog({ open, onOpenChange, vendorId, onSuccess }: VendorPerformanceDialogProps) {
  const { supabase } = useCRM();
  const [loading, setLoading] = useState(false);

  const form = useForm<PerformanceFormValues>({
    resolver: zodResolver(performanceSchema),
    defaultValues: {
      review_period_start: '',
      review_period_end: '',
      overall_score: 0,
      quality_score: 0,
      delivery_score: 0,
      cost_score: 0,
      communication_score: 0,
      comments: '',
    },
  });

  const onSubmit = async (data: PerformanceFormValues) => {
    setLoading(true);
    try {
      const payload = {
        vendor_id: vendorId,
        ...data,
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('vendor_performance_reviews')
        .insert(payload);

      if (error) throw error;

      toast.success('Performance review recorded successfully');
      form.reset();
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error recording performance review:', error);
      toast.error(error.message || 'Failed to record review');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add Performance Review</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="review_period_start"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Period Start</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="review_period_end"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Period End</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="overall_score"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Overall Score (0-100)</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" max="100" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="quality_score"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quality Score</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" max="100" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="delivery_score"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delivery Score</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" max="100" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cost_score"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost Score</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" max="100" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="comments"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comments</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Performance notes..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} type="button">
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : 'Save Review'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

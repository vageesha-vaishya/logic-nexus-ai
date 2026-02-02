import { useState, useEffect } from 'react';
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Edit2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const clauseSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  category: z.string().min(1, 'Category is required'),
  content: z.string().min(10, 'Content must be at least 10 characters'),
  is_active: z.boolean().default(true),
});

type ClauseFormValues = z.infer<typeof clauseSchema>;

interface Clause {
  id: string;
  name: string;
  category: string;
  content: string;
  is_active: boolean;
  created_at: string;
}

interface ClauseLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClauseLibraryDialog({ open, onOpenChange }: ClauseLibraryDialogProps) {
  const { supabase } = useCRM();
  const [loading, setLoading] = useState(false);
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [editingClause, setEditingClause] = useState<Clause | null>(null);
  const [view, setView] = useState<'list' | 'form'>('list');

  const form = useForm<ClauseFormValues>({
    resolver: zodResolver(clauseSchema),
    defaultValues: {
      name: '',
      category: 'General',
      content: '',
      is_active: true,
    },
  });

  const fetchClauses = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('contract_clauses')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setClauses(data || []);
    } catch (error: any) {
      toast.error('Failed to load clauses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchClauses();
      setView('list');
      setEditingClause(null);
    }
  }, [open]);

  const handleSubmit = async (values: ClauseFormValues) => {
    setLoading(true);
    try {
      if (editingClause) {
        const { error } = await supabase
          .from('contract_clauses')
          .update(values)
          .eq('id', editingClause.id);
        if (error) throw error;
        toast.success('Clause updated');
      } else {
        const { error } = await supabase
          .from('contract_clauses')
          .insert([values]);
        if (error) throw error;
        toast.success('Clause created');
      }
      
      setView('list');
      setEditingClause(null);
      fetchClauses();
    } catch (error: any) {
      toast.error('Failed to save clause');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (clause: Clause) => {
    setEditingClause(clause);
    form.reset({
      name: clause.name,
      category: clause.category,
      content: clause.content,
      is_active: clause.is_active,
    });
    setView('form');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this clause?')) return;
    try {
      const { error } = await supabase.from('contract_clauses').delete().eq('id', id);
      if (error) throw error;
      toast.success('Clause deleted');
      fetchClauses();
    } catch (error: any) {
      toast.error('Failed to delete clause');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Contract Clause Library</DialogTitle>
          <DialogDescription>
            Manage standard legal clauses for vendor contracts.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {view === 'list' ? (
            <>
              <div className="flex justify-between items-center">
                <Input placeholder="Search clauses..." className="max-w-sm" />
                <Button onClick={() => {
                  setEditingClause(null);
                  form.reset({ name: '', category: 'General', content: '', is_active: true });
                  setView('form');
                }}>
                  <Plus className="mr-2 h-4 w-4" /> Add Clause
                </Button>
              </div>
              
              <ScrollArea className="flex-1 border rounded-md p-4">
                {loading && clauses.length === 0 ? (
                  <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : clauses.length === 0 ? (
                  <div className="text-center p-8 text-muted-foreground">No clauses found. Add one to get started.</div>
                ) : (
                  <div className="space-y-4">
                    {clauses.map((clause) => (
                      <Card key={clause.id}>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="font-semibold flex items-center gap-2">
                                {clause.name}
                                <Badge variant="secondary">{clause.category}</Badge>
                                {!clause.is_active && <Badge variant="destructive">Inactive</Badge>}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                Last updated: {new Date(clause.created_at).toLocaleDateString()}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="ghost" size="sm" onClick={() => handleEdit(clause)}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(clause.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="bg-muted/50 p-3 rounded text-sm whitespace-pre-wrap font-mono">
                            {clause.content}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto pr-2">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Clause Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Limitation of Liability" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="General">General</SelectItem>
                            <SelectItem value="Payment Terms">Payment Terms</SelectItem>
                            <SelectItem value="Liability">Liability</SelectItem>
                            <SelectItem value="Termination">Termination</SelectItem>
                            <SelectItem value="Confidentiality">Confidentiality</SelectItem>
                            <SelectItem value="Compliance">Compliance</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Clause Content (Markdown/Text)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Enter the full legal text of the clause..." 
                            className="min-h-[200px] font-mono"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setView('list')}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {editingClause ? 'Update Clause' : 'Create Clause'}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
